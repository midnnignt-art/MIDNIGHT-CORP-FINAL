// Wompi — webhook handler
// ─────────────────────────────────────────────────────────────────────────
// Wompi nos POSTea un JSON con la estructura:
//   {
//     event: "transaction.updated",
//     data: { transaction: { id, status, reference, amount_in_cents, ... } },
//     sent_at, timestamp,
//     signature: { properties: ["transaction.id","transaction.status",...], checksum }
//   }
// Verificamos la firma del evento:
//   checksum = SHA-256( concat(values_of_properties) + timestamp + events_secret )
// Si la firma valida, actualizamos la registration correspondiente vía
// reference (que sigue el formato SOL-<orderNumber>).

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Lee el valor de una property notación dot. Wompi declara properties como
// "transaction.id" o "transaction.status" → bajamos por data[transaction][id].
function readDottedProperty(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj) ?? '';
}

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // @ts-ignore
    const EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET') ?? '';
    // @ts-ignore
    const REQUIRE_SIGNATURE = (Deno.env.get('WOMPI_WEBHOOK_REQUIRE_SIGNATURE') ?? 'true').toLowerCase() === 'true';

    const rawBody = await req.text();
    if (!rawBody) throw new Error('Body vacío');
    const payload = JSON.parse(rawBody);

    console.log('🔔 WEBHOOK WOMPI:', payload?.event, payload?.data?.transaction?.id);

    // ── Verificación de firma ────────────────────────────────────────────
    const sig = payload?.signature;
    if (EVENTS_SECRET && sig?.properties && sig?.checksum && payload.timestamp) {
      const concatValues = (sig.properties as string[])
        .map(p => readDottedProperty(payload.data, p))
        .join('');
      const expected = await sha256Hex(`${concatValues}${payload.timestamp}${EVENTS_SECRET}`);
      const provided = String(sig.checksum || '').toLowerCase();
      const valid = provided.length > 0 && timingSafeEqual(expected, provided);
      if (!valid) {
        if (REQUIRE_SIGNATURE) {
          console.error('❌ Firma inválida — rechazando');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }
        console.warn('⚠️ Firma inválida (modo soft)');
      } else {
        console.log('🔐 Firma de evento verificada');
      }
    } else if (REQUIRE_SIGNATURE) {
      console.error('❌ Evento sin firma o EVENTS_SECRET faltante — rechazando');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const tx = payload?.data?.transaction;
    const reference: string = tx?.reference ?? '';
    const txStatus: string = String(tx?.status ?? '').toUpperCase(); // APPROVED, DECLINED, VOIDED, ERROR
    const wompiTxId: string = tx?.id ?? null;
    // Monto REALMENTE cobrado por Wompi (en cents → pesos). Para one-shot es
    // el total; para cuotas es solo el adelanto ($40K). Usar esto evita
    // marcar amount_paid = total cuando solo se pagó el adelanto.
    const amountPaidCOP: number = tx?.amount_in_cents ? Math.round(Number(tx.amount_in_cents) / 100) : 0;

    if (!reference) {
      return new Response(JSON.stringify({ error: 'No reference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Mapeo de status de Wompi → status interno ────────────────────────
    let newStatus: 'active' | 'failed' | null = null;
    if (txStatus === 'APPROVED') newStatus = 'active';
    else if (['DECLINED', 'VOIDED', 'ERROR'].includes(txStatus)) newStatus = 'failed';

    if (!newStatus) {
      console.log(`ℹ️ Evento no terminal Wompi: ${txStatus} para ${reference}`);
      return new Response(JSON.stringify({ success: true, ignored: true, status: txStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Rama Solstice reservation: reference SOL-XXXXXX ──────────────────
    if (reference.startsWith('SOL-')) {
      const { data: reg, error: findErr } = await supabase
        .from('solstice_registrations')
        .select('id, total_amount, payment_mode')
        .eq('bold_order_id', reference) // re-usamos el campo (el nombre legacy queda)
        .maybeSingle();

      if (findErr || !reg) {
        console.error(`❌ Registration no encontrada para ref ${reference}`);
        return new Response(JSON.stringify({ error: 'registration not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Update — idempotente (si ya está activa con el mismo monto, no duplicamos)
      const patch: any = { status: newStatus };
      if (newStatus === 'active') {
        // Para one-shot (full_combo/individual_days) el monto cobrado ES el
        // total. Para cuotas es el adelanto — usamos el monto real de Wompi.
        const oneShot = reg.payment_mode === 'full_combo' || reg.payment_mode === 'individual_days';
        patch.amount_paid = oneShot ? reg.total_amount : (amountPaidCOP || 0);
        patch.wompi_transaction_id = wompiTxId;
      }
      const { error: upErr } = await supabase
        .from('solstice_registrations')
        .update(patch)
        .eq('id', reg.id);

      if (upErr) {
        console.error('❌ Update error:', upErr.message);
        return new Response(JSON.stringify({ error: upErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // Si quedó activa, disparar email de confirmación (fire-and-forget)
      if (newStatus === 'active') {
        supabase.functions.invoke('send-solstice-confirmation', { body: { registration_id: reg.id } })
          .catch((e: any) => console.warn('send-solstice-confirmation falló:', e?.message));
      }

      console.log(`✅ Solstice ${reg.id} → ${newStatus}`);
      return new Response(JSON.stringify({ success: true, registration_id: reg.id, status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── Otras referencias (MIDNIGHT ticket orders, etc) ──────────────────
    // El sistema actual usa Bold para MIDNIGHT — si en el futuro se quiere
    // habilitar Wompi para esa marca, replicar acá la lógica de orders.
    console.log(`ℹ️ Reference ${reference} no es Solstice — ignorada por ahora`);
    return new Response(JSON.stringify({ success: true, ignored_brand: true, reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('❌ wompi-webhook CRÍTICO:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});

export {};
