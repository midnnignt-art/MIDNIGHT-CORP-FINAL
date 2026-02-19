// @ts-ignore
const BOLD_API_KEY = 'K8mOAoWetfE5onyHWlhgvpLFcJIltm9Q64tZGv0Rmrs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // Manejo de CORS Preflight (necesario para llamadas desde el navegador)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { amount, orderId, email, description } = await req.json()

    // 1. Obtener Terminales Disponibles (Datáfonos Virtuales)
    // Esto se hace desde el servidor para evitar bloqueo CORS
    const termRes = await fetch('https://integrations.api.bold.co/payments/binded-terminals', {
      method: 'GET',
      headers: { 'Authorization': `x-api-key ${BOLD_API_KEY}` }
    });

    if (!termRes.ok) {
        const errorText = await termRes.text();
        throw new Error(`Bold Error (Terminals): ${errorText}`);
    }
    
    const termData = await termRes.json();
    const terminal = termData.payload?.available_terminals?.[0];

    if (!terminal) {
        throw new Error('No hay terminales activos en la cuenta de Sandbox de Bold.');
    }

    // 2. Crear la Transacción (Pay by Link)
    const payload = {
      amount: {
          currency: "COP",
          total_amount: Math.round(amount),
          taxes: [],
          tip_amount: 0
      },
      payment_method: "PAY_BY_LINK",
      terminal_model: terminal.terminal_model,
      terminal_serial: terminal.terminal_serial,
      reference: orderId,
      user_email: "pagos@midnightcorp.click",
      description: description,
      payer: {
          email: email
      }
    };

    const payRes = await fetch('https://integrations.api.bold.co/payments/app-checkout', {
        method: 'POST',
        headers: { 
            'Authorization': `x-api-key ${BOLD_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const payData = await payRes.json();

    if (!payRes.ok) {
        throw new Error(payData.errors?.[0]?.message || 'Bold rechazó la transacción.');
    }

    // Retornamos el éxito al frontend
    return new Response(JSON.stringify(payData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Bold Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})