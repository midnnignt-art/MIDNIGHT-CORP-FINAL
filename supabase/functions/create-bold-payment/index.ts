

// @ts-ignore
const BOLD_SECRET_KEY = Deno.env.get('BOLD_SECRET_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // 1. Manejo de CORS (Permitir que tu frontend llame a esta función)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Recibir datos del Frontend
    const { amount, orderId, currency = 'COP' } = await req.json()

    // Validación server-side (el frontend NO es de confianza)
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 50_000_000) {
        throw new Error("Monto inválido (debe ser entero positivo ≤ 50M COP)");
    }
    if (typeof orderId !== 'string' || !/^[A-Z0-9-]{4,64}$/i.test(orderId)) {
        throw new Error("OrderID inválido");
    }
    if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
        throw new Error("Moneda inválida (debe ser ISO 4217, ej. COP)");
    }

    // 3. Preparar la cadena para encriptar
    // REGLA BOLD: Concatenar OrderId + Monto(Sin decimales) + Moneda + Secreto
    const amountStr = String(Math.round(numAmount));
    const orderIdStr = String(orderId);
    const currencyStr = String(currency);

    const textToHash = `${orderIdStr}${amountStr}${currencyStr}${BOLD_SECRET_KEY}`;
    
    // 4. Generar el Hash SHA-256 (Criptografía nativa del servidor)
    const encoder = new TextEncoder();
    const data = encoder.encode(textToHash);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // 5. Convertir a Hexadecimal (Lo que pide Bold)
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const integritySignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    console.log(`✅ Firma generada exitosamente para orden: ${orderIdStr}`);

    // 6. Devolver el hash al Frontend
    return new Response(JSON.stringify({ integritySignature }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("❌ Error generando firma Bold:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

export {};
