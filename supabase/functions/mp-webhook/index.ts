import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.12.0"

/** Verifica la firma HMAC-SHA256 de Mercado Pago.
 *  Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#signature
 */
async function verifyMPSignature(req: Request, dataId: string): Promise<boolean> {
    const secret = Deno.env.get('MP_WEBHOOK_SECRET');
    if (!secret) {
        // Si no está configurado el secreto, logueamos advertencia y dejamos pasar
        // (permite mantener compatibilidad sin romper en entornos sin secreto)
        console.warn("MP_WEBHOOK_SECRET not configured — skipping signature verification");
        return true;
    }

    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    if (!xSignature || !xRequestId) {
        console.warn("Missing x-signature or x-request-id headers");
        return false;
    }

    // Parsear ts y v1 del header x-signature
    const parts: Record<string, string> = {};
    xSignature.split(',').forEach(part => {
        const [key, value] = part.trim().split('=');
        if (key && value) parts[key] = value;
    });

    const ts = parts['ts'];
    const v1 = parts['v1'];
    if (!ts || !v1) return false;

    // Manifest: id:{dataId};request-id:{xRequestId};ts:{ts}
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(manifest);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const computedHash = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return computedHash === v1;
}

serve(async (req) => {
    try {
        const url = new URL(req.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        if (!topic || !id) {
            // Puede que MP envíe el body en vez de query params
            let bodyText = '';
            try {
                bodyText = await req.text();
            } catch {
                return new Response("Missing topic or id", { status: 400 });
            }

            if (bodyText) {
                let body: any;
                try {
                    body = JSON.parse(bodyText);
                } catch {
                    console.error("Invalid JSON body received");
                    return new Response("Invalid JSON", { status: 400 });
                }

                if ((body.type === 'payment' || body.topic === 'payment') && body.data?.id) {
                    const isValid = await verifyMPSignature(req, String(body.data.id));
                    if (!isValid) {
                        console.error("Invalid webhook signature");
                        return new Response("Unauthorized", { status: 401 });
                    }
                    await processPayment(String(body.data.id));
                    return new Response("OK", { status: 200 });
                }
            }
            return new Response("Missing topic or id", { status: 400 });
        }

        if (topic === 'payment') {
            const isValid = await verifyMPSignature(req, id);
            if (!isValid) {
                console.error("Invalid webhook signature");
                return new Response("Unauthorized", { status: 401 });
            }
            await processPayment(id);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Webhook Error:", error);
        return new Response("Internal Server Error", { status: 500 });
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

        // Usar el ID del pago de Mercado Pago como código único de la licencia.
        // Esto garantiza idempotencia: si MP envía el mismo webhook ('approved') dos veces,
        // la base de datos rechazará el insert duplicado gracias a la restricción UNIQUE() de 'code'.
        const randomCode = `MP-PAY-${paymentId}`;

        // Insertar Licencia Canjeada directamente para el gym (tenant)
        const { error: insertError } = await supabase.from("licenses").insert([
            {
                code: randomCode,
                duration_months: parseInt(duration_months),
                status: "redeemed",
                created_by: user_id || null,
                price_pen: p.transaction_amount || 0,
                label: `Mercado Pago (Auto) - ${duration_months} mes(es) - ID: ${paymentId}`,
                redeemed_by: tenant_id,
                redeemed_at: new Date().toISOString()
            }
        ]);

        if (insertError) {
            // Error 23505 == Unique Violation en Postgres (ya existe la licencia con ese código)
            if (insertError.code === "23505") {
                console.log(`Payment ${paymentId} already processed (idempotency caught). Ignoring...`);
                return;
            }
            console.error("Error creating license for tenant:", tenant_id, insertError);
            throw insertError;
        }

        console.log(`Successfully extended subscription for tenant: ${tenant_id} (+${duration_months} months) via MP Payment: ${paymentId}`);

        // --- LÓGICA DE AFILIADOS ---
        try {
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
    }
}
