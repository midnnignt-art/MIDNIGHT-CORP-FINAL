import React, { useState, useMemo } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { QrCode, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { MidnightTicketCard } from './MidnightTicketCard';

const motion = _motion as any;

export default function TicketWallet() {
  const { orders, events, currentCustomer } = useStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const myOrders = useMemo(() => {
      if (!currentCustomer?.email) return [];
      
      const userEmail = currentCustomer.email.toLowerCase().trim();

      return orders.filter(o => {
          const orderEmail = o.customer_email ? o.customer_email.toLowerCase().trim() : '';
          return orderEmail === userEmail && o.status === 'completed';
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, currentCustomer]);

  const nextTicket = () => {
    if (currentIndex < myOrders.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevTicket = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const onDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      nextTicket();
    } else if (info.offset.x > swipeThreshold) {
      prevTicket();
    }
  };

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
    <div className="relative w-full max-w-lg mx-auto" ref={containerRef}>
      <div className="overflow-hidden px-4">
        <motion.div 
          className="flex cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={containerRef}
          dragElastic={0.1}
          onDragEnd={(e: any, info: any) => {
            const swipeThreshold = 50;
            const velocityThreshold = 500;
            
            if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
              if (currentIndex < myOrders.length - 1) nextTicket();
            } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
              if (currentIndex > 0) prevTicket();
            }
          }}
          animate={{ x: `-${currentIndex * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ width: `${myOrders.length * 100}%` }}
        >
          {myOrders.map((order) => {
            const event = events.find(e => e.id === order.event_id);
            return (
              <div key={order.id} className="w-full flex-shrink-0 px-4 flex justify-center">
                <div className="w-full max-w-[320px] sm:max-w-[340px]">
                  <MidnightTicketCard order={order} event={event} />
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Navigation Controls */}
      {myOrders.length > 1 && (
        <div className="flex justify-center items-center gap-8 mt-8">
          <button 
            onClick={prevTicket}
            disabled={currentIndex === 0}
            className={`p-3 rounded-full border border-white/10 transition-all ${currentIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex gap-2">
            {myOrders.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-neon-purple' : 'w-2 bg-white/10'}`}
              />
            ))}
          </div>

          <button 
            onClick={nextTicket}
            disabled={currentIndex === myOrders.length - 1}
            className={`p-3 rounded-full border border-white/10 transition-all ${currentIndex === myOrders.length - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
          >
            <ChevronRight size={24} />
          </button>
        </div>
      )}
      
      <p className="text-center text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em] mt-12">
        Desliza para ver más tickets ({currentIndex + 1} / {myOrders.length})
      </p>
    </div>
  );
}
