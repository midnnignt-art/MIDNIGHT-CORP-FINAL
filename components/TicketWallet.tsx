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

  const variants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0, scale: 0.96 }),
    center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
    exit: (direction: number) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0, scale: 0.96 }),
  };

  /* ── Empty / unauthenticated states ─────────────────────────────────────── */
  if (!currentCustomer) {
    return (
      <div className="text-center py-16 md:py-20 px-6 border border-moonlight/8 rounded-3xl bg-midnight/30 backdrop-blur-sm">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-eclipse/20 rounded-full flex items-center justify-center mb-5 mx-auto border border-eclipse/20 shadow-[0_0_30px_rgba(73,15,124,0.2)]">
          <QrCode className="w-8 h-8 md:w-10 md:h-10 text-eclipse" />
        </div>
        <h3 className="text-lg md:text-2xl font-black text-moonlight tracking-tight uppercase">Acceso Restringido</h3>
        <p className="text-moonlight/40 mt-2 max-w-xs mx-auto font-light text-xs md:text-sm">
          Inicia sesión para visualizar tu billetera de tickets y códigos QR.
        </p>
      </div>
    );
  }

  if (myOrders.length === 0) {
    return (
      <div className="space-y-8">
        <FilterBar
          filterEventId={filterEventId}
          setFilterEventId={(v: string) => { setFilterEventId(v); setPage([0, 0]); }}
          viewMode={viewMode}
          setViewMode={setViewMode}
          events={events}
          orders={orders}
          currentCustomer={currentCustomer}
          showViewToggle={false}
        />
        <div className="text-center py-16 md:py-20 px-6 border border-moonlight/8 rounded-3xl bg-midnight/30 backdrop-blur-sm">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-eclipse/20 rounded-full flex items-center justify-center mb-5 mx-auto border border-eclipse/20 shadow-[0_0_30px_rgba(73,15,124,0.2)]">
            <Ticket className="w-8 h-8 md:w-10 md:h-10 text-eclipse" />
          </div>
          <h3 className="text-lg md:text-2xl font-black text-moonlight tracking-tight uppercase">
            {filterEventId === 'all' ? 'Billetera Vacía' : 'Sin Entradas'}
          </h3>
          <p className="text-moonlight/40 mt-2 max-w-xs mx-auto font-light text-xs md:text-sm">
            {filterEventId === 'all'
              ? `No se encontraron tickets asociados a ${currentCustomer.email}.`
              : 'No tienes entradas para el evento seleccionado.'}
          </p>
          {filterEventId !== 'all' && (
            <button
              onClick={() => setFilterEventId('all')}
              className="mt-6 text-eclipse text-[10px] font-black uppercase tracking-widest hover:text-neon-purple transition-colors"
            >
              Ver todas mis entradas
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto px-4">

      {/* ── TRANSFER MODAL ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {transferOrderId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="w-full max-w-sm bg-midnight border border-moonlight/10 rounded-3xl p-7 relative shadow-[0_40px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(73,15,124,0.15)]"
            >
              <button
                onClick={() => { setTransferOrderId(null); setTransferEmail(''); setTransferName(''); }}
                className="absolute top-5 right-5 text-moonlight/30 hover:text-moonlight transition-colors rounded-full p-1 hover:bg-white/5"
              >
                <X size={18} />
              </button>

              <div className="flex justify-center mb-5">
                <div className="w-14 h-14 bg-eclipse/20 rounded-2xl flex items-center justify-center border border-eclipse/30 shadow-[0_0_24px_rgba(73,15,124,0.3)]">
                  <Send size={20} className="text-eclipse" />
                </div>
              </div>

              <h2 className="text-lg font-black text-moonlight text-center mb-1 uppercase tracking-tight">Transferir Entrada</h2>
              <p className="text-moonlight/30 text-[10px] text-center mb-6 uppercase font-bold tracking-widest">La entrada desaparecerá de tu billetera</p>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-moonlight/40 uppercase tracking-widest block mb-1.5">Email del destinatario *</label>
                  <input
                    type="email"
                    placeholder="amigo@email.com"
                    value={transferEmail}
                    onChange={e => setTransferEmail(e.target.value)}
                    className="w-full bg-void border border-moonlight/10 rounded-2xl px-4 h-12 text-sm text-moonlight font-medium focus:border-eclipse outline-none transition-colors placeholder:text-moonlight/20"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-moonlight/40 uppercase tracking-widest block mb-1.5">Nombre (opcional)</label>
                  <input
                    type="text"
                    placeholder="Nombre del destinatario"
                    value={transferName}
                    onChange={e => setTransferName(e.target.value)}
                    className="w-full bg-void border border-moonlight/10 rounded-2xl px-4 h-12 text-sm text-moonlight font-medium focus:border-eclipse outline-none transition-colors placeholder:text-moonlight/20"
                  />
                </div>
                <button
                  onClick={handleTransfer}
                  disabled={transferLoading || !transferEmail.includes('@')}
                  className="w-full h-12 bg-eclipse hover:bg-eclipse/80 text-moonlight font-black text-xs uppercase tracking-widest rounded-2xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 mt-2 shadow-[0_0_30px_rgba(73,15,124,0.3)] active:scale-[0.98]"
                >
                  {transferLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />}
                  {transferLoading ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                </button>
                <p className="text-[9px] text-moonlight/20 text-center pt-1">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FILTERS & VIEW TOGGLE ─────────────────────────────────────────── */}
      <FilterBar
        filterEventId={filterEventId}
        setFilterEventId={(v: string) => { setFilterEventId(v); setPage([0, 0]); }}
        viewMode={viewMode}
        setViewMode={setViewMode}
        events={events}
        orders={orders}
        currentCustomer={currentCustomer}
        showViewToggle
      />

      {/* ── CAROUSEL MODE ─────────────────────────────────────────────────── */}
      {viewMode === 'carousel' ? (
        <div className="relative w-full max-w-sm mx-auto">

          {/* Carousel slide container — clips x, lets y breathe */}
          <div
            className="relative w-full"
            style={{ overflowX: 'clip', overflowY: 'visible' }}
          >
            {/* Left arrow — overlaid on card */}
            {myOrders.length > 1 && (
              <button
                onClick={() => paginate(-1)}
                disabled={page === 0}
                className={`absolute left-3 top-[38%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-void/70 backdrop-blur-md border border-moonlight/15 flex items-center justify-center transition-all
                  ${page === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-eclipse/40 hover:border-eclipse/40 active:scale-90'}`}
              >
                <ChevronLeft size={18} className="text-moonlight" />
              </button>
            )}

            {/* Right arrow — overlaid on card */}
            {myOrders.length > 1 && (
              <button
                onClick={() => paginate(1)}
                disabled={page === myOrders.length - 1}
                className={`absolute right-3 top-[38%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-void/70 backdrop-blur-md border border-moonlight/15 flex items-center justify-center transition-all
                  ${page === myOrders.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100 hover:bg-eclipse/40 hover:border-eclipse/40 active:scale-90'}`}
              >
                <ChevronRight size={18} className="text-moonlight" />
              </button>
            )}

            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={page}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 280, damping: 28 },
                  opacity: { duration: 0.18 },
                  scale: { duration: 0.18 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={(e: any, { offset, velocity }: any) => {
                  const swipe = Math.abs(offset.x) > 50 || Math.abs(velocity.x) > 500;
                  if (swipe) {
                    if (offset.x < 0 && page < myOrders.length - 1) paginate(1);
                    else if (offset.x > 0 && page > 0) paginate(-1);
                  }
                }}
                className="w-full cursor-grab active:cursor-grabbing touch-pan-y"
              >
                <MidnightTicketCard
                  order={myOrders[currentIndex]}
                  event={events.find(e => e.id === myOrders[currentIndex].event_id)}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots + counter */}
          {myOrders.length > 1 && (
            <div className="flex flex-col items-center gap-3 mt-5">
              <div className="flex items-center gap-1.5">
                {myOrders.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPage([idx, idx > page ? 1 : -1])}
                    className={`rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? 'w-6 h-2 bg-eclipse shadow-[0_0_8px_rgba(73,15,124,0.7)]'
                        : 'w-2 h-2 bg-moonlight/15 hover:bg-moonlight/30'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[9px] text-moonlight/30 uppercase font-black tracking-[0.3em]">
                {currentIndex + 1} / {myOrders.length} · desliza para navegar
              </p>
            </div>
          )}

          {/* Transfer button */}
          {!myOrders[currentIndex]?.used && (
            <button
              onClick={() => setTransferOrderId(myOrders[currentIndex].id)}
              className="flex items-center gap-2 text-[10px] text-moonlight/30 hover:text-eclipse font-black uppercase tracking-widest transition-colors mx-auto mt-4"
            >
              <Send size={11} /> Transferir esta entrada
            </button>
          )}
        </div>

      ) : (
        /* ── LIST MODE ──────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 gap-10 animate-in fade-in duration-500">
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
                    className="mt-4 flex items-center gap-2 text-[10px] text-moonlight/30 hover:text-eclipse font-black uppercase tracking-widest transition-colors mx-auto"
                  >
                    <Send size={11} /> Transferir entrada
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

/* ── Filter Bar sub-component ──────────────────────────────────────────────── */
function FilterBar({ filterEventId, setFilterEventId, viewMode, setViewMode, events, orders, currentCustomer, showViewToggle }: any) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
      <select
        value={filterEventId}
        onChange={e => setFilterEventId(e.target.value)}
        className="bg-midnight/60 border border-moonlight/10 rounded-2xl px-4 h-11 text-[10px] font-black text-moonlight uppercase tracking-widest focus:border-eclipse outline-none w-full sm:w-52 backdrop-blur-sm transition-colors appearance-none"
      >
        <option value="all">Todos los eventos</option>
        {events
          .filter((e: any) => orders.some((o: any) => o.event_id === e.id && o.customer_email?.toLowerCase().trim() === currentCustomer?.email?.toLowerCase().trim()))
          .map((e: any) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
      </select>

      {showViewToggle && (
        <div className="bg-midnight/60 border border-moonlight/10 backdrop-blur-sm p-1 rounded-2xl flex gap-1">
          <button
            onClick={() => setViewMode('carousel')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'carousel'
                ? 'bg-eclipse text-moonlight shadow-[0_0_16px_rgba(73,15,124,0.4)]'
                : 'text-moonlight/40 hover:text-moonlight'
            }`}
          >
            Carrusel
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === 'list'
                ? 'bg-eclipse text-moonlight shadow-[0_0_16px_rgba(73,15,124,0.4)]'
                : 'text-moonlight/40 hover:text-moonlight'
            }`}
          >
            Lista
          </button>
        </div>
      )}
    </div>
  );
}
