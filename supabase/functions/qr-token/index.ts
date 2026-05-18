// Edge function: qr-token
//
// Genera un token QR rotativo para una orden completada. El token tiene la
// forma `<order_id>:<timestamp>:<hmac>` y expira a los 60 segundos.
//
// El cliente del ticket pide un token cada 25-30s; el bouncer lo escanea y
// llama a `validate-qr` que valida HMAC + ventana de tiempo + estado de la orden.
//
// El payload está firmado con HMAC-SHA256 usando `QR_HMAC_SECRET` (server-side).
// Sin ese secret, esta función devuelve 503 y el cliente cae a QR estático
// con `order_number` (backward compat).
//
// Env vars necesarias:
//   QR_HMAC_SECRET             — string aleatorio largo (≥32 chars), server-side
//   SUPABASE_URL               — auto
//   SUPABASE_SERVICE_ROLE_KEY  — auto

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL_SECONDS = 60;

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const orderId = String(body.order_id ?? '').trim();

    if (!UUID_RE.test(orderId)) {
      return json({ error: 'Invalid order_id' }, 400);
    }

    // @ts-ignore
    const SECRET = Deno.env.get('QR_HMAC_SECRET');
    if (!SECRET) {
      return json({
        error: 'QR_HMAC_SECRET not configured',
        fallback: 'use_order_number',
      }, 503);
    }

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, event_id, order_number, used')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !order) return json({ error: 'Order not found' }, 404);
    if (order.status !== 'completed') return json({ error: 'Order not completed' }, 400);
    if (order.used) return json({ error: 'Ticket already used' }, 410);

    const ts = Math.floor(Date.now() / 1000);
    const payload = `${order.id}|${ts}|${order.event_id}`;
    const sig = await hmacHex(SECRET, payload);
    const token = `${order.id}:${ts}:${sig}`;

    return json({
      token,
      expires_at: ts + TOKEN_TTL_SECONDS,
      ttl: TOKEN_TTL_SECONDS,
    });
  } catch (err: any) {
    console.error('❌ qr-token error:', err?.message ?? err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function json(body: any, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export {};
