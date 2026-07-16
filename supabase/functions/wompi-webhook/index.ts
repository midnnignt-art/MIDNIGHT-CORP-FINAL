// Wompi — webhook handler
// ─────────────────────────────────────────────────────────────────────────
// Wompi nos POSTea un JSON con la estructura:
//   {
//     event: "transaction.updated",
//     data: { transaction: { id, status, reference, amount_in_cents, ... } },
//     sent_at, timestamp,
//     signature: { properties: ["transaction.id","transaction.status",...], checksum }
//   }
// Verificamos la firma del evento:
//   checksum = SHA-256( concat(values_of_properties) + timestamp + events_secret )
// Si la firma valida, actualizamos la registration correspondiente vía
// reference (que sigue el formato SOL-<orderNumber>).

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Lee el valor de una property notación dot. Wompi declara properties como
// "transaction.id" o "transaction.status" → bajamos por data[transaction][id].
function readDottedProperty(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj) ?? '';
}

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // @ts-ignore
    const EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET') ?? '';
    // @ts-ignore
    const REQUIRE_SIGNATURE = (Deno.env.get('WOMPI_WEBHOOK_REQUIRE_SIGNATURE') ?? 'true').toLowerCase() === 'true';

    const rawBody = await req.text();
    if (!rawBody) throw new Error('Body vacío');
    const payload = JSON.parse(rawBody);

    console.log('🔔 WEBHOOK WOMPI:', payload?.event, payload?.data?.transaction?.id);

    // ── Verificación de firma ────────────────────────────────────────────
    const sig = payload?.signature;
    if (EVENTS_SECRET && sig?.properties && sig?.checksum && payload.timestamp) {
      const concatValues = (sig.properties as string[])
        .map(p => readDottedProperty(payload.data, p))
        .join('');
      const expected = await sha256Hex(`${concatValues}${payload.timestamp}${EVENTS_SECRET}`);
      const provided = String(sig.checksum || '').toLowerCase();
      const valid = provided.length > 0 && timingSafeEqual(expected, provided);
      if (!valid) {
        if (REQUIRE_SIGNATURE) {
          console.error('❌ Firma inválida — rechazando');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }
        console.warn('⚠️ Firma inválida (modo soft)');
      } else {
        console.log('🔐 Firma de evento verificada');
      }
    } else if (REQUIRE_SIGNATURE) {
      console.error('❌ Evento sin firma o EVENTS_SECRET faltante — rechazando');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const tx = payload?.data?.transaction;
    const reference: string = tx?.reference ?? '';
    const txStatus: string = String(tx?.status ?? '').toUpperCase(); // APPROVED, DECLINED, VOIDED, ERROR
    const wompiTxId: string = tx?.id ?? null;
    // Monto REALMENTE cobrado por Wompi (en cents → pesos). Para one-shot es
    // el total; para cuotas es solo el adelanto ($40K). Usar esto evita
    // marcar amount_paid = total cuando solo se pagó el adelanto.
    const amountPaidCOP: number = tx?.amount_in_cents ? Math.round(Number(tx.amount_in_cents) / 100) : 0;

    if (!reference) {
      return new Response(JSON.stringify({ error: 'No reference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Mapeo de status de Wompi → status interno ────────────────────────
    let newStatus: 'active' | 'failed' | null = null;
    if (txStatus === 'APPROVED') newStatus = 'active';
    else if (['DECLINED', 'VOIDED', 'ERROR'].includes(txStatus)) newStatus = 'failed';

    if (!newStatus) {
      console.log(`ℹ️ Evento no terminal Wompi: ${txStatus} para ${reference}`);
      return new Response(JSON.stringify({ success: true, ignored: true, status: txStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Rama Solstice reservation: reference SOL-XXXXXX ──────────────────
    if (reference.startsWith('SOL-')) {
      const { data: reg, error: findErr } = await supabase
        .from('solstice_registrations')
        .select('id, total_amount, payment_mode')
        .eq('bold_order_id', reference) // re-usamos el campo (el nombre legacy queda)
        .maybeSingle();

      if (findErr || !reg) {
        console.error(`❌ Registration no encontrada para ref ${reference}`);
        return new Response(JSON.stringify({ error: 'registration not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Update — idempotente (si ya está activa con el mismo monto, no duplicamos)
      const patch: any = { status: newStatus };
      if (newStatus === 'active') {
        // Para one-shot (full_combo/individual_days) el monto cobrado ES el
        // total. Para cuotas es el adelanto — usamos el monto real de Wompi.
        const oneShot = reg.payment_mode === 'full_combo' || reg.payment_mode === 'individual_days';
        patch.amount_paid = oneShot ? reg.total_amount : (amountPaidCOP || 0);
        patch.wompi_transaction_id = wompiTxId;
      }
      const { error: upErr } = await supabase
        .from('solstice_registrations')
        .update(patch)
        .eq('id', reg.id);

      if (upErr) {
        console.error('❌ Update error:', upErr.message);
        return new Response(JSON.stringify({ error: upErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Si quedó activa, disparar email de confirmación (fire-and-forget)
      if (newStatus === 'active') {
        supabase.functions.invoke('send-solstice-confirmation', { body: { registration_id: reg.id } })
          .catch((e: any) => console.warn('send-solstice-confirmation falló:', e?.message));
      }

      console.log(`✅ Solstice ${reg.id} → ${newStatus}`);
      return new Response(JSON.stringify({ success: true, registration_id: reg.id, status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Rama MIDNIGHT ticket orders: reference = order_number (MID-XXXX) ──
    // orders usa 'completed' | 'failed' (no 'active'). Buscamos la orden
    // cabeza; si tiene group_id, actualizamos todo el grupo de forma atómica.
    const orderStatus = txStatus === 'APPROVED' ? 'completed' : 'failed';

    const { data: headOrder, error: findOrderErr } = await supabase
      .from('orders')
      .select('id, order_number, group_id, status, customer_email, customer_name, event_id')
      .eq('order_number', reference)
      .maybeSingle();

    if (findOrderErr || !headOrder) {
      console.log(`ℹ️ Reference ${reference} no es Solstice ni una orden MIDNIGHT — ignorada`);
      return new Response(JSON.stringify({ success: true, ignored: true, reference }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let updatedOrders: any[] = [];
    if (headOrder.group_id) {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: orderStatus, wompi_transaction_id: wompiTxId })
        .eq('group_id', headOrder.group_id)
        .neq('status', orderStatus)
        .select('id, order_number, customer_email, customer_name, event_id');
      if (error) throw error;
      updatedOrders = data ?? [];
    } else {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: orderStatus, wompi_transaction_id: wompiTxId })
        .eq('order_number', reference)
        .neq('status', orderStatus)
        .select('id, order_number, customer_email, customer_name, event_id');
      if (error) throw error;
      updatedOrders = data ?? [];
    }

    if (updatedOrders.length === 0) {
      console.log(`⚠️ Orden ${reference} ya estaba en ${orderStatus} — skip (webhook duplicado)`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (orderStatus === 'completed') {
      await sendTicketEmail(updatedOrders, supabase);
    }

    console.log(`✅ MIDNIGHT ${reference}: ${updatedOrders.length} órdenes → ${orderStatus}`);
    return new Response(JSON.stringify({ success: true, reference, status: orderStatus, updated: updatedOrders.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    // 500 para que Wompi REINTENTE ante un error transitorio (no dejar un pago
    // real sin confirmar por un blip de DB/red).
    console.error('❌ wompi-webhook CRÍTICO (500, se pedirá reintento):', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Envía el correo con las boletas (QR) de una orden MIDNIGHT ya pagada.
// Portado de bold-webhook para mantener el mismo formato de email.
async function sendTicketEmail(orders: any[], supabase: any) {
  // @ts-ignore
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const APP_URL = 'https://midnightcorp.click';
  const DOMAIN = 'midnightcorp.click';
  if (!RESEND_KEY || !orders[0]?.customer_email) return;

  const mainOrder = orders[0];
  const { data: event } = await supabase
    .from('events')
    .select('title, event_date, venue, city')
    .eq('id', mainOrder.event_id)
    .maybeSingle();

  const eventTitle = event?.title ?? 'Midnight Event';
  const eventDate  = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const eventVenue = event?.venue ?? '';
  const eventCity  = event?.city  ?? '';

  const ticketsHtml = orders.map((order: any, index: number) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order.order_number}`;
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
    `;
  }).join('');

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
  `;

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
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: `Midnight Corp <tickets@${DOMAIN}>`,
        to: [mainOrder.customer_email],
        subject: `TUS ENTRADAS: ${eventTitle}`,
        html,
      }),
    });
    const body = await res.json();
    if (res.ok) console.log(`📧 Email enviado a ${mainOrder.customer_email} | id: ${body.id}`);
    else console.error('❌ Error Resend:', JSON.stringify(body));
  } catch (err: any) {
    console.error('❌ Error de red al enviar email:', err.message);
  }
}

export {};
