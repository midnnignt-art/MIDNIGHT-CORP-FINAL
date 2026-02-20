
// LLAVE SECRETA DE BOLD (PROPORCIONADA)
const BOLD_SECRET_KEY = 'Q5IqRlVXbC3c2mBonLmKRQ';

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

    // 3. Extracción y validación de datos
    const rawAmount = body.amount;
    const rawOrderId = body.orderId || body.order_id;
    const currency = (body.currency || 'COP').trim();

    // Validación explícita
    if (!rawAmount || !rawOrderId) {
        console.error("❌ Faltan datos:", { rawAmount, rawOrderId });
        return new Response(JSON.stringify({ 
            error: `Datos incompletos. Recibido: Monto=${rawAmount}, OrderID=${rawOrderId}` 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, // IMPORTANTE: Devolvemos 200 para que el cliente lea el mensaje de error
        });
    }

    // 4. Normalización (Crucial para que coincida con Bold)
    // Eliminar decimales
    const amountInt = Math.round(Number(rawAmount));
    const amountStr = String(amountInt); 
    
    // Eliminar espacios
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
