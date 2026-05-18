
// LLAVE SECRETA DE BOLD (PROPORCIONADA)
// @ts-ignore
const BOLD_SECRET_KEY = Deno.env.get('BOLD_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// @ts-ignore
Deno.serve(async (req) => {
  // 1. Manejo Explicito de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Lectura segura del Body
    // Usamos req.text() primero para evitar crashes si el body está vacío
    const rawBody = await req.text();
    if (!rawBody) {
        throw new Error("El cuerpo de la petición está vacío.");
    }
    
    const body = JSON.parse(rawBody);

    // 3. Extracción y validación de datos (server-side, no confiar en frontend)
    const rawAmount = body.amount;
    const rawOrderId = body.orderId || body.order_id;
    const currency = (body.currency || 'COP').trim();

    const numAmount = Number(rawAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 50_000_000) {
        console.error("❌ Monto inválido:", rawAmount);
        return new Response(JSON.stringify({
            error: 'Monto inválido (debe ser entero positivo ≤ 50M COP)'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    if (typeof rawOrderId !== 'string' || !/^[A-Z0-9-]{4,64}$/i.test(rawOrderId.trim())) {
        console.error("❌ OrderID inválido:", rawOrderId);
        return new Response(JSON.stringify({
            error: 'OrderID inválido'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
        console.error("❌ Moneda inválida:", currency);
        return new Response(JSON.stringify({
            error: 'Moneda inválida (ISO 4217)'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 4. Normalización (Crucial para que coincida con Bold)
    const amountInt = Math.round(numAmount);
    const amountStr = String(amountInt);

    const orderIdStr = String(rawOrderId).trim();
    const currencyStr = String(currency);

    // 5. Concatenación: OrderId + Monto + Moneda + Secreto
    const textToHash = `${orderIdStr}${amountStr}${currencyStr}${BOLD_SECRET_KEY}`;
    
    console.log(`🔐 Generando hash para Orden: ${orderIdStr} | Monto: ${amountStr}`);

    // 6. Generar SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 7. Convertir a Hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const integritySignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 8. Respuesta Exitosa
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
    console.error("❌ Error CRÍTICO en bold-signature:", error.message);
    
    // Devolvemos el error como JSON 200 para que el frontend lo muestre en el modal
    return new Response(JSON.stringify({ 
        error: `Error Interno del Servidor: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    })
  }
})

export {};
