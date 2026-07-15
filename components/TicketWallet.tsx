import React, { useEffect, useState, useMemo } from 'react';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { QrCode, Ticket, ChevronLeft, ChevronRight, Send, X, Loader2, Sparkles, BarChart2, Users, Calendar, Copy, Check, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { MidnightTicketCard } from './MidnightTicketCard';
import { PaseBadge } from './PaseBadge';
import { toast } from '../lib/toast';
import { supabase } from '../lib/supabase';

const motion = _motion as any;

type WalletTab = 'upcoming' | 'past' | 'pase' | 'stats' | 'referrals';

export default function TicketWallet() {
  const { orders, events, currentCustomer, currentUser, transferTicket } = useStore();
  const [tab, setTab] = useState<WalletTab>('upcoming');
  const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [[page, direction], setPage] = useState([0, 0]);

  const [transferOrderId, setTransferOrderId] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferName, setTransferName] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  const effectiveEmail = currentCustomer?.email || currentUser?.email || null;

  // Todas las órdenes completadas del cliente (sin filtrar por tab)
  const allMyOrders = useMemo(() => {
    if (!effectiveEmail) return [];
    const userEmail = effectiveEmail.toLowerCase().trim();
    return orders.filter(o => {
      const orderEmail = o.customer_email ? o.customer_email.toLowerCase().trim() : '';
      return orderEmail === userEmail && o.status === 'completed';
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, effectiveEmail]);

  // Eventos para el dropdown de filtro: EXACTAMENTE los que el usuario tiene
  // boletas (derivado de allMyOrders, no de un cruce orders+email que quedaba
  // vacío). Título desde events, con fallback para que nunca falte la opción.
  const myEventOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of allMyOrders) {
      if (!o.event_id || map.has(o.event_id)) continue;
      const ev = events.find(e => e.id === o.event_id);
      map.set(o.event_id, ev?.title || (o as any).event_title || 'Evento');
    }
    return Array.from(map, ([id, title]) => ({ id, title }));
  }, [allMyOrders, events]);

  // Filtrar por tab (upcoming/past) + filterEventId
  const myOrders = useMemo(() => {
    const now = Date.now();
    return allMyOrders.filter(o => {
      const matchesEvent = filterEventId === 'all' || o.event_id === filterEventId;
      if (!matchesEvent) return false;
      if (tab === 'upcoming' || tab === 'past') {
        const ev = events.find(e => e.id === o.event_id);
        if (!ev) return tab === 'upcoming'; // si no encontramos el evento, asumimos próximo
        const isFuture = new Date(ev.event_date).getTime() > now;
        return tab === 'upcoming' ? isFuture : !isFuture;
      }
      return true;
    });
  }, [allMyOrders, filterEventId, tab, events]);

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
  if (!effectiveEmail) {
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
          eventOptions={myEventOptions}
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
              ? `No se encontraron tickets asociados a ${effectiveEmail}.`
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
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="w-full sm:max-w-sm bg-[#0D0D1A] border border-moonlight/10 rounded-t-[2rem] sm:rounded-[2rem] p-6 relative shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            >
              {/* Handle bar mobile */}
              <div className="w-10 h-1 bg-moonlight/15 rounded-full mx-auto mb-5 sm:hidden" />

              <button
                onClick={() => { setTransferOrderId(null); setTransferEmail(''); setTransferName(''); }}
                className="absolute top-5 right-5 text-moonlight/30 hover:text-moonlight transition-colors p-1"
              >
                <X size={20} />
              </button>

              {/* Icon + title */}
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 bg-eclipse/20 rounded-2xl flex items-center justify-center border border-eclipse/30 flex-shrink-0">
                  <Send size={20} className="text-eclipse" />
                </div>
                <div>
                  <h2 className="text-base font-black text-moonlight uppercase tracking-tight leading-none mb-1">Reenviar Entrada</h2>
                  <p className="text-moonlight/35 text-[10px] font-medium">La entrada pasará a la billetera del destinatario</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-black text-moonlight/40 uppercase tracking-widest block mb-1.5">Email del destinatario *</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={transferEmail}
                    onChange={e => setTransferEmail(e.target.value)}
                    className="w-full bg-black/40 border border-moonlight/10 rounded-2xl px-4 h-12 text-sm text-moonlight font-medium focus:border-eclipse/60 outline-none transition-colors placeholder:text-moonlight/20"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-moonlight/40 uppercase tracking-widest block mb-1.5">Nombre (opcional)</label>
                  <input
                    type="text"
                    placeholder="¿A quién le envías la entrada?"
                    value={transferName}
                    onChange={e => setTransferName(e.target.value)}
                    className="w-full bg-black/40 border border-moonlight/10 rounded-2xl px-4 h-12 text-sm text-moonlight font-medium focus:border-eclipse/60 outline-none transition-colors placeholder:text-moonlight/20"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setTransferOrderId(null); setTransferEmail(''); setTransferName(''); }}
                    className="h-12 px-5 rounded-2xl border border-moonlight/10 text-moonlight/40 hover:text-moonlight hover:border-moonlight/20 text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={transferLoading || !transferEmail.includes('@')}
                    className="flex-1 h-12 bg-eclipse hover:bg-eclipse/80 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(73,15,124,0.35)] active:scale-[0.98]"
                  >
                    {transferLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                    {transferLoading ? 'Enviando...' : 'Confirmar Envío'}
                  </button>
                </div>

                <p className="text-[9px] text-moonlight/20 text-center">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Solstice reservation banner — siempre visible arriba si tienes reserva activa ── */}
      {effectiveEmail && <SolsticeReservationBanner email={effectiveEmail} />}

      {/* ── TABS — Mi Midnight expandido ──────────────────────────────────── */}
      <WalletTabs tab={tab} setTab={setTab} />

      {/* Sub-tabs que NO son carousel de tickets */}
      {tab === 'pase' && (
        <div className="max-w-md mx-auto">
          <PaseBadge email={effectiveEmail} variant="full" />
        </div>
      )}
      {tab === 'stats' && <StatsTab orders={allMyOrders} events={events} />}
      {tab === 'referrals' && <ReferralsTab email={effectiveEmail} customerName={currentCustomer?.user_metadata?.full_name ?? currentUser?.name ?? ''} />}

      {/* ── FILTERS & VIEW TOGGLE — solo en upcoming/past ─────────────────── */}
      {(tab === 'upcoming' || tab === 'past') && (
        <FilterBar
          filterEventId={filterEventId}
          setFilterEventId={(v: string) => { setFilterEventId(v); setPage([0, 0]); }}
          viewMode={viewMode}
          setViewMode={setViewMode}
          eventOptions={myEventOptions}
          showViewToggle
        />
      )}

      {/* ── CAROUSEL / LIST — solo en upcoming/past con órdenes ───────────── */}
      {(tab === 'upcoming' || tab === 'past') && myOrders.length === 0 && (
        <div className="text-center py-12 px-6 border border-moonlight/8 rounded-3xl bg-midnight/30 backdrop-blur-sm max-w-md mx-auto">
          <div className="w-14 h-14 bg-eclipse/15 rounded-full flex items-center justify-center mb-4 mx-auto border border-eclipse/20">
            <Ticket className="w-7 h-7 text-eclipse" />
          </div>
          <p className="text-moonlight/60 text-sm font-medium">
            {tab === 'upcoming' ? 'No tenés entradas próximas' : 'No tenés eventos pasados todavía'}
          </p>
          {tab === 'upcoming' && (
            <a href="/" className="text-eclipse text-[10px] font-black uppercase tracking-widest hover:text-neon-purple transition-colors mt-3 inline-block">
              Ver eventos disponibles →
            </a>
          )}
        </div>
      )}
      {(tab === 'upcoming' || tab === 'past') && myOrders.length > 0 && (viewMode === 'carousel' ? (
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
                  onTransfer={() => setTransferOrderId(myOrders[currentIndex].id)}
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
                  onTransfer={() => setTransferOrderId(order.id)}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Tabs de Mi Midnight ────────────────────────────────────────────────────

const WalletTabs: React.FC<{ tab: WalletTab; setTab: (t: WalletTab) => void }> = ({ tab, setTab }) => {
  const tabs: { key: WalletTab; label: string; icon: React.ReactNode }[] = [
    { key: 'upcoming',  label: 'Próximos',     icon: <Ticket size={12} /> },
    { key: 'past',      label: 'Pasados',      icon: <Calendar size={12} /> },
    { key: 'pase',      label: 'Mi Pase',      icon: <Sparkles size={12} /> },
    { key: 'stats',     label: 'Estadísticas', icon: <BarChart2 size={12} /> },
    { key: 'referrals', label: 'Referidos',    icon: <Users size={12} /> },
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 -mx-4 px-4 scrollbar-hide">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap transition-all border ${
            tab === t.key
              ? 'bg-moonlight text-void border-moonlight'
              : 'bg-transparent text-moonlight/45 border-moonlight/15 hover:text-moonlight hover:border-moonlight/35'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
};

// ── StatsTab — estadísticas del cliente ──────────────────────────────────

const StatsTab: React.FC<{ orders: any[]; events: any[] }> = ({ orders, events }) => {
  const stats = useMemo(() => {
    const eventIds = Array.from(new Set(orders.map(o => o.event_id)));
    const totalSpent = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const cities = Array.from(new Set(orders.map(o => {
      const ev = events.find(e => e.id === o.event_id);
      return ev?.city;
    }).filter(Boolean)));
    const venues = Array.from(new Set(orders.map(o => {
      const ev = events.find(e => e.id === o.event_id);
      return ev?.venue;
    }).filter(Boolean)));
    const firstPurchase = orders.length > 0 ? new Date(orders[orders.length - 1].timestamp) : null;
    return {
      eventsCount: eventIds.length,
      totalSpent,
      cities,
      venues,
      firstPurchase,
      avgTicket: orders.length > 0 ? totalSpent / orders.length : 0,
    };
  }, [orders, events]);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 px-6 border border-moonlight/8 rounded-3xl bg-midnight/30 backdrop-blur-sm max-w-md mx-auto">
        <BarChart2 className="w-8 h-8 text-moonlight/30 mx-auto mb-3" />
        <p className="text-moonlight/55 text-sm">Sin estadísticas todavía. Comprá tu primer ticket.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 md:gap-4">
      <StatCell label="Eventos asistidos" value={String(stats.eventsCount)} />
      <StatCell label="Total invertido" value={`$${Math.round(stats.totalSpent / 1000)}K`} hint="COP" />
      <StatCell label="Ticket promedio" value={`$${Math.round(stats.avgTicket / 1000)}K`} hint="COP" />
      <StatCell label="Ciudades" value={String(stats.cities.length)} hint={stats.cities.slice(0, 2).join(' · ')} />
      <StatCell
        label="Primera vez"
        value={stats.firstPurchase ? stats.firstPurchase.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).toUpperCase() : '—'}
        hint={stats.firstPurchase ? `hace ${Math.floor((Date.now() - stats.firstPurchase.getTime()) / (1000 * 60 * 60 * 24))} días` : undefined}
      />
      <StatCell
        label="Venue favorito"
        value={stats.venues[0] ?? '—'}
        hint={stats.venues.length > 1 ? `+ ${stats.venues.length - 1} más` : undefined}
      />
    </div>
  );
};

const StatCell: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-moonlight/10 bg-midnight/30 p-4 md:p-5">
    <p className="text-[9px] font-black tracking-[0.3em] text-moonlight/40 uppercase mb-2">{label}</p>
    <p className="text-xl md:text-2xl font-black text-moonlight tabular-nums tracking-tight">{value}</p>
    {hint && <p className="text-[10px] text-moonlight/40 font-light mt-1 truncate">{hint}</p>}
  </div>
);

// ── ReferralsTab — código + invitados + crédito ──────────────────────────

const ReferralsTab: React.FC<{ email: string | null; customerName: string }> = ({ email, customerName }) => {
  const [code, setCode] = useState<string | null>(null);
  const [invites, setInvites] = useState(0);
  const [credit, setCredit] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) { setLoading(false); return; }
    (async () => {
      const e = email.toLowerCase();
      // Buscar referral existente
      const { data: existing } = await supabase.from('customer_referrals').select('*').eq('email', e).maybeSingle();
      if (existing) {
        setCode(existing.code);
        setInvites(Number(existing.invites_count) || 0);
        setCredit(Number(existing.credit_amount) || 0);
        setLoading(false);
        return;
      }
      // Generar nuevo
      const prefix = (customerName.split(' ')[0] || 'MID').toUpperCase().slice(0, 4).replace(/[^A-Z]/g, '') || 'MID';
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      const newCode = `${prefix}${suffix}`;
      const { error } = await supabase.from('customer_referrals').insert({ email: e, code: newCode });
      if (!error) {
        setCode(newCode);
      }
      setLoading(false);
    })();
  }, [email, customerName]);

  if (loading) {
    return <div className="max-w-md mx-auto p-8 text-center text-moonlight/40 text-sm"><Loader2 className="animate-spin mx-auto" /></div>;
  }
  if (!email || !code) {
    return <div className="max-w-md mx-auto p-8 text-center text-moonlight/50 text-sm">Iniciá sesión para activar tu programa de referidos.</div>;
  }

  const link = `https://midnightcorp.click/?ref=${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Link copiado');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('No pudimos copiar'); }
  };

  const handleWhatsApp = () => {
    const msg = `Te invito a Midnight. Si comprás con mi link, ambos ganamos crédito 🌙\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl border border-eclipse/40 bg-eclipse/10 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-eclipse" />
          <p className="text-[10px] font-black tracking-[0.3em] text-moonlight uppercase">Tu código</p>
        </div>
        <p className="text-3xl md:text-4xl font-black text-moonlight tracking-tighter font-mono mb-3">{code}</p>
        <p className="text-xs text-moonlight/55 mb-4 leading-relaxed">
          Compartí este link. Cuando un amigo compra, vos ganás <strong className="text-moonlight">$10K crédito</strong> y él 10% off su primera compra.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-void/60 border border-moonlight/10 rounded-xl px-3 py-2">
            <code className="flex-1 text-[11px] text-moonlight font-mono truncate">{link}</code>
            <button onClick={handleCopy} className="text-moonlight/60 hover:text-moonlight transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <button
            onClick={handleWhatsApp}
            className="w-full h-11 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-black text-[11px] uppercase tracking-[0.25em] rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle size={14} /> Compartir por WhatsApp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCell label="Invitados" value={String(invites)} hint={invites === 0 ? 'Aún ninguno' : invites === 1 ? 'amigo' : 'amigos'} />
        <StatCell label="Crédito acumulado" value={`$${Math.round(credit / 1000)}K`} hint="COP — canjeable" />
      </div>
    </div>
  );
};

