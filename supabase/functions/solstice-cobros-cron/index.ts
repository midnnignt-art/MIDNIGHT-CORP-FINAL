// Edge function: solstice-cobros-cron
//
// Job que corre 1×/día y:
//   1) Marca como 'overdue' las cuotas con due_date < hoy y status='pending'
//   2) Envía recordatorio email a clientes con cuotas que vencen en N días
//      (N = solstice_penalties.whatsapp_reminder_days_before, default 3)
//   3) Envía aviso a clientes con cuotas overdue (3 escalones: 1, 3, 7 días)
//
// Idempotente: usa solstice_cobros_log con UNIQUE (schedule_id, channel, kind)
// para no duplicar mensajes si el cron corre múltiples veces.
//
// Cómo agendar:
//   - Supabase Dashboard → Database → Cron: `0 9 * * *` (9am UTC = 4am Colombia)
//   - O via pg_cron:  SELECT cron.schedule('solstice-cobros', '0 9 * * *',
//       $$ SELECT net.http_post('https://<project>.supabase.co/functions/v1/solstice-cobros-cron') $$);
//   - O manual desde el admin (botón "Procesar cobros ahora")
//
// Env vars:
//   RESEND_API_KEY                — email envío
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — provistos por Supabase

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://midnightcorp.click';
const FROM    = 'Solstice <solstice@midnightcorp.click>';

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

    // 1) Marcar overdue
    const { data: markRes, error: markErr } = await supabase.rpc('fn_mark_solstice_overdue');
    const markedOverdue = markErr ? 0 : (markRes as number || 0);

    // 2) Leer config de penalidades
    const { data: cfg } = await supabase
      .from('solstice_penalties')
      .select('whatsapp_reminder_days_before, grace_period_days, lock_combo_after_overdue')
      .eq('id', 1)
      .maybeSingle();
    const reminderDays = cfg?.whatsapp_reminder_days_before || 3;

    // 3) Recordatorios pre-vencimiento (cuotas que vencen en reminderDays días)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + reminderDays);
    const targetIso = targetDate.toISOString().slice(0, 10);

    const { data: upcoming } = await supabase
      .from('solstice_payment_schedules')
      .select('id, registration_id, installment_number, amount, due_date, status')
      .eq('status', 'pending')
      .eq('due_date', targetIso);

    let sentPre = 0;
    for (const sched of upcoming || []) {
      const sent = await sendIfNotLogged(supabase, sched, 'reminder_pre', 'email');
      if (sent) sentPre++;
    }

    // 4) Avisos de overdue (1, 3, 7 días después del vencimiento)
    const overdueWindows: { days: number; kind: 'overdue_1' | 'overdue_3' | 'overdue_7' }[] = [
      { days: 1, kind: 'overdue_1' },
      { days: 3, kind: 'overdue_3' },
      { days: 7, kind: 'overdue_7' },
    ];

    let sentOverdue = 0;
    for (const w of overdueWindows) {
      const d = new Date();
      d.setDate(d.getDate() - w.days);
      const iso = d.toISOString().slice(0, 10);
      const { data: rows } = await supabase
        .from('solstice_payment_schedules')
        .select('id, registration_id, installment_number, amount, due_date, status')
        .eq('status', 'overdue')
        .eq('due_date', iso);
      for (const sched of rows || []) {
        const sent = await sendIfNotLogged(supabase, sched, w.kind, 'email');
        if (sent) sentOverdue++;
      }
    }

    return json({
      ok: true,
      markedOverdue,
      sentPre,
      sentOverdue,
      reminderDays,
    });
  } catch (err: any) {
    console.error('solstice-cobros-cron error:', err?.message);
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});

async function sendIfNotLogged(
  supabase: any,
  schedule: any,
  kind: 'reminder_pre' | 'overdue_1' | 'overdue_3' | 'overdue_7',
  channel: 'email' | 'whatsapp',
): Promise<boolean> {
  // Verificar si ya se mandó este (schedule, channel, kind)
  const { data: existing } = await supabase
    .from('solstice_cobros_log')
    .select('id')
    .eq('schedule_id', schedule.id)
    .eq('channel', channel)
    .eq('kind', kind)
    .maybeSingle();

  if (existing) {
    return false;
  }

  // Cargar info de registration
  const { data: reg } = await supabase
    .from('solstice_registrations')
    .select('customer_name, customer_email, customer_phone, order_number, customer_university')
    .eq('id', schedule.registration_id)
    .maybeSingle();

  if (!reg?.customer_email) {
    await supabase.from('solstice_cobros_log').insert({
      schedule_id:     schedule.id,
      registration_id: schedule.registration_id,
      channel,
      kind,
      status:          'skipped',
      error_message:   'no email on registration',
    });
    return false;
  }

  // @ts-ignore
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    await supabase.from('solstice_cobros_log').insert({
      schedule_id:     schedule.id,
      registration_id: schedule.registration_id,
      channel,
      kind,
      status:          'skipped',
      error_message:   'RESEND_API_KEY not configured',
    });
    return false;
  }

  const sent = await sendEmail({
    apiKey:    RESEND_KEY as string,
    to:        reg.customer_email,
    kind,
    schedule,
    reg,
  });

  await supabase.from('solstice_cobros_log').insert({
    schedule_id:     schedule.id,
    registration_id: schedule.registration_id,
    channel,
    kind,
    status:          sent ? 'sent' : 'failed',
    recipient:       reg.customer_email,
    payload:         { amount: schedule.amount, due_date: schedule.due_date, installment_number: schedule.installment_number },
    error_message:   sent ? null : 'Resend API returned error',
  });

  return sent;
}

