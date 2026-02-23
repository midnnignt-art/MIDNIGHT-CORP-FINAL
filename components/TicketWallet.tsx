import React, { useState, useMemo } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { QrCode, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { MidnightTicketCard } from './MidnightTicketCard';

const motion = _motion as any;

export default function TicketWallet() {
  const { orders, events, currentCustomer } = useStore();
  const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');
  const [[page, direction], setPage] = useState([0, 0]);

  const myOrders = useMemo(() => {
    if (!currentCustomer?.email) return [];
    
    const userEmail = currentCustomer.email.toLowerCase().trim();

    return orders.filter(o => {
        const orderEmail = o.customer_email ? o.customer_email.toLowerCase().trim() : '';
        return orderEmail === userEmail && o.status === 'completed';
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, currentCustomer]);

  // Reset page if it goes out of bounds when orders change
  React.useEffect(() => {
    if (page >= myOrders.length && myOrders.length > 0) {
      setPage([myOrders.length - 1, 0]);
    }
  }, [myOrders.length, page]);

  const currentIndex = page;

  const paginate = (newDirection: number) => {
    const nextPage = page + newDirection;
    if (nextPage < 0 || nextPage >= myOrders.length) return;
    setPage([nextPage, newDirection]);
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

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      scale: 0.95
    })
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto px-4">
      {/* View Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-white/5 p-1 rounded-xl border border-white/10 flex gap-1">
          <button 
            onClick={() => setViewMode('carousel')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'carousel' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
          >
            Carrusel
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white'}`}
          >
            Lista
          </button>
        </div>
      </div>

      {viewMode === 'carousel' ? (
        <div className="relative w-full max-w-md mx-auto">
          <div className="relative h-[520px] sm:h-[580px] w-full flex items-center justify-center overflow-hidden">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={page}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={(e: any, { offset, velocity }: any) => {
                  const swipe = Math.abs(offset.x) > 50 || Math.abs(velocity.x) > 500;
                  if (swipe) {
                    if (offset.x < 0 && page < myOrders.length - 1) {
                      paginate(1);
                    } else if (offset.x > 0 && page > 0) {
                      paginate(-1);
                    }
                  }
                }}
                className="absolute w-full px-4 cursor-grab active:cursor-grabbing touch-pan-y"
              >
                <MidnightTicketCard 
                  order={myOrders[currentIndex]} 
                  event={events.find(e => e.id === myOrders[currentIndex].event_id)} 
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-col items-center gap-6 mt-4">
            <div className="flex items-center gap-8">
              <button 
                onClick={() => paginate(-1)}
                disabled={page === 0}
                className={`p-3 rounded-full border border-white/10 transition-all ${page === 0 ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
              >
                <ChevronLeft size={24} />
              </button>
              
              <div className="flex gap-2">
                {myOrders.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-8 bg-neon-purple shadow-[0_0_10px_rgba(176,38,255,0.5)]' : 'w-2 bg-white/10'}`}
                  />
                ))}
              </div>

              <button 
                onClick={() => paginate(1)}
                disabled={page === myOrders.length - 1}
                className={`p-3 rounded-full border border-white/10 transition-all ${page === myOrders.length - 1 ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
              >
                <ChevronRight size={24} />
              </button>
            </div>
            
            <p className="text-center text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]">
              {currentIndex + 1} / {myOrders.length} • DESLIZA PARA NAVEGAR
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12 animate-in fade-in duration-500">
          {myOrders.map((order) => (
            <div key={order.id} className="flex justify-center">
              <div className="w-full max-w-sm">
                <MidnightTicketCard 
                  order={order} 
                  event={events.find(e => e.id === order.event_id)} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
