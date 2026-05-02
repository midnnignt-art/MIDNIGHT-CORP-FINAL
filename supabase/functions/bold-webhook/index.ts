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

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log("🔔 WEBHOOK BOLD:", JSON.stringify(payload));

    const eventType      = payload.type;
    const reference      = payload?.data?.metadata?.reference;
    const boldPaymentId  = payload?.data?.payment_id ?? null;   // ej: "TTI0H5CMCVB"

    console.log(`📌 type="${eventType}" | reference="${reference}"`);

    if (!reference) {
      console.error("❌ No se encontró data.metadata.reference en el payload");
      return new Response(JSON.stringify({ error: "No reference found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let newStatus: string;
    if (eventType === 'SALE_APPROVED') {
      newStatus = 'completed';
    } else if (['SALE_REJECTED', 'SALE_VOIDED', 'SALE_FAILED', 'CHARGEBACK'].includes(eventType)) {
      newStatus = 'failed';
    } else {
      console.log(`ℹ️ Evento no terminal: ${eventType} — ignorado`);
      return new Response(JSON.stringify({ message: "Event ignored", type: eventType }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Buscar la orden cabeza (solo para obtener group_id y datos de email)
    const { data: headOrder, error: findError } = await supabase
      .from('orders')
      .select('id, order_number, group_id, status, customer_email, customer_name, event_id')
      .eq('order_number', reference)
      .maybeSingle();

    if (findError || !headOrder) {
      console.error("❌ Orden no encontrada:", reference, findError);
      return new Response(JSON.stringify({ error: `Orden ${reference} no encontrada` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let updatedOrders: any[] = [];

    if (headOrder.group_id) {
      // UPDATE atómico: solo actualiza si todavía NO tiene el status final
      // Esto evita que dos webhooks duplicados simultáneos envíen emails dobles
      const { data: groupUpdated, error: groupError } = await supabase
        .from('orders')
        .update({ status: newStatus, bold_payment_id: boldPaymentId })
        .eq('group_id', headOrder.group_id)
        .neq('status', newStatus)
        .select('id, order_number, customer_email, customer_name, event_id');

      if (groupError) throw groupError;

      updatedOrders = groupUpdated ?? [];

      if (updatedOrders.length === 0) {
        console.log(`⚠️ Grupo ${headOrder.group_id} ya tiene status ${newStatus} — skipping (duplicate webhook)`);
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      console.log(`✅ Grupo ${headOrder.group_id}: ${updatedOrders.length} órdenes → ${newStatus}`);
      updatedOrders.forEach((o: any) => console.log(`   · ${o.order_number}`));

    } else {
      // UPDATE atómico: solo actualiza si todavía NO tiene el status final
      const { data: singleUpdated, error: singleError } = await supabase
        .from('orders')
        .update({ status: newStatus, bold_payment_id: boldPaymentId })
        .eq('order_number', reference)
        .neq('status', newStatus)
        .select('id, order_number, customer_email, customer_name, event_id');

      if (singleError) throw singleError;

      if (!singleUpdated || singleUpdated.length === 0) {
        console.log(`⚠️ Orden ${reference} ya tiene status ${newStatus} — skipping (duplicate webhook)`);
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      updatedOrders = singleUpdated;
      console.log(`✅ Orden individual ${reference} → ${newStatus}`);
    }

    // Enviar email solo si el pago fue aprobado Y si realmente se actualizó algo
    if (newStatus === 'completed' && updatedOrders.length > 0) {
      await sendTicketEmail(updatedOrders, supabase);
    }

    return new Response(
      JSON.stringify({ success: true, reference, status: newStatus, updated: updatedOrders.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("❌ Error Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})

async function sendTicketEmail(orders: any[], supabase: any) {
  // @ts-ignore
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  const APP_URL = 'https://midnightcorp.click';
  const DOMAIN = 'midnightcorp.click';

  if (!RESEND_KEY) {
    console.warn("⚠️ RESEND_API_KEY no configurada — email omitido");
    return;
  }

  const mainOrder = orders[0];
  const customerEmail = mainOrder.customer_email;

  if (!customerEmail) {
    console.warn("⚠️ Sin email de cliente — email omitido");
    return;
  }

  // Obtener datos del evento
  const { data: event } = await supabase
    .from('events')
    .select('title, event_date, venue, city')
    .eq('id', mainOrder.event_id)
    .maybeSingle();

  const eventTitle   = event?.title    ?? 'Midnight Event';
  const eventDate    = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const eventVenue   = event?.venue ?? '';
  const eventCity    = event?.city  ?? '';

  const ticketsHtml = orders.map((order, index) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order.order_number}`;
    return `
      <div style="background-color:#ffffff;border-radius:24px;padding:20px;margin-bottom:30px;text-align:center;color:#000000;">
        <p style="margin:0 0 15px 0;font-size:10px;font-weight:900;letter-spacing:2px;color:#490F7C;text-transform:uppercase;">
          Ticket ${index + 1} de ${orders.length}
        </p>
        <div style="display:inline-block;padding:10px;border:1px solid #f0f0f0;border-radius:16px;">
          <img src="${qrUrl}" alt="QR Code" style="display:block;width:220px;height:220px;" />
        </div>
        <p style="font-family:'Courier New',monospace;font-size:14px;letter-spacing:4px;color:#000000;opacity:0.3;margin-top:15px;font-weight:bold;">
          ${order.order_number}
        </p>
      </div>
    `;
  }).join('');

  const multiTicketBlock = orders.length >= 2 ? `
    <div style="margin:40px 0;background:linear-gradient(135deg,#0d0022 0%,#1a0444 100%);border:1px solid rgba(176,38,255,0.3);border-radius:20px;padding:28px 24px;">
      <p style="color:#b026ff;font-size:9px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px 0;">
        Tus ${orders.length} entradas están disponibles online
      </p>
      <p style="color:#ffffff;font-size:14px;font-weight:900;margin:0 0 8px 0;line-height:1.3;">Accede a tu billetera de entradas</p>
      <p style="color:#8E9299;font-size:12px;line-height:1.7;margin:0 0 20px 0;">
        1. Ve a <strong style="color:#fff">${APP_URL}</strong><br/>
        2. Abre el menú (esquina superior derecha)<br/>
        3. Toca <strong style="color:#b026ff">"Acceso"</strong> e ingresa este correo<br/>
        4. Revisa tu bandeja de entrada para el código<br/>
        5. Toca <strong style="color:#fff">"Entradas"</strong> para ver todos tus QR
      </p>
      <a href="${APP_URL}" style="background-color:#b026ff;color:#ffffff;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;display:inline-block;">
        VER MIS ENTRADAS →
      </a>
    </div>
  ` : `
    <div style="margin:60px 0;text-align:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:40px;">
      <p style="color:#ffffff;font-size:14px;font-weight:bold;margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">
        Accede a tus entradas online
      </p>
      <p style="color:#8E9299;font-size:12px;line-height:1.6;margin-bottom:30px;">
        Puedes encontrar tu entrada iniciando sesión en nuestra plataforma.
      </p>
      <a href="${APP_URL}" style="background-color:#490F7C;color:#ffffff;padding:18px 36px;border-radius:100px;text-decoration:none;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;display:inline-block;">
        IR A MIDNIGHT
      </a>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="background-color:#000000;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:0;margin:0;">
      <div style="max-width:500px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:40px;">
          <h1 style="margin:0;font-size:24px;letter-spacing:10px;text-transform:uppercase;font-weight:900;color:#ffffff;">MIDNIGHT</h1>
          <p style="color:#490F7C;font-size:8px;margin-top:5px;letter-spacing:5px;font-weight:bold;">WORLDWIDE</p>
        </div>
        <div style="margin-bottom:40px;text-align:center;">
          <h2 style="margin:0;font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;line-height:1;">${eventTitle}</h2>
          <p style="color:#8E9299;margin:15px 0 0 0;font-size:14px;font-weight:500;">${eventDate}</p>
          <p style="color:#490F7C;margin:5px 0 0 0;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${eventVenue} • ${eventCity}</p>
        </div>
        <div>${ticketsHtml}</div>
        ${multiTicketBlock}
        <div style="text-align:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:40px;">
          <p style="color:#490F7C;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">
            Protocolo de Acceso Seguro
          </p>
          <p style="color:#444444;font-size:9px;margin:0;line-height:1.6;">
            Presenta estos códigos en la entrada.<br/>
            &copy; ${new Date().getFullYear()} MIDNIGHT CORP.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: `Midnight Corp <tickets@${DOMAIN}>`,
        to: [customerEmail],
        subject: `TUS ENTRADAS: ${eventTitle}`,
        html,
      }),
    });

    const resBody = await res.json();
    if (res.ok) {
      console.log(`📧 Email enviado a ${customerEmail} | id: ${resBody.id}`);
    } else {
      console.error("❌ Error Resend:", JSON.stringify(resBody));
    }
  } catch (err: any) {
    console.error("❌ Error de red al enviar email:", err.message);
  }
}

export {};
