import { Order, Event } from "../types";
import { supabase } from "../lib/supabase";

/**
 * Envía el email con los tickets QR.
 *
 * Delega en la edge function `send-ticket-email`, que ejecuta server-side
 * con la `RESEND_API_KEY` privada (ya NO se expone al frontend).
 *
 * La firma se conserva (`Order | Order[]`, `Event`) para no romper callsites
 * existentes. El `event` ya no es necesario porque la edge function lo
 * resuelve por `event_id`, pero lo aceptamos por compatibilidad.
 */
export const sendTicketEmail = async (
  orderOrOrders: Order | Order[],
  _event: Event
): Promise<boolean> => {
  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];

  if (orders.length === 0) return false;

  try {
    const { data, error } = await supabase.functions.invoke('send-ticket-email', {
      body: { orders },
    });

    if (error) {
      console.error("❌ Error invocando send-ticket-email:", error.message);
      return false;
    }

    if (data?.skipped) {
      console.log("ℹ️ Email omitido por la edge function:", data.reason ?? 'sin razón');
    }

    return true;
  } catch (err: any) {
    console.error("❌ Error de red invocando send-ticket-email:", err?.message ?? err);
    return false;
  }
};
