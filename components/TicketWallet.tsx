import React, { useState, useMemo } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { QrCode, Ticket, ChevronLeft, ChevronRight, Send, X, Loader2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { MidnightTicketCard } from './MidnightTicketCard';
import { toast } from '../lib/toast';

const motion = _motion as any;

export default function TicketWallet() {
  const { orders, events, currentCustomer, transferTicket } = useStore();
  const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [[page, direction], setPage] = useState([0, 0]);

  // Transfer state
  const [transferOrderId, setTransferOrderId] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferName, setTransferName] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const myOrders = useMemo(() => {
    if (!currentCustomer?.email) return [];
    
    const userEmail = currentCustomer.email.toLowerCase().trim();

    return orders.filter(o => {
        const orderEmail = o.customer_email ? o.customer_email.toLowerCase().trim() : '';
        const matchesEmail = orderEmail === userEmail && o.status === 'completed';
        const matchesEvent = filterEventId === 'all' || o.event_id === filterEventId;
        return matchesEmail && matchesEvent;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, currentCustomer, filterEventId]);

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

  const handleTransfer = async () => {
    if (!transferOrderId || !transferEmail.includes('@')) {
      toast.error('Ingresa un email válido');
      return;
    }
    setTransferLoading(true);
    const ok = await transferTicket(transferOrderId, transferEmail, transferName);
    setTransferLoading(false);
    if (ok) {
      toast.success(`Entrada transferida a ${transferEmail}`);
      setTransferOrderId(null);
      setTransferEmail('');
      setTransferName('');
      setPage([0, 0]);
    } else {
      toast.error('No se pudo transferir la entrada. Intenta más tarde.');
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
      <div className="space-y-8">
        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          {/* Event Filter */}
          <select 
            value={filterEventId}
            onChange={(e) => {
              setFilterEventId(e.target.value);
              setPage([0, 0]);
            }}
            className="bg-white/5 border border-white/10 rounded-xl px-4 h-10 text-[10px] font-black text-white uppercase tracking-widest focus:border-neon-purple outline-none w-full sm:w-48"
          >
            <option value="all">TODOS LOS EVENTOS</option>
            {events
              .filter(e => orders.some(o => o.event_id === e.id && o.customer_email?.toLowerCase().trim() === currentCustomer?.email?.toLowerCase().trim()))
              .map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))
            }
          </select>
        </div>

        <div className="text-center py-16 md:py-20 px-4 md:px-6 border border-white/5 rounded-[2rem] md:rounded-[3rem] bg-zinc-900/20 backdrop-blur-sm">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4 md:mb-6 mx-auto">
            <Ticket className="w-8 h-8 md:w-10 md:h-10 text-zinc-600" />
          </div>
          <h3 className="text-lg md:text-2xl font-black text-white tracking-tight uppercase">
            {filterEventId === 'all' ? 'Billetera Vacía' : 'Sin Entradas'}
          </h3>
          <p className="text-zinc-500 mt-2 max-w-xs mx-auto font-medium text-xs md:text-base">
            {filterEventId === 'all' 
              ? `No se encontraron tickets asociados a ${currentCustomer.email}.`
              : `No tienes entradas para el evento seleccionado.`
            }
          </p>
          {filterEventId !== 'all' && (
            <button 
              onClick={() => setFilterEventId('all')}
              className="mt-6 text-neon-purple text-[10px] font-black uppercase tracking-widest hover:underline"
            >
              Ver todas mis entradas
            </button>
          )}
        </div>
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
      {/* TRANSFER MODAL */}
      <AnimatePresence>
        {transferOrderId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2rem] p-7 relative"
            >
              <button onClick={() => { setTransferOrderId(null); setTransferEmail(''); setTransferName(''); }}
                className="absolute top-5 right-5 text-zinc-600 hover:text-white"><X size={20} /></button>
              <div className="flex justify-center mb-5">
                <div className="w-12 h-12 bg-neon-purple/10 rounded-2xl flex items-center justify-center border border-neon-purple/20">
                  <Send size={20} className="text-neon-purple" />
                </div>
              </div>
              <h2 className="text-lg font-black text-white text-center mb-1 uppercase">Transferir Entrada</h2>
              <p className="text-zinc-500 text-[10px] text-center mb-6 uppercase font-bold tracking-widest">La entrada desaparecerá de tu billetera</p>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Email del destinatario *</label>
                  <input
                    type="email"
                    placeholder="amigo@email.com"
                    value={transferEmail}
                    onChange={e => setTransferEmail(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-purple outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Nombre (opcional)</label>
                  <input
                    type="text"
                    placeholder="Nombre del destinatario"
                    value={transferName}
                    onChange={e => setTransferName(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-purple outline-none"
                  />
                </div>
                <button
                  onClick={handleTransfer}
                  disabled={transferLoading || !transferEmail.includes('@')}
                  className="w-full h-13 bg-neon-purple text-white font-black text-xs uppercase tracking-widest rounded-xl py-3.5 hover:bg-neon-purple/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2 mt-2"
                >
                  {transferLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {transferLoading ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                </button>
                <p className="text-[9px] text-zinc-600 text-center">
                  Esta acción no se puede deshacer. El destinatario verá la entrada en su billetera.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
        {/* Event Filter */}
        <select 
          value={filterEventId}
          onChange={(e) => {
            setFilterEventId(e.target.value);
            setPage([0, 0]);
          }}
          className="bg-white/5 border border-white/10 rounded-xl px-4 h-10 text-[10px] font-black text-white uppercase tracking-widest focus:border-neon-purple outline-none w-full sm:w-48"
        >
          <option value="all">TODOS LOS EVENTOS</option>
          {events
            .filter(e => orders.some(o => o.event_id === e.id && o.customer_email?.toLowerCase().trim() === currentCustomer?.email?.toLowerCase().trim()))
            .map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))
          }
        </select>

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
          <div className="relative h-[420px] sm:h-[480px] md:h-[520px] w-full flex items-center justify-center overflow-hidden">
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
                className={`p-3.5 rounded-full border border-white/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${page === 0 ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
              >
                <ChevronLeft size={22} />
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
                className={`p-3.5 rounded-full border border-white/10 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center ${page === myOrders.length - 1 ? 'opacity-10 cursor-not-allowed' : 'hover:bg-white/10 text-white'}`}
              >
                <ChevronRight size={22} />
              </button>
            </div>
            
            <p className="text-center text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em]">
              {currentIndex + 1} / {myOrders.length} • DESLIZA PARA NAVEGAR
            </p>

            {/* Transfer button for current ticket */}
            {!myOrders[currentIndex]?.used && (
              <button
                onClick={() => setTransferOrderId(myOrders[currentIndex].id)}
                className="flex items-center gap-2 text-[10px] text-zinc-600 hover:text-neon-purple font-black uppercase tracking-widest transition-all"
              >
                <Send size={12} /> Transferir esta entrada
              </button>
            )}
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
                {!order.used && (
                  <button
                    onClick={() => setTransferOrderId(order.id)}
                    className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600 hover:text-neon-purple font-black uppercase tracking-widest transition-all mx-auto"
                  >
                    <Send size={12} /> Transferir entrada
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
