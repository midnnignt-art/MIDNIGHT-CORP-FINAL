// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // @ts-ignore
  const BOLD_API_KEY  = Deno.env.get('BOLD_API_KEY') ?? ''
  // @ts-ignore
  const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? ''
  // @ts-ignore
  const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  // @ts-ignore
  const RESEND_KEY    = Deno.env.get('RESEND_API_KEY') ?? ''

  if (!BOLD_API_KEY) {
    console.error('❌ BOLD_API_KEY no configurada')
    return new Response(JSON.stringify({ error: 'BOLD_API_KEY missing' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Órdenes Bold pendientes con más de 15 minutos
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const { data: staleOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, order_number, group_id, status, customer_email, customer_name, event_id, bold_payment_id, created_at')
    .eq('status', 'pending')
    .eq('payment_method', 'bold')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('❌ Error consultando órdenes:', fetchError.message)
    return new Response(JSON.stringify({ error: fetchError.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  if (!staleOrders || staleOrders.length === 0) {
    console.log('✅ No hay órdenes pendientes vencidas')
    return new Response(JSON.stringify({ message: 'No stale orders', checked: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  console.log(`🔍 ${staleOrders.length} órdenes pendientes con +15 min`)

  // Deduplicar: para grupos solo consulta Bold una vez (por el head order)
  const seen = new Set<string>()
  const toCheck: typeof staleOrders = []
  for (const order of staleOrders) {
    const key = order.group_id ?? order.order_number
    if (!seen.has(key)) {
      seen.add(key)
      toCheck.push(order)
    }
  }

  const results = { recovered: 0, failed: 0, still_pending: 0, errors: 0 }

  for (const headOrder of toCheck) {
    try {
      const boldStatus = await queryBoldPayment(headOrder.order_number, BOLD_API_KEY)

      if (boldStatus === null) {
        // Error de red / API no disponible — reintentar en el próximo ciclo
        results.errors++
        continue
      }

      if (boldStatus === 'APPROVED') {
        console.log(`💰 ${headOrder.order_number} APROBADO en Bold — completando...`)

        let updatedOrders: any[] = []

        if (headOrder.group_id) {
          const { data, error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('group_id', headOrder.group_id)
            .neq('status', 'completed')
            .select('id, order_number, customer_email, customer_name, event_id')
          if (error) throw error
          updatedOrders = data ?? []
        } else {
          const { data, error } = await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('order_number', headOrder.order_number)
            .neq('status', 'completed')
            .select('id, order_number, customer_email, customer_name, event_id')
          if (error) throw error
          updatedOrders = data ?? []
        }

        if (updatedOrders.length > 0) {
          await sendTicketEmail(updatedOrders, supabase, RESEND_KEY)
          console.log(`✅ ${headOrder.order_number} recuperado — email enviado`)
          results.recovered++
        }

      } else if (boldStatus === 'REJECTED' || boldStatus === 'FAILED' || boldStatus === 'VOIDED') {
        console.log(`❌ ${headOrder.order_number} RECHAZADO en Bold — marcando failed`)

        if (headOrder.group_id) {
          await supabase.from('orders').update({ status: 'failed' }).eq('group_id', headOrder.group_id)
        } else {
          await supabase.from('orders').update({ status: 'failed' }).eq('order_number', headOrder.order_number)
        }
        results.failed++

      } else if (boldStatus === 'NOT_FOUND') {
        // El usuario nunca completó el pago en Bold — después de 2 horas marcar failed
        const ageMinutes = (Date.now() - new Date(headOrder.created_at).getTime()) / 60000
        if (ageMinutes > 120) {
          console.log(`🗑️ ${headOrder.order_number} no existe en Bold y tiene ${Math.round(ageMinutes)} min — marcando failed`)
          if (headOrder.group_id) {
            await supabase.from('orders').update({ status: 'failed' }).eq('group_id', headOrder.group_id)
          } else {
            await supabase.from('orders').update({ status: 'failed' }).eq('order_number', headOrder.order_number)
          }
          results.failed++
        } else {
          console.log(`⏳ ${headOrder.order_number} no encontrada en Bold aún — esperando`)
          results.still_pending++
        }

      } else {
        // PENDING en Bold — el usuario aún no ha pagado
        console.log(`⏳ ${headOrder.order_number} sigue PENDING en Bold`)
        results.still_pending++
      }

    } catch (err: any) {
      console.error(`❌ Error procesando ${headOrder.order_number}:`, err.message)
      results.errors++
    }
  }

  console.log('🏁 Reconciliación completada:', results)

  return new Response(
    JSON.stringify({ success: true, checked: toCheck.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  )
})

/**
 * Consulta el estado de un pago en Bold por referencia (order_number).
 * Retorna: 'APPROVED' | 'REJECTED' | 'FAILED' | 'VOIDED' | 'PENDING' | 'NOT_FOUND' | null (error de red)
 *
 * Endpoint: GET https://integrations.bold.co/v2/transactions?referenceId={reference}
 * Auth: x-api-key {BOLD_API_KEY}  (obtener en Bold Dashboard → Integraciones → API Key)
 *
 * Si Bold cambia el endpoint, solo hay que actualizar esta función.
 */
async function queryBoldPayment(reference: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://integrations.bold.co/v2/transactions?referenceId=${encodeURIComponent(reference)}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    )

    if (res.status === 404) return 'NOT_FOUND'

    if (!res.ok) {
      console.error(`❌ Bold API error ${res.status} para ${reference}`)
      return null
    }

    const body = await res.json()

    // Bold puede devolver el estado en distintos niveles según el endpoint
    const status =
      body?.data?.[0]?.status ??      // lista con primer resultado
      body?.data?.status ??            // objeto directo
      body?.status ??                  // raíz
      'UNKNOWN'

    console.log(`📄 Bold status para ${reference}: ${status}`)
    return status.toUpperCase()

  } catch (err: any) {
    console.error(`❌ Error de red consultando Bold para ${reference}:`, err.message)
    return null  // null = no se pudo consultar, reintenta en el próximo ciclo
  }
}

async function sendTicketEmail(orders: any[], supabase: any, resendKey: string) {
  // @ts-ignore
  const DOMAIN  = 'midnightcorp.click'
  const APP_URL = 'https://midnightcorp.click'
  if (!resendKey || !orders[0]?.customer_email) return

  const mainOrder = orders[0]
  const { data: event } = await supabase
    .from('events')
    .select('title, event_date, venue, city')
    .eq('id', mainOrder.event_id)
    .maybeSingle()

  const eventTitle = event?.title ?? 'Midnight Event'
  const eventDate  = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  const eventVenue = event?.venue ?? ''
  const eventCity  = event?.city  ?? ''

  const ticketsHtml = orders.map((order: any, index: number) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order.order_number}`
    return `
      <div style="background:#fff;border-radius:24px;padding:20px;margin-bottom:30px;text-align:center;color:#000;">
        <p style="margin:0 0 15px;font-size:10px;font-weight:900;letter-spacing:2px;color:#490F7C;text-transform:uppercase;">
          Ticket ${index + 1} de ${orders.length}
        </p>
        <div style="display:inline-block;padding:10px;border:1px solid #f0f0f0;border-radius:16px;">
          <img src="${qrUrl}" alt="QR" style="display:block;width:220px;height:220px;"/>
        </div>
        <p style="font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;color:#000;opacity:.3;margin-top:15px;font-weight:bold;">
          ${order.order_number}
        </p>
      </div>
    `
  }).join('')

  const multiBlock = orders.length >= 2 ? `
    <div style="margin:40px 0;background:linear-gradient(135deg,#0d0022,#1a0444);border:1px solid rgba(176,38,255,.3);border-radius:20px;padding:28px 24px;">
      <p style="color:#b026ff;font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">Tus ${orders.length} entradas están disponibles online</p>
      <p style="color:#fff;font-size:14px;font-weight:900;margin:0 0 8px;line-height:1.3;">Accede a tu billetera de entradas</p>
      <a href="${APP_URL}" style="background:#b026ff;color:#fff;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;display:inline-block;">VER MIS ENTRADAS →</a>
    </div>
  ` : `
    <div style="margin:60px 0;text-align:center;border-top:1px solid rgba(255,255,255,.1);padding-top:40px;">
      <a href="${APP_URL}" style="background:#490F7C;color:#fff;padding:18px 36px;border-radius:100px;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;display:inline-block;">IR A MIDNIGHT</a>
    </div>
  `

  const html = `
    <!DOCTYPE html><html>
    <body style="background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:0;margin:0;">
      <div style="max-width:500px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:40px;">
          <h1 style="margin:0;font-size:24px;letter-spacing:10px;text-transform:uppercase;font-weight:900;">MIDNIGHT</h1>
          <p style="color:#490F7C;font-size:8px;margin-top:5px;letter-spacing:5px;font-weight:bold;">WORLDWIDE</p>
        </div>
        <div style="margin-bottom:40px;text-align:center;">
          <h2 style="margin:0;font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;line-height:1;">${eventTitle}</h2>
          <p style="color:#8E9299;margin:15px 0 0;font-size:14px;font-weight:500;">${eventDate}</p>
          <p style="color:#490F7C;margin:5px 0 0;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${eventVenue} • ${eventCity}</p>
        </div>
        <div>${ticketsHtml}</div>
        ${multiBlock}
        <div style="text-align:center;border-top:1px solid rgba(255,255,255,.1);padding-top:40px;">
          <p style="color:#444;font-size:9px;margin:0;line-height:1.6;">Presenta estos códigos en la entrada.<br/>© ${new Date().getFullYear()} MIDNIGHT CORP.</p>
        </div>
      </div>
    </body></html>
  `

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: `Midnight Corp <tickets@${DOMAIN}>`,
        to: [mainOrder.customer_email],
        subject: `TUS ENTRADAS: ${eventTitle}`,
        html,
      }),
    })
    const body = await res.json()
    if (res.ok) console.log(`📧 Email enviado a ${mainOrder.customer_email} | id: ${body.id}`)
    else console.error('❌ Error Resend:', JSON.stringify(body))
  } catch (err: any) {
    console.error('❌ Error de red al enviar email:', err.message)
  }
}

export {}
