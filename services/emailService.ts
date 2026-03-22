import { Order, Event } from "../types";

export const sendTicketEmail = async (orderOrOrders: Order | Order[], event: Event) => {
  const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY;
  const DOMAIN = import.meta.env.VITE_VERIFIED_DOMAIN || 'midnightcorp.click'; 

  if (!RESEND_KEY) {
    console.warn("⚠️ FALTA API KEY: Configura VITE_RESEND_API_KEY en tu archivo .env");
    return false;
  }

  const orders = Array.isArray(orderOrOrders) ? orderOrOrders : [orderOrOrders];
  const mainOrder = orders[0];

  // Generar lista de tickets HTML (uno por cada QR)
  const ticketsHtml = orders.map((order, index) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order.order_number}`;
    return `
      <div style="background-color: #ffffff; border-radius: 24px; padding: 20px; margin-bottom: 30px; text-align: center; color: #000000;">
        <p style="margin: 0 0 15px 0; font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #490F7C; text-transform: uppercase;">Ticket ${index + 1} de ${orders.length}</p>
        <div style="display: inline-block; padding: 10px; border: 1px solid #f0f0f0; border-radius: 16px;">
          <img src="${qrUrl}" alt="QR Code" style="display: block; width: 220px; height: 220px;" />
        </div>
        <p style="font-family: 'Courier New', monospace; font-size: 14px; letter-spacing: 4px; color: #000000; opacity: 0.3; margin-top: 15px; font-weight: bold;">${order.order_number}</p>
      </div>
    `;
  }).join('');

  const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
  const walletUrl = `${APP_URL}/tickets`; // Adjusted to /tickets where the wallet is

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
        to: [mainOrder.customer_email],
        subject: `TUS ENTRADAS: ${event.title}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 0; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px;">
              
              <!-- LOGO -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="margin: 0; font-size: 24px; letter-spacing: 10px; text-transform: uppercase; font-weight: 900; color: #ffffff;">MIDNIGHT</h1>
                <p style="color: #490F7C; font-size: 8px; margin-top: 5px; letter-spacing: 5px; font-weight: bold;">WORLDWIDE</p>
              </div>

              <!-- EVENT INFO -->
              <div style="margin-bottom: 40px; text-align: center;">
                <h2 style="margin: 0; font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; line-height: 1;">${event.title}</h2>
                <p style="color: #8E9299; margin: 15px 0 0 0; font-size: 14px; font-weight: 500;">
                  ${new Date(event.event_date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p style="color: #490F7C; margin: 5px 0 0 0; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
                  ${event.venue} • ${event.city}
                </p>
              </div>

              <!-- TICKETS CONTAINER -->
              <div>
                ${ticketsHtml}
              </div>

              ${orders.length >= 2 ? `
              <!-- INSTRUCCIONES PORTAL (solo cuando hay 2+ tickets) -->
              <div style="margin: 40px 0; background: linear-gradient(135deg, #0d0022 0%, #1a0444 100%); border: 1px solid rgba(176,38,255,0.3); border-radius: 20px; padding: 28px 24px;">
                <p style="color: #b026ff; font-size: 9px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 12px 0;">Tus ${orders.length} entradas están disponibles online</p>
                <p style="color: #ffffff; font-size: 14px; font-weight: 900; margin: 0 0 8px 0; line-height: 1.3;">Accede a tu billetera de entradas</p>
                <p style="color: #8E9299; font-size: 12px; line-height: 1.7; margin: 0 0 20px 0;">
                  1. Ve a <strong style="color:#fff">${APP_URL}</strong><br/>
                  2. Abre el menú (esquina superior derecha)<br/>
                  3. Toca <strong style="color:#b026ff">"Acceso"</strong> e ingresa este correo<br/>
                  4. Revisa tu bandeja de entrada para el código<br/>
                  5. Toca <strong style="color:#fff">"Entradas"</strong> para ver todos tus QR
                </p>
                <a href="${APP_URL}" style="background-color: #b026ff; color: #ffffff; padding: 14px 28px; border-radius: 100px; text-decoration: none; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; display: inline-block; box-shadow: 0 0 30px rgba(176,38,255,0.4);">
                  VER MIS ENTRADAS →
                </a>
              </div>
              ` : `
              <!-- CTA SIMPLE (1 ticket) -->
              <div style="margin: 60px 0; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 40px;">
                <p style="color: #ffffff; font-size: 14px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">
                    Accede a tus entradas online
                </p>
                <p style="color: #8E9299; font-size: 12px; line-height: 1.6; margin-bottom: 30px; max-width: 320px; margin-left: auto; margin-right: auto;">
                    Puedes encontrar tu entrada iniciando sesión en nuestra plataforma. Busca la opción <strong>"ENTRADAS"</strong> en el menú superior derecho.
                </p>
                <a href="${APP_URL}" style="background-color: #490F7C; color: #ffffff; padding: 18px 36px; border-radius: 100px; text-decoration: none; font-weight: 900; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; display: inline-block; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 0 20px rgba(73, 15, 124, 0.4);">
                  IR A MIDNIGHT
                </a>
              </div>
              `}

              <!-- FOOTER -->
              <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 40px;">
                <p style="color: #490F7C; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
                  Protocolo de Acceso Seguro
                </p>
                <p style="color: #444444; font-size: 9px; margin: 0; line-height: 1.6;">
                  Presenta estos códigos en la entrada.<br/>
                  &copy; ${new Date().getFullYear()} MIDNIGHT CORP.
                </p>
              </div>

            </div>
          </body>
          </html>
        `
      })
    });

    return res.ok;
  } catch (error) {
    console.error("❌ Error de red:", error);
    return false;
  }
};