interface SendArgs {
  apiKey:   string;
  to:       string;
  kind:     'reminder_pre' | 'overdue_1' | 'overdue_3' | 'overdue_7';
  schedule: any;
  reg:      any;
}

async function sendEmail({ apiKey, to, kind, schedule, reg }: SendArgs): Promise<boolean> {
  const firstName = (reg.customer_name || '').split(' ')[0] || 'Pana';
  const amtK = Math.round((schedule.amount || 0) / 1000);
  const dueDateFmt = new Date(schedule.due_date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  const config: Record<typeof kind, { subject: string; eyebrow: string; headline: string; body: string; cta: string }> = {
    reminder_pre: {
      subject:  `Tu cuota Solstice vence ${dueDateFmt} · $${amtK}K`,
      eyebrow:  '⏰ Recordatorio amistoso',
      headline: `Hola ${firstName}, tu próxima cuota está cerca`,
      body:     `Tu cuota número ${schedule.installment_number} de <strong>$${amtK}K</strong> vence el <strong>${dueDateFmt}</strong>. Te recordamos para que no te tome por sorpresa — la tarjeta guardada se cobra automático el día del vencimiento.`,
      cta:      'Ver mi reserva',
    },
    overdue_1: {
      subject:  `Cuota vencida ayer · $${amtK}K · Solstice`,
      eyebrow:  '⚠️ Cuota vencida',
      headline: `${firstName}, no logramos cobrar tu cuota`,
      body:     `Tu cuota de <strong>$${amtK}K</strong> venció ayer. Tu tarjeta puede no tener fondos. Tenés <strong>7 días de gracia</strong> antes de que apliquemos recargo del 5%.`,
      cta:      'Pagar ahora',
    },
    overdue_3: {
      subject:  `Cuota vencida hace 3 días · Solstice`,
      eyebrow:  '🚨 Acción requerida',
      headline: `${firstName}, tu cuota lleva 3 días vencida`,
      body:     `Tu cuota de <strong>$${amtK}K</strong> sigue pendiente. Si llega a 7 días pasaremos a estado <strong>"bloqueado"</strong> y tu acceso al combo queda en revisión.`,
      cta:      'Regularizar ahora',
    },
    overdue_7: {
      subject:  `Último aviso · Acceso a Solstice en riesgo`,
      eyebrow:  '🛑 Última oportunidad',
      headline: `${firstName}, tu lugar está en riesgo`,
      body:     `Han pasado 7 días desde el vencimiento de tu cuota. Si no regularizás en las próximas 24h, tu acceso al combo queda <strong>bloqueado</strong> y perdés las Lanchas + Beach Club del Día 3. Escribinos por WhatsApp si necesitás más tiempo.`,
      cta:      'Hablar con Solstice',
    },
  };

  const c = config[kind];

  const html = `
<!DOCTYPE html>
<html><body style="background:#000;color:#F9F2D7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:32px;font-weight:300;letter-spacing:6px;text-transform:uppercase;color:#E6392F;font-family:'Georgia',serif;">SOLSTICE</h1>
      <p style="color:#606060;font-size:9px;margin-top:6px;letter-spacing:5px;font-weight:600;text-transform:uppercase;">Santa Marta · 2026</p>
    </div>

    <div style="margin-bottom:32px;">
      <p style="color:#E6392F;font-size:10px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin:0 0 12px 0;">${c.eyebrow}</p>
      <h2 style="margin:0;font-size:26px;font-weight:300;letter-spacing:-0.5px;line-height:1.15;color:#F9F2D7;font-family:'Georgia',serif;">${c.headline}</h2>
    </div>

    <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:24px;margin-bottom:24px;">
      <p style="color:#F9F2D7;font-size:14px;line-height:1.6;margin:0;">${c.body}</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="${APP_URL}/sol" style="display:inline-block;background:#E6392F;color:#fff;padding:16px 32px;border-radius:999px;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">
        ${c.cta}
      </a>
    </div>

    <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
      <p style="color:#606060;font-size:11px;line-height:1.5;margin:0 0 8px 0;">
        Orden: <span style="font-family:'Courier New',monospace;color:#a0a0a8;">${reg.order_number || '—'}</span>
      </p>
      <p style="color:#444;font-size:9px;text-transform:uppercase;letter-spacing:3px;margin:0;">
        Solstice by Midnight Corp
      </p>
    </div>
  </div>
</body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to: [to], subject: c.subject, html }),
    });
    if (!res.ok) {
      console.warn('Resend error:', await res.text());
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('email send error:', err?.message);
    return false;
  }
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
