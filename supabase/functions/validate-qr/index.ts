// Edge function: validate-qr
//
// Endpoint unificado de validación para el bouncer. Detecta automáticamente
// el formato del QR escaneado:
//
//   - Formato DINÁMICO:  `<order_id>:<timestamp>:<hmac>`
//     · Verifica HMAC con QR_HMAC_SECRET (timing-safe)
//     · Rechaza si ts > QR_WINDOW_SECONDS (default 60s)
//     · Resuelve order_number, luego invoca `validate_and_burn_ticket` RPC
//
//   - Formato LEGACY:    `MID-XXXXXX` (order_number plano)
//     · Pasa directo al RPC, manteniendo backward compat para tickets
//       generados antes de activar el QR dinámico.
//
// Body: { qr_payload: string, event_id: string (uuid) }
// Response idéntica al RPC actual: { status: 'success'|'used'|'invalid', message, customer_name?, order_number? }

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Formato dinámico: uuid : 10-digit-ts : 64-hex
const DYNAMIC_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{8,12}):([0-9a-f]{64})$/i;
const WINDOW_SECONDS_DEFAULT = 60;

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const qrRaw = String(body.qr_payload ?? '').trim();
    const eventId = String(body.event_id ?? '').trim();

    if (!qrRaw) return json({ status: 'invalid', message: '⚠️ QR vacío' });
    if (!UUID_RE.test(eventId)) return json({ status: 'invalid', message: '⚠️ Event ID inválido' });

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── Detectar formato dinámico ────────────────────────────────────────
    const dynMatch = qrRaw.match(DYNAMIC_RE);

    if (dynMatch) {
      // @ts-ignore
      const SECRET = Deno.env.get('QR_HMAC_SECRET');
      if (!SECRET) {
        return json({ status: 'invalid', message: '⚠️ QR rotativo sin server configurado' });
      }

      const [, orderId, tsStr, sig] = dynMatch;
      const ts = parseInt(tsStr, 10);
      const now = Math.floor(Date.now() / 1000);

      // @ts-ignore
      const windowS = parseInt(Deno.env.get('QR_WINDOW_SECONDS') ?? String(WINDOW_SECONDS_DEFAULT), 10);
      if (now - ts > windowS) {
        return json({ status: 'invalid', message: '⚠️ QR expirado (captura antigua)' });
      }
      if (ts - now > 5) {
        return json({ status: 'invalid', message: '⚠️ QR con timestamp futuro' });
      }

      // Resolver order para tener event_id real (necesario para HMAC payload)
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_number, event_id, used, status, customer_name')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) return json({ status: 'invalid', message: '⚠️ Orden no encontrada' });
      if (order.status !== 'completed') return json({ status: 'invalid', message: '⚠️ Pago no confirmado' });
      if (order.event_id !== eventId) return json({ status: 'invalid', message: '⚠️ QR de otro evento' });

      const expected = await hmacHex(SECRET, `${order.id}|${ts}|${order.event_id}`);
      if (!timingSafeEqual(expected, sig.toLowerCase())) {
        return json({ status: 'invalid', message: '⚠️ Firma QR inválida' });
      }

      if (order.used) return json({ status: 'used', message: '🚫 Boleto ya utilizado' });

      // Burn vía RPC (atómico) usando order_number resuelto
      return await burnTicket(supabase, order.order_number, eventId);
    }

    // ── Formato legacy (order_number plano) ──────────────────────────────
    const orderNumber = qrRaw.toUpperCase();
    return await burnTicket(supabase, orderNumber, eventId);

  } catch (err: any) {
    console.error('❌ validate-qr error:', err?.message ?? err);
    return json({ status: 'invalid', message: '⚠️ Error de conexión' });
  }
});

async function burnTicket(supabase: any, orderNumber: string, eventId: string): Promise<Response> {
  const { data, error } = await supabase.rpc('validate_and_burn_ticket', {
    p_order_number: orderNumber,
    p_event_id: eventId,
  });

  if (!error && data) {
    return json(data);
  }

  // Fallback manual si el RPC falla
  const { data: order } = await supabase
    .from('orders')
    .select('id, used, used_at, event_id, status, customer_name')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order) return json({ status: 'invalid', message: '⚠️ Boleto no encontrado' });
  if (order.status !== 'completed') return json({ status: 'invalid', message: '⚠️ Pago no confirmado' });
  if (order.event_id !== eventId) return json({ status: 'invalid', message: '⚠️ Boleto para otro evento' });
  if (order.used) return json({ status: 'used', message: '🚫 Boleto ya utilizado' });

  await supabase.from('orders').update({ used: true, used_at: new Date().toISOString() }).eq('id', order.id);
  return json({ status: 'success', message: `✅ ${order.customer_name || 'Acceso Permitido'}` });
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(body: any, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export {};
