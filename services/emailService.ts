import { Order, Event } from "../types";

export const sendTicketEmail = async (order: Order, event: Event) => {
  // Configured in vite.config.ts or .env
  const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
  // Si no has configurado VERIFIED_DOMAIN en .env, usa uno por defecto o 'resend.dev' si sigues probando
  const DOMAIN = import.meta.env.VITE_VERIFIED_DOMAIN || 'midnightcorp.click'; 

  if (!RESEND_KEY) {
    console.warn("⚠️ FALTA API KEY: Configura VITE_RESEND_API_KEY en tu archivo .env");
    return false;
  }

  // Generar lista de items HTML
  const itemsHtml = order.items.map(item => `
    <div style="border-bottom: 1px solid rgba(73, 15, 124, 0.2); padding: 10px 0; display: flex; justify-content: space-between;">
      <span style="color: #fff; font-size: 14px;">${item.quantity}x <strong style="color: #ffffff;">${item.tier_name}</strong></span>
      <span style="color: #8E9299; font-size: 14px;">$${item.subtotal.toLocaleString()}</span>
    </div>
  `).join('');

  // Generar Código QR (apunta a la orden)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${order.order_number}`;

  // URL de la App para el botón
  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
  const walletUrl = `${APP_URL}/wallet`;

  // IMPORTANTE: El 'from' debe coincidir con el dominio verificado en Resend.
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
        to: [order.customer_email],
        subject: `CONFIRMADO: Acceso para ${event.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="background-color: #050505; color: #ffffff; font-family: 'Helvetica', Arial, sans-serif; padding: 20px; margin: 0;">
            
            <div style="max-width: 600px; margin: 0 auto; background-color: #0B0316; border: 1px solid #490F7C; border-radius: 32px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- HEADER -->
              <div style="padding: 40px; text-align: center; border-bottom: 1px solid rgba(73, 15, 124, 0.3);">
                <h1 style="margin: 0; font-size: 28px; letter-spacing: 8px; text-transform: uppercase; font-weight: 900; color: #ffffff;">MIDNIGHT</h1>
                <p style="color: #490F7C; font-size: 10px; margin-top: 10px; letter-spacing: 4px; font-weight: bold;">ACCESS PROTOCOL</p>
              </div>

              <!-- TICKET INFO -->
              <div style="padding: 40px;">
                <div style="margin-bottom: 30px;">
                    <h2 style="color: #fff; margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px;">${event.title}</h2>
                    <p style="color: #8E9299; margin: 8px 0 0 0; font-size: 14px; font-weight: bold;">
                        ${new Date(event.event_date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p style="color: #490F7C; margin: 4px 0 0 0; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                        📍 ${event.venue} • ${event.city}
                    </p>
                </div>
                
                <div style="background: linear-gradient(135deg, #0B0316 0%, #161344 100%); border: 1px solid rgba(73, 15, 124, 0.6); border-radius: 24px; padding: 30px; margin: 30px 0; text-align: center;">
                  <p style="color: #F2F2F2; opacity: 0.5; font-size: 10px; text-transform: uppercase; margin-bottom: 20px; letter-spacing: 2px; font-weight: bold;">Código de Acceso Único</p>
                  <div style="background-color: #ffffff; padding: 15px; display: inline-block; border-radius: 16px;">
                    <img src="${qrUrl}" alt="QR Code" style="display: block; width: 180px; height: 180px;" />
                  </div>
                  <p style="font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 4px; color: #F2F2F2; opacity: 0.5; margin-top: 20px; font-weight: bold;">${order.order_number}</p>
                </div>

                <div style="margin: 40px 0; text-align: center;">
                    <a href="${walletUrl}" style="background-color: #ffffff; color: #000000; padding: 18px 32px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; display: inline-block; box-shadow: 0 10px 20px rgba(255,255,255,0.1);">
                        VER MIS BOLETAS
                    </a>
                </div>

                <div style="border-top: 1px solid rgba(73, 15, 124, 0.2); padding-top: 30px;">
                    <h3 style="color: #8E9299; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 20px;">Resumen de Compra</h3>
                    ${itemsHtml}
                    
                    <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: center;">
                      <span style="color: #8E9299; font-size: 12px; font-weight: bold; text-transform: uppercase;">Total Pagado</span>
                      <span style="font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -1px;">$${order.total.toLocaleString()}</span>
                    </div>
                </div>
              </div>

              <!-- FOOTER -->
              <div style="background-color: #050505; padding: 40px; text-align: center; border-top: 1px solid rgba(73, 15, 124, 0.2);">
                <p style="color: #490F7C; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                    Presenta este código QR en la entrada
                </p>
                <p style="color: #8E9299; font-size: 10px; opacity: 0.5; margin: 0;">
                    &copy; ${new Date().getFullYear()} MIDNIGHT CORP. Todos los derechos reservados.
                </p>
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