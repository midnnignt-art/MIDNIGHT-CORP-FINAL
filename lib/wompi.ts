// Helpers para integración con Wompi (pasarela de pago alternativa a Bold)
// ─────────────────────────────────────────────────────────────────────────
// Solo la public key vive aquí — los secretos (private, integrity, events)
// están server-side en Supabase Edge Functions (env vars).
// La firma de integridad SIEMPRE se pide al edge function wompi-signature
// y nunca se computa en el browser.

import { supabase } from './supabase';

export const WOMPI_PUBLIC_KEY = 'ziawXYPuvGeOFmI69btsm3qjuGpfm0Qy';

// Web Checkout — base URL. Wompi mantiene este endpoint para flujos hosted.
const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';

interface CheckoutParams {
  reference: string;       // único por transacción (ej. SOL-AB12CD)
  amountCOP: number;       // monto en pesos COP (no en cents)
  customerEmail?: string;
  customerFullName?: string;
  customerPhone?: string;  // E.164 sin +
  redirectUrl: string;     // donde Wompi vuelve al cliente tras pagar
}

/**
 * Pide la firma de integridad al edge function y devuelve la URL completa
 * de Wompi Web Checkout lista para hacer window.location.href = url.
 * Convierte COP → cents y arma todos los query params requeridos.
 */
export async function buildWompiCheckoutUrl(params: CheckoutParams): Promise<string> {
  const amountInCents = Math.round(params.amountCOP * 100);

  // NOTA: el slug del edge function en Supabase quedó como 'swift-worker'
  // porque se deployó vía AI Assistant que genera slugs random. El display
  // name es 'wompi-signature' pero la URL real apunta a swift-worker. Si en
  // el futuro se redeploya con slug limpio, cambiar este string.
  const { data, error } = await supabase.functions.invoke('swift-worker', {
    body: {
      reference: params.reference,
      amount_in_cents: amountInCents,
      currency: 'COP',
    },
  });

  if (error) throw new Error(`Firma Wompi falló: ${error.message}`);
  if ((data as any)?.error) throw new Error(String((data as any).error));

  const sig = (data as any).integritySignature as string;
  if (!sig) throw new Error('Firma Wompi vacía');

  const qs = new URLSearchParams({
    'public-key':           WOMPI_PUBLIC_KEY,
    currency:               'COP',
    'amount-in-cents':      String(amountInCents),
    reference:              params.reference,
    'redirect-url':         params.redirectUrl,
    'signature:integrity':  sig,
  });
  if (params.customerEmail)    qs.set('customer-data:email',     params.customerEmail);
  if (params.customerFullName) qs.set('customer-data:full-name', params.customerFullName);
  if (params.customerPhone)    qs.set('customer-data:phone-number', params.customerPhone);

  return `${WOMPI_CHECKOUT_URL}?${qs.toString()}`;
}

/**
 * Lee los query params que Wompi setea cuando redirige de vuelta al cliente
 * tras un pago (success o fallido). Devuelve null si no hay info de Wompi.
 */
export function readWompiReturnParams(): {
  id: string;
  reference: string;
  status: string;       // APPROVED | DECLINED | VOIDED | ERROR | PENDING
} | null {
  const p = new URLSearchParams(window.location.search);
  const id        = p.get('id') || '';
  const reference = p.get('reference') || '';
  const status    = (p.get('status') || '').toUpperCase();
  if (!id && !reference) return null;
  return { id, reference, status };
}
