// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const body = await req.json();
    const registrationId = body.registration_id || body.id || null;

    if (!registrationId || typeof registrationId !== 'string') {
      return json({ error: 'registration_id required' }, 400);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
      return json({ error: 'invalid registration_id' }, 400);
    }

    // Re-leemos desde BD — nunca confiamos en el payload del frontend
    const { data: reg, error } = await supabase
      .from('solstice_registrations')
      .select('id, order_number, customer_name, customer_email, customer_university, payment_mode, total_amount, amount_paid, installments_remaining, status')
      .eq('id', registrationId)
      .maybeSingle();

    if (error || !reg) return json({ error: 'registration not found' }, 200);
    if (!reg.customer_email) return json({ skipped: true, reason: 'no_email' }, 200);

    // Buscar info de boat si aplica (leader o invitado)
    let boatInfo: { invite_code?: string; boat_name?: string; is_leader?: boolean } | null = null;
    const { data: passenger } = await supabase
      .from('solstice_boat_passengers')
      .select('boat_reservation_id, is_leader')
      .eq('registration_id', registrationId)
      .maybeSingle();
    if (passenger) {
      const { data: bres } = await supabase
        .from('solstice_boat_reservations')
        .select('invite_code, boat_id')
        .eq('id', passenger.boat_reservation_id)
        .maybeSingle();
      if (bres) {
        const { data: boat } = await supabase
          .from('solstice_boats')
          .select('name')
          .eq('id', bres.boat_id)
          .maybeSingle();
        boatInfo = { invite_code: bres.invite_code, boat_name: boat?.name, is_leader: passenger.is_leader };
      }
    }

    await sendConfirmation(reg, boatInfo);
    return json({ success: true, sent_to: reg.customer_email });
  } catch (err: any) {
    console.error('❌ Error send-solstice-confirmation:', err.message);
    return json({ error: err.message }, 200);
  }

  function json(payload: any, status = 200) {
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
})

