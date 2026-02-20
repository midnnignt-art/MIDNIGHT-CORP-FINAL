
// LLAVE SECRETA DE BOLD (PROPORCIONADA)
const BOLD_SECRET_KEY = 'Q5IqRlVXbC3c2mBonLmKRQ';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// @ts-ignore
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json();
    
    // 1. Normalización estricta de datos (CRÍTICO PARA BOLD)
    const rawAmount = body.amount;
    const rawOrderId = body.orderId || body.order_id;
    const currency = (body.currency || 'COP').trim();

    if (!rawAmount || !rawOrderId) {
        throw new Error("Faltan datos requeridos: amount y orderId");
    }

    // Eliminar decimales y convertir a entero string
    const amountInt = Math.round(Number(rawAmount));
    const amountStr = String(amountInt); 
    
    // Eliminar espacios en blanco del ID
    const orderIdStr = String(rawOrderId).trim(); 
    const currencyStr = String(currency);                 

    // 2. Concatenación: OrderId + Monto + Moneda + Secreto
    const textToHash = `${orderIdStr}${amountStr}${currencyStr}${BOLD_SECRET_KEY}`;
    
    console.log(`🔐 Generando hash para: ${orderIdStr} | Monto: ${amountStr}`);

    // 3. Generar SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 4. Convertir a Hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const integritySignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 5. Retornar firma y valores normalizados (el frontend DEBE usar estos valores)
    return new Response(JSON.stringify({ 
        integritySignature, 
        hash: integritySignature,
        normalizedAmount: amountStr,
        normalizedOrderId: orderIdStr
    }), {
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
