
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
Deno.serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente con permisos de administración (Service Role)
    // Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en los secretos de tu Edge Function
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload = await req.json()
    console.log("🔔 WEBHOOK BOLD RECIBIDO:", JSON.stringify(payload));

    // Bold envía: payment_status, reference (order_number), etc.
    const { payment_status, reference } = payload;

    if (!reference) {
        throw new Error("No se encontró 'reference' (order_number) en el payload");
    }

    // Mapeo de estados de Bold a Midnight
    let newStatus = 'pending';
    if (payment_status === 'APPROVED') {
        newStatus = 'completed';
    } else if (['REJECTED', 'VOIDED', 'FAILED', 'DECLINED'].includes(payment_status)) {
        newStatus = 'failed';
    } else {
        // Estado intermedio o desconocido
        console.log(`ℹ️ Estado no terminal recibido: ${payment_status}`);
        return new Response(JSON.stringify({ message: "Status ignored", status: payment_status }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
        });
    }

    // Actualizar la orden en base de datos
    const { data, error } = await supabaseClient
        .from('orders')
        .update({ status: newStatus })
        .eq('order_number', reference)
        .select();

    if (error) {
        console.error("❌ Error actualizando DB:", error);
        throw error;
    }

    console.log(`✅ Orden ${reference} actualizada exitosamente a: ${newStatus}`);

    return new Response(JSON.stringify({ success: true, order: reference, status: newStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("❌ Error Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

export {};