async function sendConfirmation(reg: any, boat: any) {
  // @ts-ignore
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_KEY) {
    console.warn('⚠️ RESEND_API_KEY no configurada — email omitido');
    return;
  }

  const firstName = (reg.customer_name || '').split(' ')[0] || 'Tu pase';
  const modalityLabel: Record<string, string> = {
    'auto_subscription': 'Débito automático',
    'manual_monthly':    'Mes a mes con tarjeta',
    'cash_to_seller':    'Combo en efectivo',
    'individual_days':   'Días sueltos',
    'full_combo':        'Todo de una',
  };
  const modality = modalityLabel[reg.payment_mode] || reg.payment_mode || 'Combo';
  const totalK = Math.round((reg.total_amount || 0) / 1000);
  const paidK  = Math.round((reg.amount_paid  || 0) / 1000);
  const remaining = reg.installments_remaining || 0;

  const boatBlock = boat ? `
    <div style="background:linear-gradient(135deg,rgba(230,57,47,0.12) 0%,rgba(255,122,0,0.06) 100%);border:1px solid rgba(230,57,47,0.40);border-radius:20px;padding:24px 22px;margin:24px 0;">
      <p style="color:#E6392F;font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin:0 0 12px 0;">
        🚤 Tu lancha · ${boat.boat_name || 'Catamarán'}
      </p>
      ${boat.is_leader ? `
        <p style="color:#F9F2D7;font-size:13px;margin:0 0 14px 0;line-height:1.55;">
          Eres <strong>líder</strong>. Comparte este código con tus panas para que se sumen a tu lancha:
        </p>
        <div style="background:#000;border:1px dashed rgba(230,57,47,0.45);border-radius:14px;padding:18px;text-align:center;margin-bottom:14px;">
          <p style="font-family:'Courier New',monospace;font-size:28px;color:#F9F2D7;letter-spacing:8px;font-weight:700;margin:0;">
            ${boat.invite_code || ''}
          </p>
        </div>
        <a href="${APP_URL}/sol/i/${boat.invite_code}" style="display:inline-block;background:rgba(16,185,129,0.18);border:1px solid rgba(16,185,129,0.55);color:#10b981;padding:12px 18px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;text-decoration:none;">
          Compartir link →
        </a>
      ` : `
        <p style="color:#F9F2D7;font-size:13px;margin:0;line-height:1.55;">
          Te uniste a una lancha. Te avisamos cuando esté completa y la fecha exacta del Día 3.
        </p>
      `}
    </div>
  ` : '';

  const installmentsBlock = remaining > 0 ? `
    <div style="border-top:1px solid rgba(255,255,255,0.10);padding-top:20px;margin-top:20px;">
      <p style="color:#606060;font-size:9px;text-transform:uppercase;letter-spacing:3px;font-weight:600;margin:0 0 6px 0;">
        Próximas cuotas
      </p>
      <p style="color:#F9F2D7;font-size:14px;margin:0 0 4px 0;">
        Te quedan <strong style="color:#E6392F;">${remaining} cuota(s)</strong> · te avisaremos 24h antes de cada cobro
      </p>
      <p style="color:#606060;font-size:11px;margin:0;">
        Vas pagados $${paidK}K de $${totalK}K
      </p>
    </div>
  ` : '';

  const html = `
<!DOCTYPE html>
<html>
<body style="background:#000;color:#F9F2D7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:32px;font-weight:300;letter-spacing:6px;text-transform:uppercase;color:#E6392F;font-family:'Georgia',serif;">
        SOLSTICE
      </h1>
      <p style="color:#606060;font-size:9px;margin-top:6px;letter-spacing:5px;font-weight:600;text-transform:uppercase;">
        Santa Marta · 2026
      </p>
    </div>

    <div style="text-align:center;margin-bottom:36px;">
      <p style="color:#E6392F;font-size:10px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin:0 0 12px 0;">
        Reserva confirmada
      </p>
      <h2 style="margin:0;font-size:36px;font-weight:300;letter-spacing:-0.5px;line-height:1.05;color:#F9F2D7;font-family:'Georgia',serif;text-transform:uppercase;">
        Bienvenido,<br/>${firstName}
      </h2>
      <p style="color:#606060;margin:14px 0 0 0;font-size:14px;line-height:1.5;">
        Tu lugar en <strong style="color:#F9F2D7;">Solstice · ${reg.customer_university || 'tu semana'}</strong> está bloqueado.
      </p>
    </div>

    <div style="background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.10);border-radius:24px;padding:24px;margin-bottom:24px;">
      <div style="padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,0.06);">
        <p style="color:#E6392F;font-size:9px;text-transform:uppercase;letter-spacing:4px;font-weight:700;margin:0 0 4px 0;">
          Boarding Pass
        </p>
        <p style="color:#606060;font-size:11px;margin:0;font-family:'Courier New',monospace;letter-spacing:2px;">
          ${reg.order_number || '—'}
        </p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr><td style="padding:8px 0;color:#606060;font-size:10px;text-transform:uppercase;letter-spacing:3px;">Pasajero</td><td style="padding:8px 0;color:#F9F2D7;font-size:13px;text-align:right;font-weight:600;">${reg.customer_name || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#606060;font-size:10px;text-transform:uppercase;letter-spacing:3px;">Universidad</td><td style="padding:8px 0;color:#F9F2D7;font-size:13px;text-align:right;font-weight:600;">${reg.customer_university || '—'}</td></tr>
        <tr><td style="padding:8px 0;color:#606060;font-size:10px;text-transform:uppercase;letter-spacing:3px;">Modalidad</td><td style="padding:8px 0;color:#F9F2D7;font-size:13px;text-align:right;font-weight:600;">${modality}</td></tr>
        <tr><td style="padding:8px 0;color:#606060;font-size:10px;text-transform:uppercase;letter-spacing:3px;">Total combo</td><td style="padding:8px 0;color:#E6392F;font-size:13px;text-align:right;font-weight:600;">$${totalK}K</td></tr>
      </table>
      ${installmentsBlock}
    </div>

    ${boatBlock}

    <div style="background:rgba(255,255,255,0.025);border-radius:16px;padding:20px;margin-bottom:24px;">
      <p style="color:#E6392F;font-size:9px;text-transform:uppercase;letter-spacing:4px;font-weight:700;margin:0 0 16px 0;text-align:center;">
        Próximos pasos
      </p>
      <p style="color:#F9F2D7;font-size:13px;margin:0 0 8px 0;font-weight:600;">✉ Revisa tu inbox</p>
      <p style="color:#606060;font-size:11px;margin:0 0 16px 0;line-height:1.55;">Aquí mismo te llegará el QR de acceso unos días antes</p>
      <p style="color:#F9F2D7;font-size:13px;margin:0 0 8px 0;font-weight:600;">💬 WhatsApp activo</p>
      <p style="color:#606060;font-size:11px;margin:0 0 16px 0;line-height:1.55;">Te avisamos 24h antes de cada cobro automático</p>
      <p style="color:#F9F2D7;font-size:13px;margin:0 0 8px 0;font-weight:600;">🌅 Guía completa</p>
      <p style="color:#606060;font-size:11px;margin:0;line-height:1.55;">7 días antes del evento te mandamos qué llevar + cómo llegar</p>
    </div>

    <div style="text-align:center;margin:32px 0;">
      <a href="${APP_URL}/sol" style="display:inline-block;background:#E6392F;color:#fff;padding:16px 32px;border-radius:999px;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">
        Volver a Solstice
      </a>
    </div>

    <div style="text-align:center;margin-top:48px;padding-top:32px;border-top:1px solid rgba(255,255,255,0.08);">
      <p style="color:#444;font-size:9px;text-transform:uppercase;letter-spacing:3px;margin:0;">
        Solstice by Midnight Corp · ${new Date().getFullYear()}
      </p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [reg.customer_email],
        subject: `🌅 Reserva confirmada · Solstice ${reg.customer_university || ''}`,
        html,
      }),
    });
    const resBody = await res.json();
    if (res.ok) console.log(`📧 Solstice email enviado a ${reg.customer_email} | id: ${resBody.id}`);
    else console.error('❌ Resend error:', JSON.stringify(resBody));
  } catch (err: any) {
    console.error('❌ Network error:', err.message);
  }
}
