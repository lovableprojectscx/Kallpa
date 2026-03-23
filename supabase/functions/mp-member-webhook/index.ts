import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { MercadoPagoConfig, Payment } from "npm:mercadopago@2.12.0"

/**
 * Verifica la firma HMAC-SHA256 de Mercado Pago para garantizar que el webhook
 * es auténtico y no fue manipulado.
 */
async function verifyMPSignature(req: Request, dataId: string, secret: string): Promise<boolean> {
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    if (!xSignature || !xRequestId) return false

    const parts: Record<string, string> = {}
    xSignature.split(',').forEach(part => {
        const [key, value] = part.trim().split('=')
        if (key && value) parts[key] = value
    })

    const ts = parts['ts']
    const v1 = parts['v1']
    if (!ts || !v1) return false

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`
    const encoder = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(manifest))
    const computedHash = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

    return computedHash === v1
}

/**
 * Webhook de Mercado Pago para pagos de membresías de miembros.
 *
 * A diferencia del webhook principal (licencias SaaS), este procesa pagos del tipo
 * `member_renewal` que los miembros realizan desde su portal público.
 *
 * La URL incluye `?tenant_id=xxx` para saber qué token MP del gym usar al consultar
 * la API de MP (cada gym usa su propio token, el dinero va directo a su cuenta).
 *
 * Al recibir un pago aprobado:
 *  1. Verifica idempotencia contra `member_payments` (evita doble procesamiento).
 *  2. Calcula la nueva fecha de vencimiento sumando los días del plan a
 *     `max(today, current_end_date)` (stacking automático).
 *  3. Actualiza `members.end_date` y `members.status = 'active'`.
 *  4. Registra el pago en `member_payments` para historial.
 */
serve(async (req) => {
    try {
        const url = new URL(req.url)
        const tenantId = url.searchParams.get('tenant_id')
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        let paymentId = url.searchParams.get('id') || url.searchParams.get('data.id')
        let paymentTopic = topic

        // MP a veces envía los datos en el body en vez de query params
        if (!paymentId || !paymentTopic) {
            let bodyText = ''
            try { bodyText = await req.text() } catch {
                return new Response("Missing params", { status: 400 })
            }
            if (bodyText) {
                let body: any
                try { body = JSON.parse(bodyText) } catch {
                    return new Response("Invalid JSON", { status: 400 })
                }
                if ((body.type === 'payment' || body.topic === 'payment') && body.data?.id) {
                    paymentId = String(body.data.id)
                    paymentTopic = 'payment'
                }
            }
        }

        if (paymentTopic !== 'payment' || !paymentId) {
            return new Response("OK", { status: 200 })
        }

        await processPayment(paymentId, tenantId, req)
        return new Response("OK", { status: 200 })

    } catch (error) {
        console.error("Webhook Error:", error)
        return new Response("Internal Server Error", { status: 500 })
    }
})

async function processPayment(paymentId: string, tenantId: string | null, req: Request) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener el token MP del gym usando el tenant_id de la URL
    let mpAccessToken: string | null = null
    if (tenantId) {
        const { data: gymSettings } = await supabase
            .from('gym_settings')
            .select('mp_access_token')
            .eq('tenant_id', tenantId)
            .single()
        mpAccessToken = gymSettings?.mp_access_token || null
    }

    if (!mpAccessToken) {
        console.error("No MP access token found for tenant:", tenantId)
        return
    }

    // Verificar firma HMAC si el secreto está configurado
    const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET')
    if (webhookSecret) {
        const isValid = await verifyMPSignature(req, paymentId, webhookSecret)
        if (!isValid) {
            console.error("Invalid webhook signature for payment:", paymentId)
            return
        }
    }

    const client = new MercadoPagoConfig({ accessToken: mpAccessToken })
    const payment = new Payment(client)

    const p = await payment.get({ id: paymentId })
    console.log(`Member Payment ${paymentId} Status: ${p.status}`)

    if (p.status !== 'approved') return

    const extRef = p.external_reference
    if (!extRef) { console.error("No external_reference on payment:", paymentId); return }

    let refData: any
    try { refData = JSON.parse(extRef) } catch {
        console.error("Invalid external_reference:", extRef); return
    }

    if (refData.payment_type !== 'member_renewal') {
        console.log("Not a member_renewal payment, skipping:", refData.payment_type)
        return
    }

    const { member_id, plan_id } = refData
    if (!member_id || !plan_id) {
        console.error("Missing member_id or plan_id in external_reference"); return
    }

    // Idempotencia: evitar procesar el mismo pago dos veces
    const uniqueRef = `MP-MEMBER-${paymentId}`
    const { data: existingPayment } = await supabase
        .from('member_payments')
        .select('id')
        .eq('mp_payment_id', uniqueRef)
        .maybeSingle()

    if (existingPayment) {
        console.log(`Payment ${paymentId} already processed (idempotency). Skipping.`)
        return
    }

    // Obtener duración del plan
    const { data: plan } = await supabase
        .from('membership_plans')
        .select('duration_days, name, price')
        .eq('id', plan_id)
        .single()

    if (!plan) { console.error("Plan not found:", plan_id); return }

    // Obtener la fecha de vencimiento actual del miembro
    const { data: member } = await supabase
        .from('members')
        .select('id, end_date, tenant_id')
        .eq('id', member_id)
        .single()

    if (!member) { console.error("Member not found:", member_id); return }

    // Calcular nueva fecha: stacking desde max(hoy, end_date) + duration_days
    const today = new Date()
    const currentEnd = member.end_date ? new Date(member.end_date) : today
    const baseDate = currentEnd > today ? currentEnd : today
    const newEndDate = new Date(baseDate)
    newEndDate.setDate(newEndDate.getDate() + plan.duration_days)
    const newEndDateStr = newEndDate.toISOString().split('T')[0]

    // Actualizar end_date y forzar status = active
    const { error: updateError } = await supabase
        .from('members')
        .update({ end_date: newEndDateStr, status: 'active' })
        .eq('id', member_id)

    if (updateError) {
        console.error("Error updating member:", updateError)
        throw updateError
    }

    // Registrar pago en historial ANTES de confirmar OK a MP.
    // Si falla aquí, MP reintentará y el uniqueRef evitará doble extensión.
    const { error: paymentInsertError } = await supabase.from('member_payments').insert({
        member_id,
        plan_id,
        tenant_id: member.tenant_id,
        amount: p.transaction_amount || plan.price,
        mp_payment_id: uniqueRef,
        plan_name: plan.name,
        duration_days: plan.duration_days,
        new_end_date: newEndDateStr,
        paid_at: new Date().toISOString()
    })

    if (paymentInsertError) {
        // Error 23505 = ya existe (idempotencia) — el miembro ya fue renovado antes
        if (paymentInsertError.code === '23505') {
            console.log(`Payment ${paymentId} insert conflict — already recorded. OK.`)
            return
        }
        console.error("Error recording member payment:", paymentInsertError)
        throw paymentInsertError  // MP reintentará; member_update fue exitoso pero sin registro
    }

    console.log(`✅ Member ${member_id} renewed → plan "${plan.name}" (${plan.duration_days}d). New end_date: ${newEndDateStr}`)
}
