import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.12.0"

// CORS headers para permitir llamadas desde el frontend
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Manejo de preflight (CORS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verificar usuario autenticado
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { planDuration, pricePen, tenantId } = await req.json()

        if (!planDuration || !pricePen || !tenantId) {
            return new Response(JSON.stringify({ error: 'Missing parameters' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
        if (!mpAccessToken) {
            throw new Error("Mercado Pago Access Token not configured")
        }

        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const preference = new Preference(client);

        const body = {
            items: [
                {
                    id: `plan_${planDuration}_months`,
                    title: `Suscripción Sistema GYM - ${planDuration} mes(es)`,
                    quantity: 1,
                    unit_price: Number(pricePen),
                    currency_id: 'PEN',
                }
            ],
            // Aquí metemos los datos clave para identificar el pago en el webhook
            external_reference: JSON.stringify({
                tenant_id: tenantId,
                duration_months: planDuration,
                user_id: user.id
            }),
            back_urls: {
                success: `${req.headers.get('origin')}/settings?payment=success`,
                failure: `${req.headers.get('origin')}/settings?payment=failure`,
                pending: `${req.headers.get('origin')}/settings?payment=pending`,
            },
            auto_return: "approved",
            // Opcional: Para notificaciones (webhook)
            // notification_url: "TU_URL_DEL_WEBHOOK", 
        };

        const response = await preference.create({ body });

        return new Response(JSON.stringify({ init_point: response.init_point }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
