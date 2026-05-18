// Edge function: wallet-pass
//
// Genera un pass para Google Wallet o Apple Wallet a partir de un order_id.
// - Valida que la orden existe y está completada
// - Re-lee los datos de la BD (no confía en el frontend)
// - Para Google: genera JWT firmado con service account → Save URL
// - Para Apple: stub (requiere certificados Pass Type ID que el operador debe
//   subir como secrets antes de activarlo)
//
// Env vars necesarias (ver `.env.example`):
//   GOOGLE_WALLET_ISSUER_ID                 (público, asignado por Google)
//   GOOGLE_WALLET_CLASS_ID                  (clase Event creada en Console)
//   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL     (del JSON del service account)
//   GOOGLE_WALLET_PRIVATE_KEY               (PEM del service account, con \n)
//   APPLE_PASS_TYPE_ID                      (TODO: pendiente)
//   APPLE_PASS_TEAM_ID                      (TODO: pendiente)
//   APPLE_PASS_CERT_P12_BASE64              (TODO: pendiente)
//   APPLE_PASS_CERT_PASSWORD                (TODO: pendiente)

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://midnightcorp.click'

interface OrderRow {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  event_id: string;
  status: string;
  total: number;
}

interface EventRow {
  id: string;
  title: string;
  cover_image: string;
  event_date: string;
  venue: string;
  city: string;
  doors_open?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const orderId = String(body.order_id ?? '').trim();
    const platform = String(body.platform ?? '').toLowerCase();

