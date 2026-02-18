import React, { useState, useMemo } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { QrCode, Calendar, MapPin, Ticket, Clock, Download, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Button } from './ui/button';

const motion = _motion as any;

export default function TicketWallet() {
  const { orders, events, currentCustomer } = useStore();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Lógica blindada de filtrado:
  // 1. Normaliza el email del usuario logueado (minúsculas y sin espacios).
  // 2. Compara contra el email de la orden normalizado.
  const myOrders = useMemo(() => {
      if (!currentCustomer?.email) return [];
      
      const userEmail = currentCustomer.email.toLowerCase().trim();

      return orders.filter(o => {
          const orderEmail = o.customer_email ? o.customer_email.toLowerCase().trim() : '';
          return orderEmail === userEmail && o.status === 'completed';
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, currentCustomer]);

  if (!currentCustomer) {
    return (
      <div className="text-center py-16 md:py-20 px-4 md:px-6 border border-white/5 rounded-[2rem] md:rounded-[3rem] bg-zinc-900/20 backdrop-blur-sm">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto">
          <QrCode className="w-8 h-8 md:w-10 md:h-10 text-zinc-600" />
        </div>
        <h3 className="text-lg md:text-2xl font-black text-white tracking-tight uppercase">Acceso Restringido</h3>
        <p className="text-zinc-500 mt-2 max-w-xs mx-auto font-medium text-xs md:text-base">
          Inicia sesión para visualizar tu billetera de tickets y códigos QR.
        </p>
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <div className="text-center py-16 md:py-20 px-4 md:px-6 border border-white/5 rounded-[2rem] md:rounded-[3rem] bg-zinc-900/20 backdrop-blur-sm">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto">
          <Ticket className="w-8 h-8 md:w-10 md:h-10 text-zinc-600" />
        </div>
        <h3 className="text-lg md:text-2xl font-black text-white tracking-tight uppercase">Billetera Vacía</h3>
        <p className="text-zinc-500 mt-2 max-w-xs mx-auto font-medium text-xs md:text-base">
          No se encontraron tickets asociados a <span className="text-white font-bold">{currentCustomer.email}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-3xl mx-auto">
      {myOrders.map((order, index) => {
        const event = events.find(e => e.id === order.event_id);
        const isExpanded = expandedOrderId === order.id;

        // Generar QR URL (Mismo servicio que emailService)
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${order.order_number}&color=000000&bgcolor=ffffff`;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`relative overflow-hidden rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-300 ${isExpanded ? 'bg-zinc-900 border-neon-purple/50 shadow-2xl shadow-neon-purple/10' : 'bg-zinc-900/50 border-white/10 hover:border-white/20'}`}
          >
            {/* Header Tarjeta */}
            <div 
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                className="p-4 md:p-6 cursor-pointer flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6"
            >
                {/* Event Image Thumbnail */}
                <div className="w-full h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl overflow-hidden flex-shrink-0 bg-black relative">
                    <img src={event?.cover_image} className="w-full h-full object-cover opacity-80" alt="Event Cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
                </div>

                {/* Info Principal */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider">
                            Confirmado
                        </span>
                        <span className="text-zinc-500 text-[9px] md:text-[10px] font-mono uppercase">
                            ID: {order.order_number}
                        </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-white truncate">{event?.title || 'Evento Desconocido'}</h3>
                    <p className="text-xs md:text-sm text-zinc-400 mt-1 flex items-center gap-2">
                        <Calendar size={12} className="md:w-[14px] md:h-[14px]"/> {event ? new Date(event.event_date).toLocaleDateString() : 'Fecha Pendiente'}
                    </p>
                </div>

                {/* Totales y Toggle */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end mt-2 md:mt-0 pt-2 md:pt-0 border-t border-white/5 md:border-0">
                     <div className="text-right">
                         <p className="text-[10px] md:text-xs text-zinc-500 uppercase font-bold">Total</p>
                         <p className="text-base md:text-lg font-black text-white">${order.total.toLocaleString()}</p>
                     </div>
                     <div className={`p-1.5 md:p-2 rounded-full border border-white/10 bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white text-black' : 'text-zinc-400'}`}>
                         <ChevronDown size={16} className="md:w-5 md:h-5"/>
                     </div>
                </div>
            </div>

            {/* Detalle Expandido (El Ticket Real) */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 md:p-6 pt-0 border-t border-white/5 bg-black/20 flex flex-col md:flex-row gap-6 md:gap-8">
                            
                            {/* Columna QR */}
                            <div className="flex flex-col items-center justify-center bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-xl max-w-[160px] md:max-w-[200px] mx-auto md:mx-0">
                                <img src={qrUrl} alt="QR de Acceso" className="w-full h-full object-contain mix-blend-multiply" />
                                <p className="text-black font-black text-[10px] md:text-xs mt-2 tracking-widest">{order.order_number}</p>
                            </div>

                            {/* Columna Detalles */}
                            <div className="flex-1 space-y-4 md:space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                    <div className="bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                                        <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1"><MapPin size={10}/> Ubicación</p>
                                        <p className="text-white font-bold text-xs md:text-sm">{event?.venue}</p>
                                        <p className="text-zinc-400 text-[10px] md:text-xs">{event?.city}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5">
                                        <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-bold mb-1 flex items-center gap-1"><Clock size={10}/> Apertura Puertas</p>
                                        <p className="text-white font-bold text-xs md:text-sm">{event?.doors_open} PM</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-bold mb-2 md:mb-3">Items Comprados</p>
                                    <div className="space-y-2">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2.5 md:p-3 bg-zinc-900 rounded-lg md:rounded-xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-neon-purple/20 flex items-center justify-center text-neon-purple font-black text-[9px] md:text-xs border border-neon-purple/20">
                                                        {item.quantity}x
                                                    </div>
                                                    <span className="text-xs md:text-sm font-bold text-white">{item.tier_name}</span>
                                                </div>
                                                <span className="text-[10px] md:text-xs text-zinc-400">${item.subtotal.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 md:pt-4 flex gap-2 md:gap-3">
                                    <Button fullWidth className="bg-white text-black font-black text-[10px] md:text-xs h-9 md:h-10 rounded-lg md:rounded-xl">
                                        <Download size={12} className="mr-2 md:w-[14px] md:h-[14px]"/> DESCARGAR PDF
                                    </Button>
                                    <Button fullWidth className="bg-zinc-800 text-white font-bold text-[10px] md:text-xs h-9 md:h-10 rounded-lg md:rounded-xl">
                                        <Sparkles size={12} className="mr-2 md:w-[14px] md:h-[14px] text-neon-purple"/> AGREGAR WALLET
                                    </Button>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}