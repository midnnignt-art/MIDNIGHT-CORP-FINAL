// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración de CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // Manejo de CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Crear cliente de Supabase (usando Service Role para permisos de escritura)
    // @ts-ignore
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Parsear el Body del Webhook de Bold
    const payload = await req.json()
    console.log("Recibido Webhook Bold:", payload)

    // Estructura esperada de Bold (Sandbox/Producción)
    // payload.payment_status puede ser: "APPROVED", "REJECTED", "VOIDED"
    // payload.reference: El ID de orden que enviamos (ej. MID-171234)
    
    const status = payload.payment_status;
    const orderRef = payload.reference;

    if (!orderRef) {
        throw new Error("No se encontró referencia de pago en el payload")
    }

    // 3. Lógica de Actualización
    if (status === 'APPROVED') {
        // Actualizar la orden a 'completed'
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: 'completed' })
            .eq('order_number', orderRef)

        if (error) throw error
        console.log(`Orden ${orderRef} marcada como COMPLETADA.`)
    } else if (status === 'REJECTED' || status === 'VOIDED') {
        // Actualizar la orden a 'failed'
        const { error } = await supabaseClient
            .from('orders')
            .update({ status: 'failed' })
            .eq('order_number', orderRef)
            
        if (error) throw error
        console.log(`Orden ${orderRef} marcada como FALLIDA.`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Error procesando webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})