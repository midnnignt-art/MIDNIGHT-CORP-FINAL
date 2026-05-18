import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Event } from '../types';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import { CountdownTimer } from '../components/CountdownTimer';
import { MouseTrail } from '../components/MouseTrail';
import { ArrowRight, Barcode, ChevronDown } from 'lucide-react';
import { EclipseLoader } from '../components/EclipseLoader';
import MarqueeGallery from '../components/MarqueeGallery';

const motion = _motion as any;

// Easing premium (Posh/Shotgun-style smooth entrance)
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface ShowcaseProps {
  onBuy: (event: Event) => void;
  onNavigate?: (page: string) => void;
}

export const Showcase: React.FC<ShowcaseProps> = ({ onBuy, onNavigate }) => {
  const { events, tiers, dbStatus } = useStore();
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(() => dbStatus === 'synced' ? 100 : 0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(() => dbStatus === 'synced');

  useEffect(() => {
    const now = new Date().getTime();
    const filtered = events
      .filter(e => (e.status === 'published' || e.status === 'sold_out') && new Date(e.event_date).getTime() > now)
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    setActiveEvents(filtered);
  }, [events]);

  useEffect(() => {
    if (dbStatus === 'syncing' || !isFullyLoaded) {
      let frameId: number;
      let lastTime = performance.now();
      const update = (time: number) => {
        const deltaTime = time - lastTime;
        lastTime = time;
        setLoadingProgress(prev => {
          if (prev >= 100) {
            if (dbStatus === 'synced') {
              cancelAnimationFrame(frameId);
              setTimeout(() => setIsFullyLoaded(true), 1000);
              return 100;
            }
            return 100;
          }
          const baseSpeed = prev < 90 ? 0.025 : 0.005;
          const jitter = 0.5 + Math.random();
          return Math.min(prev + baseSpeed * deltaTime * jitter, 100);
        });
        frameId = requestAnimationFrame(update);
      };
      frameId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frameId);
    }
  }, [dbStatus, isFullyLoaded]);

  const showLoader = !isFullyLoaded && (dbStatus === 'syncing' || loadingProgress < 100);

  return (
    <>
      <AnimatePresence>
        {showLoader && <EclipseLoader key="loader" progress={loadingProgress} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isFullyLoaded ? 1 : 0 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full bg-void font-sans"
      >
      {activeEvents.length === 0 ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <div className="relative w-24 h-24 flex items-center justify-center mb-8">
            <div className="absolute inset-0 bg-eclipse/20 blur-2xl rounded-full" />
            <div className="relative w-full h-full rounded-full bg-midnight/60 border border-eclipse/20 flex items-center justify-center shadow-[0_0_40px_rgba(73,15,124,0.2)]">
              <Barcode className="w-10 h-10 text-moonlight/30" strokeWidth={1} />
            </div>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-moonlight uppercase tracking-tighter mb-4">Próximamente</h2>
          <div className="w-12 h-px bg-eclipse mx-auto mb-5" />
          <p className="text-moonlight/40 text-xs md:text-sm font-light tracking-[0.25em] uppercase max-w-md leading-relaxed">
            Estamos preparando las próximas experiencias. Suscríbete para ser el primero en enterarte.
          </p>
        </div>
      ) : (<>
      <MouseTrail />
      <div className="noise-overlay" />

      {activeEvents.map((event, index) => (
        <HeroEvent
          key={event.id}
          event={event}
          tiers={tiers.filter(t => t.event_id === event.id && t.active)}
          index={index}
          totalEvents={activeEvents.length}
          onBuy={onBuy}
        />
      ))}

      <MarqueeGallery />

      <div className="relative z-20 bg-void py-20 border-t border-moonlight/5 text-center">
        <p className="text-[9px] text-moonlight/20 tracking-[0.5em] uppercase font-light">
          Midnight Worldwide • Experience Finance Protocol • 2026
        </p>
      </div>
      </>)}
      </motion.div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HeroEvent — sección por evento (lado izquierdo = signature; derecho = redesign)
// ─────────────────────────────────────────────────────────────────────────────

interface HeroEventProps {
  event: Event;
  tiers: any[];
  index: number;
  totalEvents: number;
  onBuy: (event: Event) => void;
}

const HeroEvent: React.FC<HeroEventProps> = ({ event, tiers, index, totalEvents, onBuy }) => {
  const isSoldOut = event.status === 'sold_out';
  const isSoonest = index === 0;
  const eventDate = new Date(event.event_date);

  const editionNumber = useMemo(() => {
    // Edition number determinista por evento (hash simple del id)
    const seed = event.id.replace(/[^0-9a-f]/gi, '').slice(0, 6);
    const num = parseInt(seed, 16) % 999;
    return String(num).padStart(3, '0');
  }, [event.id]);

  // Stats: precio mínimo + % vendido
  const { fromPrice, soldPercent, isLowStock } = useMemo(() => {
    if (tiers.length === 0) {
      return { fromPrice: null, soldPercent: 0, isLowStock: false };
    }
    const active = tiers.filter((t: any) => t.quantity > 0);
    const fromPrice = active.length > 0 ? Math.min(...active.map((t: any) => Number(t.price) || 0)) : null;
    const totalQty = tiers.reduce((s: number, t: any) => s + (Number(t.quantity) || 0), 0);
    const totalSold = tiers.reduce((s: number, t: any) => s + (Number(t.sold) || 0), 0);
    const pct = totalQty > 0 ? Math.min(100, Math.round((totalSold / totalQty) * 100)) : 0;
    return { fromPrice, soldPercent: pct, isLowStock: pct >= 80 && pct < 100 };
  }, [tiers]);

  const formattedDateLong = eventDate.toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  }).toUpperCase().replace('.', '');

  const doorsTime = event.doors_open
    ? new Date(event.doors_open).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '10:00 PM';

  const subtitle = event.artists?.length
    ? `A ${event.artists.slice(0, 3).join(' × ').toUpperCase()} NIGHT`
    : (event.description?.slice(0, 80).toUpperCase() || `${event.city.toUpperCase()} — ${event.venue.toUpperCase()}`);

  return (
    <div className="relative w-full flex flex-col md:flex-row md:min-h-screen border-b border-moonlight/5 last:border-b-0">
      {/* ── PANEL IZQUIERDO (signature — intocable) ──────────────────────── */}
      <div className="relative w-full md:w-[40%] h-[45vh] md:h-screen overflow-hidden border-b md:border-b-0 md:border-r border-moonlight/10">
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          <img
            src={event.cover_image || 'https://images.unsplash.com/photo-1514525253361-bee8a19740c1?w=1200&fit=crop'}
            alt={event.title}
            className="w-full h-full object-cover"
            loading={isSoonest ? 'eager' : 'lazy'}
            fetchPriority={isSoonest ? 'high' : 'auto'}
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-midnight/40 via-transparent to-void" />
        </motion.div>

        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20">
          <div className="border border-moonlight/30 rounded-full px-6 py-1.5 backdrop-blur-sm">
            <span className="text-[10px] font-light tracking-[0.5em] text-moonlight uppercase">Presents</span>
          </div>
        </div>

        <div className="absolute bottom-8 left-8 hidden md:block z-20">
          <div className="space-y-1 opacity-40">
            <p className="text-[8px] font-light tracking-widest text-moonlight uppercase">Midnight Worldwide</p>
            <p className="text-[8px] font-light tracking-widest text-moonlight uppercase">Experience Finance Protocol</p>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 flex items-center gap-4 z-20">
          <div className="text-right hidden md:block">
            <p className="text-[10px] font-black tracking-tighter text-moonlight">TIME SHIFT</p>
            <p className="text-[10px] font-light tracking-widest text-moonlight/60">12:00 MID</p>
          </div>
          <Barcode className="w-12 h-12 text-moonlight/40" strokeWidth={1} />
        </div>

        <div className="absolute top-24 left-8 text-[7px] font-light tracking-widest text-moonlight/30 uppercase leading-relaxed max-w-[120px] hidden md:block z-20">
          The transition from one day to the next. A moment of absolute potential.
        </div>
        <div className="absolute top-24 right-8 text-[7px] font-light tracking-widest text-moonlight/30 uppercase leading-relaxed max-w-[120px] text-right hidden md:block z-20">
          Architecture of the night. Curated for the modern vanguard.
        </div>
      </div>

      {/* ── PANEL DERECHO (redesign) ──────────────────────────────────────── */}
      <div className="relative w-full md:w-[60%] flex-1 md:h-screen flex flex-col items-center justify-start md:justify-center px-6 md:px-16 lg:px-20 bg-void pt-10 pb-16 md:py-0">

        {/* Meta línea top: FEATURED EVENT / EDITION 038 — YEAR 2026 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="absolute top-24 inset-x-12 hidden md:flex items-center justify-between z-20"
        >
          <span className="text-[10px] font-light tracking-[0.4em] text-moonlight/50 uppercase font-mono">
            {isSoonest ? 'Featured Event' : `Event 0${index + 1}`}
            <span className="text-moonlight/20 mx-2">·</span>
            Edition {editionNumber}
          </span>
          <span className="text-[10px] font-light tracking-[0.4em] text-moonlight/50 uppercase font-mono">
            Year {eventDate.getFullYear()}
          </span>
        </motion.div>

        {/* Bloque central */}
        <div className="w-full max-w-2xl space-y-6 md:space-y-7">

          {/* Tag pre-título */}
          {isSoonest && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05, duration: 0.5, ease: EASE_OUT }}
              className="flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.4em] text-moonlight/50 uppercase">
                Venta Activa · Próximo Evento
              </span>
            </motion.div>
          )}

          {/* Título gigante */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.7, ease: EASE_OUT }}
            className="text-[2.75rem] leading-[0.9] sm:text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-[-0.04em] text-moonlight uppercase break-words"
          >
            {event.title}
          </motion.h1>

          {/* Subtítulo: lineup */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
            className="text-[11px] sm:text-xs md:text-sm font-light tracking-[0.25em] text-moonlight/55 uppercase max-w-xl leading-relaxed"
          >
            {subtitle}
          </motion.p>

          {/* Ficha técnica 2×2 */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.4 } },
            }}
            className="grid grid-cols-2 gap-x-8 gap-y-5 pt-3 md:pt-5 border-t border-moonlight/10"
          >
            <FichaItem label="Venue"      value={event.venue || '—'} hint={event.venue_address} />
            <FichaItem label="Date"       value={formattedDateLong} />
            <FichaItem label="Doors"      value={doorsTime} />
            <FichaItem label="Dress Code" value={event.dress_code || 'Strict Nightlife'} />
          </motion.div>

          {/* Countdown compacto */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7, duration: 0.5, ease: EASE_OUT }}
            className="pt-3 md:pt-4 border-t border-moonlight/10"
          >
            <p className="text-[9px] font-bold tracking-[0.4em] text-moonlight/35 uppercase mb-3">Time Until Doors</p>
            <CountdownTimer targetDate={event.event_date} />
          </motion.div>

          {/* Tier preview: FROM $X — Y% SOLD */}
          {fromPrice !== null && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 0.5, ease: EASE_OUT }}
              className="space-y-2.5"
            >
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold tracking-[0.4em] text-moonlight/35 uppercase mb-1.5">From</p>
                  <p className="text-2xl md:text-3xl font-black tracking-tighter text-moonlight font-mono">
                    ${fromPrice.toLocaleString('es-CO')}
                    <span className="text-[10px] font-light tracking-widest text-moonlight/40 ml-2 align-middle">COP</span>
                  </p>
                </div>
                {soldPercent > 0 && (
                  <div className="text-right">
                    <p className={`text-[9px] font-bold tracking-[0.4em] uppercase mb-1.5 ${isLowStock ? 'text-red-400' : 'text-moonlight/35'}`}>
                      {isLowStock ? 'Almost Sold' : 'Vendido'}
                    </p>
                    <p className={`text-2xl md:text-3xl font-black tracking-tighter font-mono ${isLowStock ? 'text-red-400' : 'text-moonlight'}`}>
                      {soldPercent}<span className="text-[12px] font-light text-moonlight/40 align-middle">%</span>
                    </p>
                  </div>
                )}
              </div>

              {soldPercent > 0 && (
                <div className="relative w-full h-[2px] bg-moonlight/10 overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: soldPercent / 100 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.95, duration: 1.2, ease: EASE_OUT }}
                    style={{ originX: 0 }}
                    className={`absolute inset-y-0 left-0 right-0 ${isLowStock ? 'bg-red-400' : 'bg-moonlight'}`}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.0, duration: 0.4, ease: EASE_OUT }}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <button
              onClick={() => !isSoldOut && onBuy(event)}
              disabled={isSoldOut}
              className={`group relative overflow-hidden flex-1 py-5 md:py-6 rounded-lg transition-all duration-300 active:scale-[0.98] ${
                isSoldOut
                  ? 'bg-moonlight/5 cursor-not-allowed border border-moonlight/10'
                  : 'bg-moonlight text-void hover:bg-white'
              }`}
            >
              <span className={`relative z-10 text-[11px] md:text-xs font-black tracking-[0.5em] uppercase flex items-center justify-center gap-3 ${
                isSoldOut ? 'text-moonlight/30' : 'text-void'
              }`}>
                {isSoldOut ? 'Sold Out' : 'Reservar Entrada'}
                {!isSoldOut && <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />}
              </span>
              {!isSoldOut && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}
            </button>

            <button
              onClick={() => { window.location.href = `/event/${event.id}`; }}
              className="group flex-1 sm:flex-initial sm:px-8 py-5 md:py-6 rounded-lg border border-moonlight/15 hover:border-moonlight/40 transition-all duration-300 text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase text-moonlight/60 hover:text-moonlight"
            >
              Lineup & Detalles
            </button>
          </motion.div>

          {/* Trust strip */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1.15, duration: 0.5, ease: EASE_OUT }}
            className="text-[9px] text-moonlight/30 tracking-[0.3em] uppercase font-light pt-2 flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <span>Pago seguro · Bold</span>
            <span className="text-moonlight/15">·</span>
            <span>QR único anti-fraude</span>
            <span className="text-moonlight/15">·</span>
            <span>Tickets transferibles</span>
          </motion.p>
        </div>

        {isSoonest && totalEvents > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.3 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce"
          >
            <span className="text-[8px] font-light tracking-[0.4em] text-moonlight uppercase">Scroll</span>
            <ChevronDown className="text-moonlight w-4 h-4" />
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Mini-componente ficha técnica
const FichaItem: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 12 },
      show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
    }}
    className="space-y-1"
  >
    <p className="text-[9px] font-bold tracking-[0.4em] text-moonlight/35 uppercase">{label}</p>
    <p className="text-sm md:text-base font-bold text-moonlight tracking-tight leading-tight">{value}</p>
    {hint && (
      <p className="text-[10px] font-light text-moonlight/40 tracking-wide line-clamp-1">{hint}</p>
    )}
  </motion.div>
);
