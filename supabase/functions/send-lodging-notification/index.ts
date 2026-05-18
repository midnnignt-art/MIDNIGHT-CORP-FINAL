// Edge function: send-lodging-notification
//
// Cuando un cliente reserva un hospedaje desde el upsell, llamamos a esta
// función para avisar al operador del hospedaje (o al ops fallback) por email
// — y mandamos confirmación al cliente.
//
// Body esperado:
//   { reservation_id: uuid }
//
// Re-lee la reserva desde BD (no confía en payload del frontend).
// Idempotente: marca el campo `notes` con `[notified:DATE]` para no duplicar.

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL  = 'https://midnightcorp.click';
const FROM     = 'Solstice <solstice@midnightcorp.click>';

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const reservationId = body.reservation_id || body.id || null;

    if (typeof reservationId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservationId)) {
      return json({ error: 'invalid reservation_id' }, 400);
    }

    const { data: res } = await supabase
      .from('solstice_lodging_reservations')
      .select('id, lodging_id, customer_name, customer_email, nights, guests, total_amount, status, notes, registration_id')
      .eq('id', reservationId)
      .maybeSingle();

    if (!res) return json({ error: 'reservation not found' }, 200);

    // Idempotencia: el `notes` debe contener "[notified:" después de mandar
    if ((res.notes || '').includes('[notified:')) {
      return json({ ok: true, skipped: true, reason: 'already_notified' });
    }

    const { data: lodging } = await supabase
      .from('solstice_lodgings')
      .select('name, image_url, address, owner_email, owner_phone, owner_name, price_per_night')
      .eq('id', res.lodging_id)
      .maybeSingle();

    let registration: any = null;
    if (res.registration_id) {
      const { data: reg } = await supabase
        .from('solstice_registrations')
        .select('order_number, customer_phone, customer_university, week_id, solstice_weeks(university, start_date, end_date)')
        .eq('id', res.registration_id)
        .maybeSingle();
      registration = reg;
    }

    // @ts-ignore
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    // @ts-ignore
    const OPS_FALLBACK = Deno.env.get('OPS_FALLBACK_EMAIL') ?? 'hospedaje@midnightcorp.click';

    if (!RESEND_KEY) {
      return json({ error: 'RESEND_API_KEY not configured', skipped: true }, 200);
    }

    const ownerTo = lodging?.owner_email || OPS_FALLBACK;
    const sentOwner    = await sendOwnerEmail(RESEND_KEY as string, ownerTo, res, lodging, registration);
    const sentCustomer = res.customer_email
      ? await sendCustomerEmail(RESEND_KEY as string, res.customer_email, res, lodging)
      : false;

    // Marcar como notificada
    const notesTag = `[notified:${new Date().toISOString().slice(0, 10)}]`;
    const newNotes = res.notes ? `${res.notes} ${notesTag}` : notesTag;
    await supabase
      .from('solstice_lodging_reservations')
      .update({ notes: newNotes })
      .eq('id', res.id);

    return json({
      ok: true,
      sentOwner,
      sentCustomer,
      ownerTo,
    });
  } catch (err: any) {
    console.error('send-lodging-notification error:', err?.message);
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});

