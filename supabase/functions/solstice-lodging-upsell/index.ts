// Edge function: solstice-lodging-upsell
//
// Job que corre 1×/día y manda email con la lista de hospedajes a clientes que
// confirmaron reserva HACE 1 DÍA. Es un upsell "no agresivo" — se manda 24h
// después de la compra para no saturar el flow de confirmación.
//
// Idempotente vía solstice_drip_log con UNIQUE(registration_id, channel, kind='lodging_upsell').
//
// Agendar (Supabase Cron):  0 14 * * *  (14 UTC = 9 AM Colombia)

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

    // Ventana: registrations creadas entre hace 25h y hace 23h (1 día atrás ± 1h)
    const now = Date.now();
    const startIso = new Date(now - 25 * 3600_000).toISOString();
    const endIso   = new Date(now - 23 * 3600_000).toISOString();

    const { data: regs } = await supabase
      .from('solstice_registrations')
      .select('id, customer_name, customer_email, customer_university, order_number, status')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .in('status', ['active', 'reserved']);

    if (!regs || regs.length === 0) {
      return json({ ok: true, sent: 0, window: { startIso, endIso } });
    }

    // Cargamos los hospedajes activos del catálogo (una vez)
    const { data: lodgings } = await supabase
      .from('solstice_lodgings')
      .select('id, name, image_url, description, price_per_night, address, category, google_maps_url')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .limit(8);

    if (!lodgings || lodgings.length === 0) {
      return json({ ok: true, sent: 0, reason: 'no_lodgings' });
    }

    // @ts-ignore
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_KEY) {
      return json({ ok: false, error: 'RESEND_API_KEY not configured' }, 503);
    }

    let sent = 0;
    for (const reg of regs) {
      if (!reg.customer_email) continue;

      // Idempotencia
      const { data: existing } = await supabase
        .from('solstice_drip_log')
        .select('id')
        .eq('registration_id', reg.id)
        .eq('channel', 'email')
        .eq('kind', 'lodging_upsell')
        .maybeSingle();
      if (existing) continue;

      // Verificar si ya tiene hospedaje reservado — si sí, no spamear
      const { data: hasLodge } = await supabase
        .from('solstice_lodging_reservations')
        .select('id')
        .eq('registration_id', reg.id)
        .limit(1)
        .maybeSingle();
      if (hasLodge) {
        await supabase.from('solstice_drip_log').insert({
          registration_id: reg.id,
          channel: 'email',
          kind: 'lodging_upsell',
          status: 'skipped',
          error_message: 'already has lodging',
        });
        continue;
      }

      const ok = await sendUpsell(RESEND_KEY as string, reg.customer_email, reg, lodgings);
      await supabase.from('solstice_drip_log').insert({
        registration_id: reg.id,
        channel: 'email',
        kind: 'lodging_upsell',
        status: ok ? 'sent' : 'failed',
        recipient: reg.customer_email,
      });
      if (ok) sent++;
    }

    return json({ ok: true, sent, considered: regs.length });
  } catch (err: any) {
    console.error('solstice-lodging-upsell error:', err?.message);
    return json({ ok: false, error: err?.message ?? 'Internal error' }, 500);
  }
});

async function sendUpsell(apiKey: string, to: string, reg: any, lodgings: any[]): Promise<boolean> {
  const firstName = (reg.customer_name || '').split(' ')[0] || 'Pana';
  const uni       = reg.customer_university || 'Solstice';

  const lodgingCards = lodgings.slice(0, 6).map(l => {
    const priceK = Math.round((l.price_per_night || 0) / 1000);
    const imgBlock = l.image_url
      ? `<img src="${l.image_url}" alt="${escapeHtml(l.name)}" style="width:100%;height:160px;object-fit:cover;display:block;border-radius:14px 14px 0 0;" />`
      : `<div style="width:100%;height:160px;background:linear-gradient(135deg,rgba(255,180,140,0.25),rgba(255,180,140,0.05));display:flex;align-items:center;justify-content:center;border-radius:14px 14px 0 0;font-size:36px;">🛎️</div>`;
    return `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:14px;overflow:hidden;margin-bottom:14px;">
        ${imgBlock}
        <div style="padding:16px;">
          <p style="margin:0 0 4px 0;color:#FFB48C;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;font-weight:700;">${escapeHtml(l.category || 'standard')}</p>
          <h3 style="margin:0;color:#F9F2D7;font-size:16px;font-weight:600;letter-spacing:0.02em;">${escapeHtml(l.name)}</h3>
          ${l.description ? `<p style="margin:8px 0 0 0;color:#a0a0a8;font-size:11px;line-height:1.5;">${escapeHtml(l.description)}</p>` : ''}
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px;">
            <span style="color:#E6392F;font-size:18px;font-weight:600;">$${priceK}K</span>
            <span style="color:#606060;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;">/ noche</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html><body style="background:#000;color:#F9F2D7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:32px;font-weight:300;letter-spacing:6px;text-transform:uppercase;color:#E6392F;font-family:'Georgia',serif;">SOLSTICE</h1>
      <p style="color:#606060;font-size:9px;margin-top:6px;letter-spacing:5px;font-weight:600;text-transform:uppercase;">${escapeHtml(uni)} · 2026</p>
    </div>

    <div style="margin-bottom:32px;text-align:center;">
      <p style="color:#FFB48C;font-size:10px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin:0 0 12px 0;">
        🛎️ ¿Dónde te quedás?
      </p>
      <h2 style="margin:0;font-size:30px;font-weight:300;letter-spacing:-0.5px;line-height:1.15;color:#F9F2D7;font-family:'Georgia',serif;">
        ${firstName}, te buscamos<br/>los mejores spots
      </h2>
      <p style="margin:16px auto 0 auto;max-width:380px;color:#a0a0a8;font-size:13px;line-height:1.6;">
        Tu combo está confirmado. Te dejamos una curaduría de hospedajes cerca al evento — reservás directo con el operador, sin intermediarios.
      </p>
    </div>

    ${lodgingCards}

    <div style="text-align:center;margin:28px 0;">
      <a href="${APP_URL}/sol" style="display:inline-block;background:#E6392F;color:#fff;padding:16px 32px;border-radius:999px;text-decoration:none;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">
        Ver todos los hospedajes
      </a>
    </div>

    <p style="text-align:center;color:#606060;font-size:11px;line-height:1.6;margin-top:24px;">
      Los precios son por noche y los confirma el operador al recibir tu solicitud.
    </p>

    <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);">
      <p style="color:#606060;font-size:11px;line-height:1.5;margin:0 0 8px 0;">
        Orden: <span style="font-family:'Courier New',monospace;color:#a0a0a8;">${escapeHtml(reg.order_number || '—')}</span>
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
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: `🛎️ ${firstName}, te buscamos hospedaje para Solstice`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
