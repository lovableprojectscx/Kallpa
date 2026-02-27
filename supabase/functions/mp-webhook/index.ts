import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.12.0"

serve(async (req) => {
    try {
        const url = new URL(req.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        if (!topic || !id) {
            // Puede que MP envíe el body en vez de query params
            const bodyText = await req.text()
            if (bodyText) {
                const body = JSON.parse(bodyText)
                if (body.type === 'payment' || body.topic === 'payment') {
                    await processPayment(body.data.id)
                    return new Response("OK", { status: 200 })
                }
            }
            return new Response("Missing topic or id", { status: 400 })
        }

        if (topic === 'payment') {
            await processPayment(id)
        }

        return new Response("OK", { status: 200 })
    } catch (error) {
        console.error("Webhook Error:", error)
        return new Response("Internal Server Error", { status: 500 })
    }
})

async function processPayment(paymentId: string) {
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');
    if (!mpAccessToken) throw new Error("Missing MP_ACCESS_TOKEN");

    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const payment = new Payment(client);

    // Obtener detalles del pago desde la API de MP
    const p = await payment.get({ id: paymentId });
    console.log(`Payment Status: ${p.status}`);

    if (p.status === 'approved') {
        const extRef = p.external_reference;
        if (!extRef) {
            console.error("No external reference found on payment:", paymentId);
            return;
        }

        let refData;
        try {
            refData = JSON.parse(extRef);
        } catch (e) {
            console.error("Could not parse external_reference:", extRef);
            return;
        }

        const { tenant_id, duration_months, user_id } = refData;

        if (!tenant_id || !duration_months) {
            console.error("Invalid external reference data:", refData);
            return;
        }

        // Conectar a Supabase usando as Admin (Service Role Key saltar RLS)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase Env variables")
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Generar un código de licencia aleatorio que sirve de registro histórico
        const generateRandomBlock = () => Math.random().toString(36).substring(2, 6).toUpperCase().padStart(4, '0');
        const randomCode = `MP-${generateRandomBlock()}-${generateRandomBlock()}`;

        // Insertar Licencia Canjeada directamente para el gym (tenant)
        const { error: insertError } = await supabase.from("licenses").insert([
            {
                code: randomCode,
                duration_months: parseInt(duration_months),
                status: "redeemed",
                created_by: user_id || null, // A veces no está presente si es automático, pero lo recibimos en refData
                price_pen: p.transaction_amount || 0,
                label: `Mercado Pago (Auto) - ${duration_months} mes(es)`,
                redeemed_by: tenant_id,
                redeemed_at: new Date().toISOString()
            }
        ]);

        if (insertError) {
            console.error("Error creating license for tenant:", tenant_id, insertError);
            throw insertError;
        }

        console.log(`Successfully extended subscription for tenant: ${tenant_id} (+${duration_months} months) via MP Payment: ${paymentId}`);

        // --- LÓGICA DE AFILIADOS ---
        // Si el tenant tiene un "referer", darle crédito (1 crédito = 1 mes, se suma la cantidad de meses comprada)
        try {
            // Buscamos al dueño del gimnasio (para buscar si fue referido)
            let currentUserId = user_id;

            if (!currentUserId) {
                const { data: owner } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('tenant_id', tenant_id)
                    .order('created_at', { ascending: true })
                    .limit(1)
                    .single();
                if (owner) currentUserId = owner.id;
            }

            if (currentUserId) {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', currentUserId)
                    .single();

                if (ownerProfile?.referred_by) {
                    const { data: affiliateRecord } = await supabase
                        .from('affiliates')
                        .select('id, profile_id')
                        .eq('id', ownerProfile.referred_by)
                        .eq('status', 'active')
                        .single();

                    if (affiliateRecord) {
                        const months = parseInt(duration_months) || 1;
                        const creditsToAward = months * 100;
                        const reasonText = `Referido activó ${months} mes(es) por Mercado Pago → +${creditsToAward} créditos (Tenant: ${tenant_id})`;

                        const { error: rpcError } = await supabase.rpc('award_affiliate_credit_v2', {
                            p_affiliate_id: affiliateRecord.id,
                            p_credits: creditsToAward,
                            p_tenant_id: tenant_id,
                            p_reason: reasonText
                        });

                        if (rpcError) {
                            console.warn("Could not award affiliate credit via RPC:", rpcError);
                        } else {
                            console.log(`Successfully awarded ${creditsToAward} affiliate credits to affiliate ${affiliateRecord.id}`);
                        }
                    }
                }
            }
        } catch (creditError) {
            console.warn("Unexpected error awarding affiliate credit:", creditError);
        }
        // ---------------------------
    }
}