async function sendOwnerEmail(apiKey: string, to: string, res: any, lodging: any, reg: any): Promise<boolean> {
  const totalK    = Math.round((res.total_amount || 0) / 1000);
  const startDate = reg?.solstice_weeks?.start_date
    ? new Date(reg.solstice_weeks.start_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'fecha por confirmar';
  const subject = `🛎️ Nueva reserva · ${res.customer_name || 'Cliente'} · ${lodging?.name || 'Hospedaje'}`;

  const html = `
<!DOCTYPE html><html><body style="background:#f5f5f5;color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:16px;padding:28px;">
      <p style="color:#E6392F;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin:0 0 8px 0;">
        Solstice 2026 · Nueva reserva
      </p>
      <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:700;line-height:1.2;color:#0a0a0a;">
        ${lodging?.name || 'Hospedaje'}
      </h1>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Cliente</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#0a0a0a;border-bottom:1px solid #eee;">${res.customer_name || '—'}</td></tr>
        <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Email</td><td style="padding:10px 0;text-align:right;font-weight:500;color:#0a0a0a;border-bottom:1px solid #eee;"><a href="mailto:${res.customer_email}" style="color:#E6392F;text-decoration:none;">${res.customer_email || '—'}</a></td></tr>
        ${reg?.customer_phone ? `<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Teléfono</td><td style="padding:10px 0;text-align:right;font-weight:500;color:#0a0a0a;border-bottom:1px solid #eee;"><a href="https://wa.me/${(reg.customer_phone || '').replace(/[^0-9+]/g, '')}" style="color:#10b981;text-decoration:none;">${reg.customer_phone}</a></td></tr>` : ''}
        ${reg?.customer_university ? `<tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Universidad</td><td style="padding:10px 0;text-align:right;font-weight:500;color:#0a0a0a;border-bottom:1px solid #eee;">${reg.customer_university}</td></tr>` : ''}
        <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Noches</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#0a0a0a;border-bottom:1px solid #eee;">${res.nights}</td></tr>
        <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Personas</td><td style="padding:10px 0;text-align:right;font-weight:600;color:#0a0a0a;border-bottom:1px solid #eee;">${res.guests}</td></tr>
        <tr><td style="padding:10px 0;color:#666;border-bottom:1px solid #eee;">Llegada</td><td style="padding:10px 0;text-align:right;font-weight:500;color:#0a0a0a;border-bottom:1px solid #eee;">${startDate}</td></tr>
        <tr><td style="padding:10px 0;color:#666;">Total estimado</td><td style="padding:10px 0;text-align:right;font-weight:700;color:#E6392F;">$${totalK}K COP</td></tr>
      </table>

      <div style="background:#fff5f4;border:1px solid #E6392F22;border-radius:12px;padding:14px;margin-top:24px;">
        <p style="color:#E6392F;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin:0 0 6px 0;">Próximos pasos</p>
        <p style="color:#0a0a0a;font-size:13px;line-height:1.55;margin:0;">
          Contactá al cliente en las próximas 24h para confirmar disponibilidad, método de pago directo, y coordinar entrega de llaves.
        </p>
      </div>

      <p style="color:#aaa;font-size:11px;text-align:center;margin-top:28px;">
        Reserva ID · ${res.id} · ${reg?.order_number ? `Orden ${reg.order_number}` : ''}
      </p>
    </div>
    <p style="text-align:center;color:#aaa;font-size:10px;text-transform:uppercase;letter-spacing:3px;margin-top:18px;">
      Solstice by Midnight Corp
    </p>
  </div>
</body></html>`;

  return await postResend(apiKey, FROM, [to], subject, html);
}

async function sendCustomerEmail(apiKey: string, to: string, res: any, lodging: any): Promise<boolean> {
  const totalK = Math.round((res.total_amount || 0) / 1000);

  const html = `
<!DOCTYPE html><html><body style="background:#000;color:#F9F2D7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:32px;font-weight:300;letter-spacing:6px;text-transform:uppercase;color:#E6392F;font-family:'Georgia',serif;">SOLSTICE</h1>
    </div>

    <div style="margin-bottom:32px;">
      <p style="color:#FFB48C;font-size:10px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin:0 0 12px 0;">🛎️ Hospedaje recibido</p>
      <h2 style="margin:0;font-size:30px;font-weight:300;letter-spacing:-0.5px;line-height:1.15;color:#F9F2D7;font-family:'Georgia',serif;">
        Tu hospedaje en<br/>${lodging?.name || 'Solstice'}
      </h2>
    </div>

    <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:22px;margin-bottom:24px;">
      <p style="color:#F9F2D7;font-size:14px;line-height:1.7;margin:0 0 16px 0;">
        Recibimos tu solicitud por <strong>${res.nights} ${res.nights === 1 ? 'noche' : 'noches'}</strong> en <strong>${lodging?.name}</strong>.
      </p>
      <p style="color:#a0a0a8;font-size:13px;line-height:1.7;margin:0;">
        En las próximas <strong style="color:#FFB48C;">24h</strong> el equipo te contactará por WhatsApp o email para:
      </p>
      <ul style="color:#a0a0a8;font-size:13px;padding-left:20px;line-height:1.9;margin:8px 0 0 0;">
        <li>Confirmar disponibilidad para tus fechas</li>
        <li>Acordar método de pago directo al hospedaje</li>
        <li>Coordinar check-in y entrega de llaves</li>
      </ul>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/sol" style="display:inline-block;background:#E6392F;color:#fff;padding:15px 32px;border-radius:999px;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">
        Ver mi reserva
      </a>
    </div>

    <p style="color:#606060;font-size:11px;text-align:center;margin-top:32px;">
      Total estimado · <strong style="color:#F9F2D7;">$${totalK}K COP</strong>
    </p>
    <p style="color:#444;font-size:9px;text-align:center;margin-top:12px;text-transform:uppercase;letter-spacing:3px;">
      Solstice by Midnight Corp
    </p>
  </div>
</body></html>`;

  return await postResend(apiKey, FROM, [to], `🛎️ Hospedaje recibido · ${lodging?.name}`, html);
}

async function postResend(apiKey: string, from: string, to: string[], subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.warn('Resend error:', await res.text());
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('Network error:', err?.message);
    return false;
  }
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
