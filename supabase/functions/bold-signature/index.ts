

// LLAVE SECRETA DE BOLD (PROPORCIONADA)
const BOLD_SECRET_KEY = 'Q5IqRlVXbC3c2mBonLmKRQ';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // 1. Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    // Aceptamos orderId o order_id para compatibilidad
    const amount = body.amount;
    const orderId = body.orderId || body.order_id;
    const currency = body.currency || 'COP';

    if (!amount || !orderId) {
        throw new Error("Faltan datos requeridos: amount y orderId (o order_id)");
    }

    // 2. Preparar cadena (Concatenación exacta requerida por Bold)
    const amountStr = String(Math.round(Number(amount))); 
    const orderIdStr = String(orderId);                   
    const currencyStr = String(currency);                 

    const textToHash = `${orderIdStr}${amountStr}${currencyStr}${BOLD_SECRET_KEY}`;
    
    // 3. Generar SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 4. Hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const integritySignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`✅ Firma generada para orden: ${orderIdStr}`);

    return new Response(JSON.stringify({ integritySignature, hash: integritySignature }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("❌ Error en bold-signature:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

export {};
