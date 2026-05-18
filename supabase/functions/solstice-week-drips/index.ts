// Edge function: solstice-week-drips
//
// Job que corre 1×/día y manda emails contextuales a quienes tienen reserva
// activa para una semana que arranca en N días:
//
//   D-7  → "Falta 1 semana · checklist de qué llevar"
//   D-1  → "Mañana arranca · hora exacta + ubicación"
//   D+0  → "¡Llegaste! · qué pasa hoy"
//   D+1  → "Día 1 cerrado · qué viene"
//
// Idempotente vía solstice_drip_log con UNIQUE(registration_id, channel, kind).
//
// Agendar (Supabase Dashboard → Cron):
//   0 13 * * *  →  POST https://<project>.supabase.co/functions/v1/solstice-week-drips
//   (13 UTC = 8 AM Colombia)

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://midnightcorp.click';
const FROM    = 'Solstice <solstice@midnightcorp.click>';

type Kind = 'week_d_minus_7' | 'week_d_minus_1' | 'week_d_zero' | 'week_d_plus_1';

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

    const today = todayIso();
    const windows: { kind: Kind; targetDate: string }[] = [
      { kind: 'week_d_minus_7', targetDate: addDays(today, 7) },
      { kind: 'week_d_minus_1', targetDate: addDays(today, 1) },
      { kind: 'week_d_zero',    targetDate: today },
      { kind: 'week_d_plus_1',  targetDate: addDays(today, -1) },
    ];

    const results: Record<string, number> = {};
    for (const w of windows) {
      results[w.kind] = await processWindow(supabase, w.kind, w.targetDate);
    }

    return json({ ok: true, today, results });
  } catch (err: any) {
    console.error('solstice-week-drips error:', err?.message);
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});

async function processWindow(supabase: any, kind: Kind, targetDate: string): Promise<number> {
  // Buscar las weeks que arrancan exactamente en targetDate
  const { data: weeks } = await supabase
    .from('solstice_weeks')
    .select('id, university, start_date, end_date')
    .eq('start_date', targetDate);

  if (!weeks || weeks.length === 0) return 0;

  let sent = 0;
  for (const week of weeks) {
    // Buscar todas las registrations activas de esa week
    const { data: regs } = await supabase
      .from('solstice_registrations')
      .select('id, customer_name, customer_email, customer_phone, order_number')
      .eq('week_id', week.id)
      .in('status', ['active', 'reserved']);

    if (!regs) continue;

    for (const reg of regs) {
      if (!reg.customer_email) {
        await logSkip(supabase, reg.id, kind, 'no email');
        continue;
      }

      // Verificar idempotencia
      const { data: existing } = await supabase
        .from('solstice_drip_log')
        .select('id')
        .eq('registration_id', reg.id)
        .eq('channel', 'email')
        .eq('kind', kind)
        .maybeSingle();
      if (existing) continue;

      // @ts-ignore
      const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_KEY) {
        await logSkip(supabase, reg.id, kind, 'RESEND_API_KEY not configured');
        continue;
      }

      const ok = await sendEmail({
        apiKey: RESEND_KEY as string,
        to: reg.customer_email,
        kind,
        reg,
        week,
      });

      await supabase.from('solstice_drip_log').insert({
        registration_id: reg.id,
        channel:         'email',
        kind,
        status:          ok ? 'sent' : 'failed',
        recipient:       reg.customer_email,
        payload:         { week_id: week.id, university: week.university, start_date: week.start_date },
        error_message:   ok ? null : 'Resend API error',
      });

      if (ok) sent++;
    }
  }
  return sent;
}

async function logSkip(supabase: any, registrationId: string, kind: Kind, reason: string) {
  await supabase.from('solstice_drip_log').insert({
    registration_id: registrationId,
    channel:         'email',
    kind,
    status:          'skipped',
    error_message:   reason,
  });
}

interface SendArgs {
  apiKey: string;
  to: string;
  kind: Kind;
  reg: any;
  week: any;
}

