// Edge function: drip-campaigns
//
// Scheduler que dispara mensajes post-compra siguiendo la secuencia:
//   D0    → ticket + welcome (ya lo hace send-ticket-email)
//   D-7   → "Compartí con un amigo, te damos $10K crédito"
//   D-1   → dress code + dirección + cómo llegar
//   D+1   → encuesta NPS "¿Cómo fue tu noche?"
//   D+7   → aftermovie + sugerencia próximo evento
//   D+30  → re-engagement si no compró nada nuevo
//
// Pensada para ser invocada por un pg_cron job o por Vercel Cron cada hora.
// Lee `orders` + `events`, filtra órdenes que están en cada ventana, y
// envía email (Resend) y/o WhatsApp (Twilio si está configurado).
//
// Env vars necesarias:
//   RESEND_API_KEY                 — email
//   TWILIO_ACCOUNT_SID             — opcional, WhatsApp
//   TWILIO_AUTH_TOKEN              — opcional, WhatsApp
//   TWILIO_WHATSAPP_FROM           — opcional, ej "whatsapp:+14155238886"
//
// Estado: SCAFFOLD. La lógica de envío está cableada pero los templates
// son básicos. Cuando se active, refinar copy y agregar tabla
// `drip_campaign_log` para no duplicar envíos.

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // @ts-ignore
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_KEY) {
      return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 503);
    }

    const now = new Date();
    const results = {
      d_minus_7: 0,
      d_minus_1: 0,
      d_plus_1: 0,
      d_plus_7: 0,
      d_plus_30: 0,
      errors: 0,
    };

    // ─── Estrategia: por cada ventana, buscar órdenes elegibles ────────────
    // Por simplicidad usamos un range de ±1 hora en cada ventana para no
    // duplicar envíos cuando el cron corre cada hora.

    // Para todos los queries, traemos orden + evento

    // D-7 (7 días antes del evento)
    const sevenDaysAhead = addDays(now, 7);
    const sevenDaysAheadEnd = addHours(sevenDaysAhead, 1);
    results.d_minus_7 = await processWindow({
      supabase,
      label: 'D-7',
      startDate: sevenDaysAhead,
      endDate: sevenDaysAheadEnd,
      // @ts-ignore
      resendKey: RESEND_KEY,
      template: 'pre_event_referral',
    });

    // D-1 (1 día antes)
    const oneDayAhead = addDays(now, 1);
    const oneDayAheadEnd = addHours(oneDayAhead, 1);
    results.d_minus_1 = await processWindow({
      supabase,
      label: 'D-1',
      startDate: oneDayAhead,
      endDate: oneDayAheadEnd,
      // @ts-ignore
      resendKey: RESEND_KEY,
      template: 'event_reminder',
    });

    // D+1 (1 día después)
    const oneDayPast = addDays(now, -1);
    const oneDayPastEnd = addHours(oneDayPast, 1);
    results.d_plus_1 = await processWindow({
      supabase,
      label: 'D+1',
      startDate: oneDayPast,
      endDate: oneDayPastEnd,
      // @ts-ignore
      resendKey: RESEND_KEY,
      template: 'nps_survey',
    });

    return json({ ok: true, results });
  } catch (err: any) {
    console.error('drip-campaigns error:', err?.message ?? err);
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});

interface ProcessWindowArgs {
  supabase: any;
  label: string;
  startDate: Date;
  endDate: Date;
  resendKey: string;
  template: string;
}

