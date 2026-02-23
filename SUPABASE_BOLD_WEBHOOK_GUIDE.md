# Guía de Configuración: Webhook de Bold para Midnight Corp

Para que el flujo de pagos funcione correctamente, debes crear una **Edge Function** en Supabase llamada `bold-webhook`. Esta función se encargará de recibir la confirmación de Bold, actualizar la orden a `completed` y enviar el correo con las boletas.

## 1. Código de la Edge Function (`bold-webhook`)

Crea un archivo `index.ts` dentro de la carpeta de la función en Supabase:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const BOLD_SECRET_KEY = Deno.env.get("BOLD_SECRET_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  // Bold envía un POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Bold Webhook Payload:", payload);

    const { reference, status } = payload;
    console.log(`Processing order ${reference} with status ${status}`);

    if (!reference) {
      return new Response('Missing reference', { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. Buscar la orden por order_number (reference)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('order_number', reference)
      .single();

    if (orderError || !order) {
      console.error("❌ Order not found in DB:", reference, orderError);
      return new Response('Order not found', { status: 200 }); 
    }

    console.log("Found order:", order.id, "Current status:", order.status);

    if (status === 'APPROVED') {
      // 2. Actualizar estado a 'completed'
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'completed'
        })
        .eq('id', order.id);

      if (updateError) {
        console.error("❌ Error updating order status:", updateError);
        throw updateError;
      }

      console.log("✅ Order status updated to completed");

      // 3. Actualizar Inventario y Estadísticas
      // Obtener el evento para actualizar totales
      const { data: event } = await supabase.from('events').select('*').eq('id', order.event_id).single();
      
      if (event) {
        const totalQty = order.items.reduce((acc: number, item: any) => acc + item.quantity, 0);
        await supabase.from('events').update({
          tickets_sold: (event.tickets_sold || 0) + totalQty,
          total_revenue: (event.total_revenue || 0) + order.total
        }).eq('id', event.id);
      }

      // Actualizar cada tier (inventario)
      for (const item of order.items) {
        const { data: tier } = await supabase.from('ticket_tiers').select('sold').eq('id', item.tier_id).single();
        if (tier) {
          await supabase.from('ticket_tiers').update({ sold: (tier.sold || 0) + item.quantity }).eq('id', item.tier_id);
        }
      }

      // Actualizar Promotor si aplica
      if (order.staff_id) {
        const { data: profile } = await supabase.from('profiles').select('total_sales, total_commission_earned').eq('id', order.staff_id).single();
        if (profile) {
          await supabase.from('profiles').update({
            total_sales: (profile.total_sales || 0) + order.total,
            total_commission_earned: (profile.total_commission_earned || 0) + order.commission_amount
          }).eq('id', order.staff_id);
        }
      }

      // 4. Enviar Email (Lógica simplificada de Resend)
      if (order.customer_email && order.customer_email.includes('@')) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'Midnight Corp <tickets@midnightcorp.click>',
            to: [order.customer_email],
            subject: `TUS ENTRADAS: ${event?.title || 'Midnight Event'}`,
            html: `<h1>¡Pago Aprobado!</h1><p>Tus entradas para ${event?.title} han sido generadas. Puedes verlas en la app.</p>`
            // Nota: Aquí deberías replicar el HTML completo que usas en el frontend
          })
        });
      }

      console.log("Order approved and processed:", reference);
    } else if (status === 'REJECTED' || status === 'FAILED') {
      await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', order.id);
      console.log("Order rejected:", reference);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
});
```

## 2. Variables de Entorno Requeridas

En tu dashboard de Supabase (Settings -> Edge Functions), añade estas variables:
- `BOLD_SECRET_KEY`: `6mI3Oc0mjR8_81kYK4qF8w`
- `RESEND_API_KEY`: Tu llave de Resend
- `SUPABASE_URL`: La URL de tu proyecto
- `SUPABASE_SERVICE_ROLE_KEY`: Tu llave de servicio (service_role) para saltar RLS

## 3. Configuración en Bold

En el panel de Bold, configura la URL del Webhook como:
`https://[TU_PROYECTO].supabase.co/functions/v1/bold-webhook`

---

**Nota sobre la consistencia:** He mantenido el estado `completed` para las órdenes aprobadas para que sea compatible con el resto de tu aplicación (Dashboard, Proyecciones, etc.), ya que toda la lógica actual depende de ese estado. En la interfaz de usuario se mostrará como "Aprobado".