async function sendEmail({ apiKey, to, kind, reg, week }: SendArgs): Promise<boolean> {
  const firstName = (reg.customer_name || '').split(' ')[0] || 'Pana';
  const uni       = week.university || '—';
  const startFmt  = new Date(week.start_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

  const config: Record<Kind, { subject: string; eyebrow: string; headline: string; body: string; cta: string }> = {
    week_d_minus_7: {
      subject:  `📍 Falta 1 semana · Solstice ${uni}`,
      eyebrow:  '7 días para el atardecer',
      headline: `${firstName}, ya casi`,
      body:     `
        Tu semana arranca el <strong>${startFmt}</strong>.<br/>
        <br/>
        <strong style="color:#E6392F;">Qué llevar:</strong>
        <ul style="color:#a0a0a8;padding-left:20px;line-height:1.8;">
          <li>Bloqueador SPF 50+ (la bahía no perdona)</li>
          <li>Cédula original — para el QR del catamarán</li>
          <li>Ropa para 5 noches + outfit "Día 3" (Catamarán)</li>
          <li>Repelente, gafas, sombrero, traje de baño</li>
          <li>Cargador para tu pase MIDNIGHT en el celular</li>
        </ul>
        <br/>
        En 24h te mandamos la ubicación exacta y el grupo de WhatsApp.
      `,
      cta: 'Ver mi reserva',
    },
    week_d_minus_1: {
      subject:  `⏰ Mañana arranca · todo lo que necesitas saber`,
      eyebrow:  'Es mañana, ${firstName}',
      headline: `Llegada · ${startFmt}`,
      body:     `
        <strong style="color:#E6392F;">Punto de encuentro:</strong> Te lo mandamos por WhatsApp esta noche con la ubicación pin.<br/>
        <br/>
        <strong style="color:#E6392F;">Hora de check-in:</strong> 4:00 PM<br/>
        <br/>
        <strong style="color:#E6392F;">Tu QR de acceso:</strong> ya está en tu correo. También podés acceder desde tu cuenta en Solstice — Mi Semana.<br/>
        <br/>
        Si no llegaste a pagar todo el combo, aún podés ponerte al día desde la app — el promotor revisa en el check-in.
      `,
      cta: 'Abrir mi pase',
    },
    week_d_zero: {
      subject:  `🌅 ¡Llegó el día! · Solstice ${uni}`,
      eyebrow:  'Hoy arrancamos',
      headline: `Bienvenido, ${firstName}`,
      body:     `
        Hoy es el Día 1 de tu Solstice. Bienvenido a Santa Marta.<br/>
        <br/>
        <strong style="color:#E6392F;">El plan de hoy:</strong>
        <ul style="color:#a0a0a8;padding-left:20px;line-height:1.8;">
          <li>Check-in 4:00–7:00 PM</li>
          <li>Apertura nocturna desde las 9 PM</li>
          <li>Equipo de Solstice ON SITE — pregunta lo que necesites</li>
        </ul>
        <br/>
        Hidratación constante, protector cada 2h, y disfruta. Nos vemos esta noche.
      `,
      cta: 'Ver programa',
    },
    week_d_plus_1: {
      subject:  `Día 1 cerrado · qué viene hoy`,
      eyebrow:  'Día 2',
      headline: `${firstName}, ¿cómo amaneces?`,
      body:     `
        Día 1 cerrado. Esperamos que estés con buena energía para lo que viene.<br/>
        <br/>
        <strong style="color:#E6392F;">Próximamente:</strong> mañana es el <strong>Catamarán (Día 3)</strong> — el día más esperado. Revisá tu reserva de lancha en Mi Semana y compartí el código de invitación con tus panas si todavía hay cupos.<br/>
        <br/>
        Si tienes preguntas, encuentras al equipo Solstice en el punto de encuentro entre 10 AM y 12 PM.
      `,
      cta: 'Ver mi lancha',
    },
  };

  const c = config[kind];
  const headlineRendered = c.headline.replace(/\$\{firstName\}/g, firstName);

  const html = `
<!DOCTYPE html>
<html><body style="background:#000;color:#F9F2D7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:32px;font-weight:300;letter-spacing:6px;text-transform:uppercase;color:#E6392F;font-family:'Georgia',serif;">SOLSTICE</h1>
      <p style="color:#606060;font-size:9px;margin-top:6px;letter-spacing:5px;font-weight:600;text-transform:uppercase;">Santa Marta · 2026 · ${uni}</p>
    </div>

    <div style="margin-bottom:32px;">
      <p style="color:#E6392F;font-size:10px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin:0 0 12px 0;">${c.eyebrow}</p>
      <h2 style="margin:0;font-size:30px;font-weight:300;letter-spacing:-0.5px;line-height:1.15;color:#F9F2D7;font-family:'Georgia',serif;">
        ${headlineRendered}
      </h2>
    </div>

    <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:24px;margin-bottom:24px;">
      <div style="color:#F9F2D7;font-size:14px;line-height:1.7;">
        ${c.body}
      </div>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/sol" style="display:inline-block;background:#E6392F;color:#fff;padding:15px 32px;border-radius:999px;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