    if (!UUID_REGEX.test(orderId)) {
      return json({ error: 'Invalid order_id' }, 400);
    }
    if (platform !== 'apple' && platform !== 'google') {
      return json({ error: 'platform must be "apple" or "google"' }, 400);
    }

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Re-leer la orden server-side (no confiar en frontend)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_email, customer_name, event_id, status, total')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      return json({ error: 'Order not found' }, 404);
    }

    const typedOrder = order as OrderRow;

    if (typedOrder.status !== 'completed') {
      return json({ error: 'Order is not completed' }, 400);
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, cover_image, event_date, venue, city, doors_open')
      .eq('id', typedOrder.event_id)
      .maybeSingle();

    if (eventError || !event) {
      return json({ error: 'Event not found' }, 404);
    }

    if (platform === 'google') {
      return await handleGoogleWallet(typedOrder, event as EventRow);
    } else {
      return await handleAppleWallet(typedOrder, event as EventRow);
    }
  } catch (err: any) {
    console.error('❌ wallet-pass error:', err?.message ?? err);
    return json({ error: err?.message ?? 'Internal error' }, 500);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GOOGLE WALLET — JWT save link
// ────────────────────────────────────────────────────────────────────────────

async function handleGoogleWallet(order: OrderRow, event: EventRow): Promise<Response> {
  // @ts-ignore
  const ISSUER_ID = Deno.env.get('GOOGLE_WALLET_ISSUER_ID');
  // @ts-ignore
  const CLASS_ID  = Deno.env.get('GOOGLE_WALLET_CLASS_ID');
  // @ts-ignore
  const SA_EMAIL  = Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL');
  // @ts-ignore
  const SA_KEY    = Deno.env.get('GOOGLE_WALLET_PRIVATE_KEY');

  if (!ISSUER_ID || !CLASS_ID || !SA_EMAIL || !SA_KEY) {
    return json({
      error: 'Google Wallet no configurado',
      missing: ['GOOGLE_WALLET_ISSUER_ID', 'GOOGLE_WALLET_CLASS_ID', 'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_WALLET_PRIVATE_KEY']
        .filter(k => {
          // @ts-ignore
          return !Deno.env.get(k);
        }),
      docs: 'https://developers.google.com/wallet/tickets/events/web/prerequisites',
    }, 503);
  }

  const startDate = new Date(event.event_date);
  const doorsDate = event.doors_open ? new Date(event.doors_open) : startDate;

  const objectId = `${ISSUER_ID}.${order.order_number.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const classId  = `${ISSUER_ID}.${CLASS_ID}`;

  const eventTicketObject = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    barcode: {
      type: 'QR_CODE',
      value: order.order_number,
      alternateText: order.order_number,
    },
    ticketHolderName: order.customer_name || 'Midnight Holder',
    ticketNumber: order.order_number,
    eventName: {
      defaultValue: { language: 'es-CO', value: event.title },
    },
    venue: event.venue ? {
      name: { defaultValue: { language: 'es-CO', value: event.venue } },
      address: { defaultValue: { language: 'es-CO', value: event.city ?? '' } },
    } : undefined,
    dateTime: {
      start: doorsDate.toISOString(),
      end: new Date(startDate.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    },
    heroImage: event.cover_image ? {
      sourceUri: { uri: event.cover_image },
    } : undefined,
  };

  const claims = {
    iss: SA_EMAIL,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [APP_URL],
    payload: {
      eventTicketObjects: [eventTicketObject],
    },
  };

  const jwt = await signRs256(claims, SA_KEY);
  const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

  return json({ platform: 'google', saveUrl }, 200);
}

// ────────────────────────────────────────────────────────────────────────────
// APPLE WALLET — pendiente de certificados
// ────────────────────────────────────────────────────────────────────────────

async function handleAppleWallet(_order: OrderRow, _event: EventRow): Promise<Response> {
  // @ts-ignore
  const PASS_TYPE_ID = Deno.env.get('APPLE_PASS_TYPE_ID');
  // @ts-ignore
  const TEAM_ID      = Deno.env.get('APPLE_PASS_TEAM_ID');
  // @ts-ignore
  const CERT_B64     = Deno.env.get('APPLE_PASS_CERT_P12_BASE64');

  if (!PASS_TYPE_ID || !TEAM_ID || !CERT_B64) {
    return json({
      error: 'Apple Wallet no configurado',
      missing: ['APPLE_PASS_TYPE_ID', 'APPLE_PASS_TEAM_ID', 'APPLE_PASS_CERT_P12_BASE64', 'APPLE_PASS_CERT_PASSWORD']
        .filter(k => {
          // @ts-ignore
          return !Deno.env.get(k);
        }),
      docs: 'https://developer.apple.com/wallet/get-started/',
      step: 'Inscribirse en Apple Developer Program ($99/año), crear Pass Type ID, exportar certificado .p12, codificar en base64 y subirlo como secret en Supabase.',
    }, 503);
  }

  // TODO: implementación completa requiere:
  //   1. Parsear el .p12 (PKCS#12) para extraer cert + private key
  //      → npm:node-forge funciona en Deno
  //   2. Generar pass.json con campos del evento
  //   3. Calcular SHA1 de cada asset (logo.png, icon.png, strip.png)
  //   4. Firmar manifest.json con PKCS#7 detached signature
  //   5. Empaquetar todo en ZIP y devolver como .pkpass
  //
  // Cuando el operador configure las env vars, este TODO se implementa.
  // El cableado UI ya está listo — solo falta esta función.

  return json({
    error: 'Apple Wallet pass generation pending implementation',
    todo: 'Implementar generación de .pkpass (parse PKCS#12, sign manifest, ZIP)',
  }, 501);
}

// ────────────────────────────────────────────────────────────────────────────
// JWT RS256 (para Google Wallet)
// ────────────────────────────────────────────────────────────────────────────

async function signRs256(claims: Record<string, any>, pemPrivateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const enc = new TextEncoder();

  const encodeSegment = (obj: any) =>
    base64UrlEncode(enc.encode(JSON.stringify(obj)));

  const headerSeg = encodeSegment(header);
  const payloadSeg = encodeSegment(claims);
  const signingInput = `${headerSeg}.${payloadSeg}`;

  const key = await importRsaPrivateKey(pemPrivateKey);
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    enc.encode(signingInput),
  );
  const sigSeg = base64UrlEncode(new Uint8Array(sig));

  return `${signingInput}.${sigSeg}`;
}

async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  // El service account JSON guarda la key con \n literales; soportamos ambos
  const normalized = pem.replace(/\\n/g, '\n');
  const pkcs8 = pemToDer(normalized, 'PRIVATE KEY');
  return await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function pemToDer(pem: string, label: string): ArrayBuffer {
  const re = new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`);
  const match = pem.match(re);
  if (!match) throw new Error(`PEM "${label}" not found in private key`);
  const b64 = match[1].replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(body: any, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

export {};