async function processWindow(args: ProcessWindowArgs): Promise<number> {
  const { supabase, label, startDate, endDate, resendKey, template } = args;

  const { data: events } = await supabase
    .from('events')
    .select('id, title, venue, venue_address, city, event_date, doors_open, dress_code, cover_image')
    .gte('event_date', startDate.toISOString())
    .lt('event_date', endDate.toISOString())
    .eq('status', 'published');

  if (!events || events.length === 0) return 0;

  let count = 0;
  for (const event of events) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_name, total')
      .eq('event_id', event.id)
      .eq('status', 'completed');

    if (!orders) continue;

    // Dedup por email (un usuario puede tener varios tickets)
    const uniqueByEmail = new Map();
    for (const o of orders) {
      if (!o.customer_email) continue;
      if (!uniqueByEmail.has(o.customer_email)) uniqueByEmail.set(o.customer_email, o);
    }

    for (const order of uniqueByEmail.values()) {
      // TODO: chequear customer_preferences.email_optin antes de enviar
      // TODO: chequear drip_campaign_log para no duplicar
      try {
        await sendDripEmail(resendKey, template, order, event);
        count++;
      } catch (err) {
        console.warn(`[${label}] email failed for ${order.customer_email}:`, err);
      }
    }
  }
  console.log(`[drip-campaigns][${label}] sent: ${count}`);
  return count;
}

async function sendDripEmail(resendKey: string, template: string, order: any, event: any): Promise<void> {
  const subjects: Record<string, string> = {
    pre_event_referral: `🎉 Falta 1 semana para ${event.title} — invitá a un amigo`,
    event_reminder:     `Mañana es ${event.title} — todo lo que necesitás saber`,
    nps_survey:         `¿Cómo fue tu noche en ${event.title}?`,
  };

  const html = buildEmailTemplate(template, order, event);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: 'Midnight Corp <hello@midnightcorp.click>',
      to: [order.customer_email],
      subject: subjects[template] || 'Midnight Corp',
      html,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
}

function buildEmailTemplate(template: string, order: any, event: any): string {
  const eventTitle = (event.title ?? 'Tu evento').toUpperCase();
  const appUrl = 'https://midnightcorp.click';

  // Templates básicos. Refinar copy + diseño cuando se active.
  const bodies: Record<string, string> = {
    pre_event_referral: `
      <h2>Falta 1 semana para ${eventTitle}</h2>
      <p>Hola${order.customer_name ? ` ${order.customer_name.split(' ')[0]}` : ''},</p>
      <p>Falta menos para vernos. Si invitás a un amigo con tu link de referido y él compra, vos ganás <strong>$10.000 COP en crédito</strong>.</p>
      <p><a href="${appUrl}" style="background:#490F7C;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:bold;">Ver mi link de invitación →</a></p>`,
    event_reminder: `
      <h2>Mañana: ${eventTitle}</h2>
      <p>Hora de apertura: ${event.doors_open ?? '10:00 PM'}</p>
      <p>Ubicación: ${event.venue ?? ''} · ${event.city ?? ''}</p>
      ${event.venue_address ? `<p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue_address)}">Cómo llegar (Google Maps)</a></p>` : ''}
      <p>Dress code: ${event.dress_code ?? 'Strict Nightlife'}</p>
      <p>Tu QR ya está en tu billetera Midnight. Presentalo en la puerta.</p>
      <p><a href="${appUrl}" style="background:#490F7C;color:#fff;padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:bold;">Abrir mi entrada →</a></p>`,
    nps_survey: `
      <h2>¿Cómo fue tu noche en ${eventTitle}?</h2>
      <p>Tu opinión nos ayuda a hacer el próximo aún mejor.</p>
      <p><a href="${appUrl}/nps?o=${order.order_number}&s=10">😍 Increíble (10)</a> · <a href="${appUrl}/nps?o=${order.order_number}&s=7">👍 Bien (7)</a> · <a href="${appUrl}/nps?o=${order.order_number}&s=4">🤔 Mejorable (4)</a></p>`,
  };

  return `
    <!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:sans-serif;padding:40px 20px;">
      <div style="max-width:500px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="letter-spacing:10px;font-weight:900;">MIDNIGHT</h1>
          <p style="color:#490F7C;font-size:8px;letter-spacing:5px;font-weight:bold;">WORLDWIDE</p>
        </div>
        ${bodies[template] ?? '<p>—</p>'}
        <p style="color:#444;font-size:10px;margin-top:40px;text-align:center;">© ${new Date().getFullYear()} MIDNIGHT CORP</p>
      </div>
    </body></html>`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addHours(d: Date, n: number): Date {
  const r = new Date(d);
  r.setHours(r.getHours() + n);
  return r;
}

function json(body: any, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export {};
