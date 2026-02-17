import { Order, Promoter } from "../types";

// Interfaz para la fila de Google Sheets
interface SheetRow {
  fecha: string;
  id_factura: string;
  cliente: string;
  cantidad_tickets: number;
  tipo_ticket: string; // Si son varios, los concatenamos
  valor_total: number;
  pasarela: string;
  promotor: string;
  manager: string;
}

/**
 * Función Frontend: Prepara y envía la orden al webhook/API.
 * @param order La orden generada
 * @param promoter El promotor atribuido (si existe)
 * @param manager El manager del promotor (si existe)
 * @param paymentMethod Método de pago usado
 */
export const syncOrderToSheets = async (
  order: Order, 
  promoter: Promoter | null, 
  manager: Promoter | null,
  paymentMethod: string
) => {
  
  // 1. Aplanar los items para el reporte (si compró varios tipos de tickets)
  const ticketTypes = order.items.map(i => `${i.quantity}x ${i.tier_name}`).join(', ');
  const totalQty = order.items.reduce((acc, i) => acc + i.quantity, 0);

  // 2. Construir la fila de datos
  const rowData: SheetRow = {
    fecha: new Date(order.timestamp).toLocaleString('es-CO'), // Formato local
    id_factura: order.order_number,
    cliente: order.customer_name || 'Cliente Web', // Podría venir el email también
    cantidad_tickets: totalQty,
    tipo_ticket: ticketTypes,
    valor_total: order.total,
    pasarela: paymentMethod === 'cash' ? 'Efectivo / Taquilla' : 'Stripe / Pasarela Digital',
    promotor: promoter ? `${promoter.name} (${promoter.code})` : 'Venta Orgánica / Directa',
    manager: manager ? `${manager.name} (${manager.code})` : (promoter ? 'Sin Manager Asignado' : 'N/A')
  };

  console.log("📊 [SHEETS SYNC] Preparando envío a Google Sheets:", rowData);

  // 3. Envío al Backend (Simulación)
  // En producción, reemplaza esto con un fetch a tu API Route (Next.js) o Cloud Function
  try {
    /* 
    const response = await fetch('/api/sales-webhook', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(rowData)
    });
    if (!response.ok) throw new Error('Error en sync');
    */
    
    // Simulación de éxito para la UI
    await new Promise(r => setTimeout(r, 800)); 
    console.log("✅ [SHEETS SYNC] Venta registrada exitosamente en la nube.");
    return true;

  } catch (error) {
    console.error("❌ [SHEETS SYNC] Error al sincronizar:", error);
    return false;
  }
};

/* 
==================================================================================
   SCRIPT DE BACKEND (NODE.JS) PARA GOOGLE SHEETS
   Copia este código en tu AWS Lambda, Google Cloud Function o Next.js API Route
==================================================================================

const { google } = require('googleapis');

// Configuración de Credenciales (Descargar JSON de Google Cloud Console -> Service Account)
// Asegúrate de compartir tu Hoja de Cálculo con el email del Service Account (client_email)
const CREDENTIALS = require('./path-to-your-service-account-key.json');
const SPREADSHEET_ID = 'TU_ID_DE_GOOGLE_SHEET'; // Lo sacas de la URL del sheet

async function appendSaleToSheet(data) {
  const client = new google.auth.JWT(
    CREDENTIALS.client_email,
    null,
    CREDENTIALS.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  await client.authorize();
  const gsapi = google.sheets({ version: 'v4', auth: client });

  // Mapear los datos que llegan del frontend al orden de columnas del Sheet
  // Orden sugerido: A:Fecha, B:Factura, C:Cliente, D:Cant, E:Tipo, F:Total, G:Pasarela, H:Promotor, I:Manager
  const rowValues = [
    [
      data.fecha,
      data.id_factura,
      data.cliente,
      data.cantidad_tickets,
      data.tipo_ticket,
      data.valor_total,
      data.pasarela,
      data.promotor,
      data.manager
    ]
  ];

  const updateOptions = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Ventas!A:I', // Nombre de la hoja y columnas
    valueInputOption: 'USER_ENTERED',
    resource: { values: rowValues }
  };

  const response = await gsapi.spreadsheets.values.append(updateOptions);
  return response;
}
*/