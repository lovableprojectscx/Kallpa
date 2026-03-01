import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Preference } from "npm:mercadopago@2.12.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        // Usar ANON_KEY para verificar al usuario correctamente
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

        const supabaseClient = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: authHeader } } }
        )

        // Verificamos al usuario
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

        if (userError || !user) {
            console.error("Auth check failed:", userError?.message || "No user found")
            return new Response(JSON.stringify({
                error: 'Unauthorized',
                detail: userError?.message || "Sesión inválida"
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const bodyJson = await req.json()
        const { planDuration, pricePen, tenantId } = bodyJson

        const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
        if (!mpAccessToken) {
            throw new Error("MP_ACCESS_TOKEN no configurado")
        }

        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const preference = new Preference(client);

        const preferenceBody = {
            items: [
                {
                    id: `plan_${planDuration}`,
                    title: `Licencia KALLPA PRO - ${planDuration} mes(es)`,
                    quantity: 1,
                    unit_price: Number(pricePen),
                    currency_id: 'PEN',
                }
            ],
            external_reference: JSON.stringify({
                tenant_id: tenantId,
                duration_months: planDuration,
                user_id: user.id
            }),
            back_urls: {
                success: `${req.headers.get('origin')}/subscription?payment=success`,
                failure: `${req.headers.get('origin')}/subscription?payment=failure`,
                pending: `${req.headers.get('origin')}/subscription?payment=pending`,
            },
            auto_return: "approved",
            notification_url: `https://tzahwzskardwwiguumnl.supabase.co/functions/v1/mp-webhook`,
        };

        const response = await preference.create({ body: preferenceBody });

        return new Response(JSON.stringify({ init_point: response.init_point }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error("Error:", error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
