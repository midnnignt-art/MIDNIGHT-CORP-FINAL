import { Order, Event } from "../types";

export const sendTicketEmail = async (order: Order, event: Event) => {
  // Configured in vite.config.ts
  const RESEND_KEY = process.env.RESEND_API_KEY;
  // Si no has configurado VERIFIED_DOMAIN en .env, usa uno por defecto o 'resend.dev' si sigues probando
  const DOMAIN = process.env.VERIFIED_DOMAIN || 'midnightcorp.click'; 

  if (!RESEND_KEY) {
    console.warn("⚠️ FALTA API KEY: Configura VITE_RESEND_API_KEY en tu archivo .env");
    return false;
  }

  // Generar lista de items HTML
  const itemsHtml = order.items.map(item => `
    <div style="border-bottom: 1px solid #333; padding: 10px 0; display: flex; justify-content: space-between;">
      <span style="color: #fff;">${item.quantity}x <strong style="color: #b026ff;">${item.tier_name}</strong></span>
      <span style="color: #ccc;">$${item.subtotal.toLocaleString()}</span>
    </div>
  `).join('');

  // Generar Código QR (apunta a la orden)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.order_number}`;

  // IMPORTANTE: El 'from' debe coincidir con el dominio verificado en Resend.
  // Ejemplo: 'tickets@midnighthq.com'
  const fromEmail = `tickets@${DOMAIN}`; 

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`
      },
      body: JSON.stringify({
        from: `Midnight Corp <${fromEmail}>`,
        to: [order.customer_email], // En producción (dominio verificado), esto envía a CUALQUIER email.
        subject: `CONFIRMADO: Acceso para ${event.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="background-color: #000000; color: #ffffff; font-family: 'Arial', sans-serif; padding: 20px;">
            
            <div style="max-width: 600px; margin: 0 auto; background-color: #111; border: 1px solid #333; border-radius: 20px; overflow: hidden;">
              
              <!-- HEADER -->
              <div style="background: linear-gradient(90deg, #b026ff 0%, #60a5fa 100%); padding: 4px;"></div>
              <div style="padding: 40px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 4px; text-transform: uppercase;">Midnight Corp</h1>
                <p style="color: #666; font-size: 12px; margin-top: 10px;">EXPERIENCE FINANCE PROTOCOL</p>
              </div>

              <!-- TICKET INFO -->
              <div style="padding: 0 40px;">
                <h2 style="color: #fff; margin-bottom: 5px;">${event.title}</h2>
                <p style="color: #999; margin-top: 0;">📅 ${new Date(event.event_date).toLocaleDateString()} • 📍 ${event.venue}</p>
                
                <div style="background-color: #000; border: 1px solid #333; border-radius: 10px; padding: 20px; margin: 30px 0; text-align: center;">
                  <p style="color: #666; font-size: 10px; text-transform: uppercase; margin-bottom: 10px;">Tu Código de Acceso</p>
                  <img src="${qrUrl}" alt="QR Code" style="border: 4px solid #fff; border-radius: 8px;" />
                  <p style="font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #b026ff; margin-top: 15px; font-weight: bold;">${order.order_number}</p>
                </div>

                <h3 style="border-bottom: 1px solid #333; padding-bottom: 10px; color: #888; font-size: 12px; text-transform: uppercase;">Resumen de Compra</h3>
                ${itemsHtml}
                
                <div style="margin-top: 20px; text-align: right;">
                  <span style="color: #666; font-size: 12px;">Total Pagado:</span>
                  <span style="font-size: 24px; font-weight: bold; color: #fff; margin-left: 10px;">$${order.total.toLocaleString()}</span>
                </div>
              </div>

              <!-- FOOTER -->
              <div style="background-color: #050505; padding: 30px; margin-top: 40px; text-align: center; border-top: 1px solid #222;">
                <p style="color: #444; font-size: 10px;">Presenta este código QR en la entrada. No compartas este correo.</p>
                <p style="color: #444; font-size: 10px;">&copy; ${new Date().getFullYear()} Midnight Corp.</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });

    if (res.ok) {
      console.log(`✅ Ticket enviado a ${order.customer_email}`);
      return true;
    } else {
      const errorData = await res.json();
      console.error("❌ Error Resend:", errorData);
      return false;
    }
  } catch (error) {
    console.error("❌ Error de red:", error);
    return false;
  }
};