/* ── Filter Bar sub-component ──────────────────────────────────────────────── */
function FilterBar({ filterEventId, setFilterEventId, viewMode, setViewMode, eventOptions = [], showViewToggle }: any) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
      <select
        value={filterEventId}
        onChange={e => setFilterEventId(e.target.value)}
        className="bg-midnight/60 border border-moonlight/10 rounded-2xl px-4 h-11 text-[10px] font-black text-moonlight uppercase tracking-widest focus:border-eclipse outline-none w-full sm:w-52 backdrop-blur-sm transition-colors appearance-none"
      >
        <option value="all">Todos los eventos</option>
        {eventOptions.map((e: any) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// Solstice reservation banner — visible si el cliente tiene reserva activa
// Da entrada cinematográfica a /sol (MiSemana) desde el wallet de Midnight.
// ─────────────────────────────────────────────────────────────────────────────

interface SolsticeReg {
  id: string;
  customer_name: string;
  customer_university: string;
  status: string;
  amount_paid: number;
  total_amount: number;
  installments_remaining: number;
  week: { university: string; start_date: string; end_date: string } | null;
}

const SolsticeReservationBanner: React.FC<{ email: string }> = ({ email }) => {
  const [reg, setReg]       = useState<SolsticeReg | null>(null);
  const [loading, setL]     = useState(true);
  const [countdown, setCd]  = useState<{ days: number; hours: number; mins: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('solstice_registrations')
          .select('id, customer_name, customer_university, status, amount_paid, total_amount, installments_remaining, solstice_weeks(university, start_date, end_date)')
          .eq('customer_email', email)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (mounted) {
          if (data) {
            const r: any = data;
            setReg({ ...r, week: r.solstice_weeks ?? null });
          } else {
            setReg(null);
          }
        }
      } catch {
        if (mounted) setReg(null);
      } finally {
        if (mounted) setL(false);
      }
    })();
    return () => { mounted = false; };
  }, [email]);

  useEffect(() => {
    if (!reg?.week?.start_date) {
      setCd(null);
      return;
    }
    const calc = () => {
      const diff = new Date(reg.week!.start_date + 'T00:00:00').getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
      return {
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000) / 60000),
      };
    };
    setCd(calc());
    const id = setInterval(() => setCd(calc()), 30_000);
    return () => clearInterval(id);
  }, [reg?.week?.start_date]);

  if (loading || !reg) return null;

  const firstName = (reg.customer_name || '').split(' ')[0] || 'Tu pase';
  const paidK     = Math.round(reg.amount_paid / 1000);
  const totalK    = Math.round(reg.total_amount / 1000);
  const progressPct = reg.total_amount > 0 ? Math.min(100, (reg.amount_paid / reg.total_amount) * 100) : 0;
  const isComplete  = reg.installments_remaining === 0;

  return (
    <motion.a
      href="/sol"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="block relative overflow-hidden mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(230,57,47,0.18) 0%, rgba(255,122,0,0.08) 100%)',
        border: '0.5px solid rgba(230,57,47,0.40)',
        borderRadius: '24px',
        padding: '22px 24px',
        textDecoration: 'none',
        color: '#F9F2D7',
        boxShadow: '0 20px 40px rgba(230,57,47,0.10)',
      }}
    >
      {/* Atmospheric glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: '-15%', top: '-30%',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(230,57,47,0.30) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 flex items-center gap-5">
        <div
          className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #E6392F, #FF7A00)',
            boxShadow: '0 8px 24px rgba(230,57,47,0.45)',
          }}
        >
          <Sparkles size={20} color="#fff" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[9px] md:text-[10px] uppercase mb-1" style={{ letterSpacing: '0.4em', color: '#E6392F', fontWeight: 700 }}>
            Solstice 2026 · {reg.week?.university || reg.customer_university}
          </p>
          <p className="text-base md:text-lg" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {countdown && countdown.days > 0 ? (
              <>Faltan <strong style={{ color: '#fff' }}>{countdown.days}</strong> días, {firstName}</>
            ) : isComplete ? (
              <>Listo, {firstName} · combo 100% pagado ✓</>
            ) : (
              <>Tu reserva está activa, {firstName}</>
            )}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 max-w-[200px] h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div style={{
                width: `${progressPct}%`,
                height: '100%',
                background: isComplete ? '#10b981' : '#E6392F',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <span className="text-[10px] uppercase tabular-nums whitespace-nowrap" style={{
              color: 'rgba(249,242,215,0.65)',
              letterSpacing: '0.2em',
              fontWeight: 500,
            }}>
              ${paidK}K / ${totalK}K
            </span>
          </div>
        </div>

        <ChevronRight size={18} style={{ color: '#E6392F', flexShrink: 0 }} />
      </div>
    </motion.a>
  );
};
