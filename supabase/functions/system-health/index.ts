// Edge function: system-health
//
// Devuelve el estado de configuración de cada feature del sistema sin exponer
// los valores reales de los secrets. Cada flag es booleano:
//   true  → el secret/feature está configurado
//   false → falta config (UI muestra rojo + pasos para activarlo)
//
// Esto permite al admin tener un "tablero de configuración" sin tocar
// Supabase Dashboard directamente.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // @ts-ignore
    const env = (k: string): boolean => Boolean(Deno.env.get(k));

    const features = {
      // ─── Bold (pagos) ───────────────────────────────────────────────
      bold: {
        secret_key: env('BOLD_SECRET_KEY'),
        api_key: env('BOLD_API_KEY'),
        webhook_secret: env('BOLD_WEBHOOK_SECRET') || env('BOLD_SECRET_KEY'),
        // @ts-ignore
        webhook_signature_required: (Deno.env.get('BOLD_WEBHOOK_REQUIRE_SIGNATURE') ?? 'false').toLowerCase() === 'true',
      },

      // ─── QR dinámico anti-reventa ──────────────────────────────────
      qr_dynamic: {
        configured: env('QR_HMAC_SECRET'),
        // @ts-ignore
        window_seconds: parseInt(Deno.env.get('QR_WINDOW_SECONDS') ?? '60', 10),
      },

      // ─── Email transaccional ────────────────────────────────────────
      resend: {
        configured: env('RESEND_API_KEY'),
      },

      // ─── Google Wallet ──────────────────────────────────────────────
      google_wallet: {
        issuer_id: env('GOOGLE_WALLET_ISSUER_ID'),
        class_id: env('GOOGLE_WALLET_CLASS_ID'),
        service_account: env('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL'),
        private_key: env('GOOGLE_WALLET_PRIVATE_KEY'),
        // configured solo si todos los 4 están
        configured: env('GOOGLE_WALLET_ISSUER_ID') && env('GOOGLE_WALLET_CLASS_ID') &&
                    env('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL') && env('GOOGLE_WALLET_PRIVATE_KEY'),
      },

      // ─── Apple Wallet ──────────────────────────────────────────────
      apple_wallet: {
        pass_type_id: env('APPLE_PASS_TYPE_ID'),
        team_id: env('APPLE_PASS_TEAM_ID'),
        cert_p12: env('APPLE_PASS_CERT_P12_BASE64'),
        cert_password: env('APPLE_PASS_CERT_PASSWORD'),
        // configured solo si todos los 4 están (Y aún falta implementación del .pkpass generator)
        configured: env('APPLE_PASS_TYPE_ID') && env('APPLE_PASS_TEAM_ID') &&
                    env('APPLE_PASS_CERT_P12_BASE64') && env('APPLE_PASS_CERT_PASSWORD'),
        implementation_pending: true, // El generator del .pkpass está TODO en wallet-pass
      },

      // ─── Supabase core ─────────────────────────────────────────────
      supabase: {
        url: env('SUPABASE_URL'),
        service_role: env('SUPABASE_SERVICE_ROLE_KEY'),
      },
    };

    return new Response(JSON.stringify({
      ok: true,
      timestamp: new Date().toISOString(),
      features,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

export {};
