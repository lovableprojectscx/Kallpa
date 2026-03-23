import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.12.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge Function pública — genera un link de pago de Mercado Pago para que un
 * miembro renueve su membresía directamente desde el Portal del Miembro.
 *
 * Flujo:
 *  1. Recibe `memberId` y `planId` (sin auth de usuario, portal es público).
 *  2. Busca el `tenant_id` del miembro y el `mp_access_token` del gym en `gym_settings`.
 *  3. Crea una preferencia MP en soles (PEN) usando el token del gym → el dinero va
 *     directo a la cuenta MP del gym, sin pasar por Kallpa.
 *  4. La `notification_url` incluye `?tenant_id=xxx` para que el webhook sepa qué
 *     token usar al verificar el pago.
 *  5. Devuelve `init_point` para redirigir al checkout de MP.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { memberId, planId } = await req.json()

        if (!memberId || !planId) {
            return new Response(JSON.stringify({ error: 'memberId y planId son requeridos' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Obtener miembro para saber su tenant_id
        const { data: member, error: memberError } = await supabase
            .from('members')
            .select('id, full_name, tenant_id, end_date')
            .eq('id', memberId)
            .single()

        if (memberError || !member) {
            return new Response(JSON.stringify({ error: 'Miembro no encontrado' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Validar que el plan pertenece al gym del miembro y está activo
        const { data: plan, error: planError } = await supabase
            .from('membership_plans')
            .select('id, name, price, duration_days')
            .eq('id', planId)
            .eq('tenant_id', member.tenant_id)
            .eq('is_active', true)
            .single()

        if (planError || !plan) {
            return new Response(JSON.stringify({ error: 'Plan no disponible' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // Obtener el token MP del gym (cada gym tiene el suyo propio)
        const { data: gymSettings } = await supabase
            .from('gym_settings')
            .select('mp_access_token, gym_name')
            .eq('tenant_id', member.tenant_id)
            .single()

        if (!gymSettings?.mp_access_token) {
            return new Response(JSON.stringify({
                error: 'El gimnasio aún no configuró pagos online. Contacta a recepción.'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const client = new MercadoPagoConfig({ accessToken: gymSettings.mp_access_token })
        const preference = new Preference(client)

        const origin = req.headers.get('origin') || 'https://app.kallpa.site'

        const preferenceBody = {
            items: [
                {
                    id: `renewal_${planId}`,
                    title: `${plan.name} — ${gymSettings.gym_name || 'Gimnasio'}`,
                    description: `Renovación de membresía por ${plan.duration_days} días`,
                    quantity: 1,
                    unit_price: Number(plan.price),
                    currency_id: 'PEN',
                }
            ],
            external_reference: JSON.stringify({
                member_id: memberId,
                plan_id: planId,
                tenant_id: member.tenant_id,
                payment_type: 'member_renewal'
            }),
            back_urls: {
                success: `${origin}/portal/${memberId}?payment=success&plan=${encodeURIComponent(plan.name)}`,
                failure: `${origin}/portal/${memberId}?payment=failure`,
                pending: `${origin}/portal/${memberId}?payment=pending`,
            },
            auto_return: 'approved',
            // tenant_id en la URL para que el webhook sepa qué token MP usar al verificar
            notification_url: `${supabaseUrl}/functions/v1/mp-member-webhook?tenant_id=${member.tenant_id}`,
        }

        const response = await preference.create({ body: preferenceBody })

        return new Response(JSON.stringify({ init_point: response.init_point }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error("Error creating member payment preference:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
