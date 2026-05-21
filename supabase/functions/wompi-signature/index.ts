// Wompi — firma de integridad (signature) para Web Checkout
// ─────────────────────────────────────────────────────────────────────────
// La integridad es el SHA-256 hex de:
//   reference + amount_in_cents + currency + integrity_secret
//
// El secret NUNCA debe quedar en el frontend — esta función vive en
// Supabase Edge para mantenerlo server-side. El cliente llama con
// { reference, amount, currency } y recibe el signature listo para
// adjuntar al checkout URL.

// @ts-ignore
const INTEGRITY_SECRET = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!INTEGRITY_SECRET) {
      throw new Error('WOMPI_INTEGRITY_SECRET no configurado en el ambiente');
    }

    const rawBody = await req.text();
    if (!rawBody) throw new Error('Body vacío');
    const body = JSON.parse(rawBody);

    const reference = String(body.reference || '').trim();
    const amountInCents = Number(body.amount_in_cents);
    const currency = String(body.currency || 'COP').trim().toUpperCase();

    if (!/^[A-Z0-9-]{4,64}$/i.test(reference)) {
      return new Response(JSON.stringify({ error: 'Reference inválida' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    if (!Number.isFinite(amountInCents) || amountInCents <= 0 || amountInCents > 5_000_000_000) {
      // 5_000_000_000 cents = $50M COP, cap razonable
      return new Response(JSON.stringify({ error: 'Monto inválido (entero positivo ≤ 50M COP en cents)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return new Response(JSON.stringify({ error: 'Moneda inválida (ISO 4217)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const amountStr = String(Math.round(amountInCents));
    const textToHash = `${reference}${amountStr}${currency}${INTEGRITY_SECRET}`;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(textToHash));
    const integritySignature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return new Response(JSON.stringify({
      integritySignature,
      reference,
      amount_in_cents: amountStr,
      currency,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('❌ wompi-signature error:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Error interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});

export {};
