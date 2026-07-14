import React, { useEffect, useMemo, useState } from 'react';
import { motion as _motion } from 'framer-motion';
import { ArrowRight, MapPin, Clock, Users, Shirt, Calendar, ChevronLeft, ArrowUpRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Event, TicketTier } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import { formatDoors } from './Showcase';

const motion = _motion as any;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface Props {
  eventId: string;
  onBuy: (event: Event) => void;
  onBack: () => void;
}

export const EventDetail: React.FC<Props> = ({ eventId, onBuy, onBack }) => {
  const { events, tiers } = useStore();
  const [hasScrolled, setHasScrolled] = useState(false);

  const event = useMemo(() => events.find(e => e.id === eventId), [events, eventId]);
  const eventTiers = useMemo(
    () => tiers.filter(t => t.event_id === eventId && t.active)
               .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0)),
    [tiers, eventId]
  );

  useEffect(() => {
    if (event) document.title = `${event.title} | MIDNIGHT CORP`;
  }, [event?.title]);

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 200);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Edition number determinista (mismo cálculo que en el Hero del Showcase)
  const editionNumber = useMemo(() => {
    if (!event) return '000';
    const seed = event.id.replace(/[^0-9a-f]/gi, '').slice(0, 6);
    return String(parseInt(seed, 16) % 999).padStart(3, '0');
  }, [event?.id]);

  // Stats agregadas
  const { fromPrice, soldPercent, isLowStock, isSoldOut } = useMemo(() => {
    const soldOut = event?.status === 'sold_out';
    if (eventTiers.length === 0) {
      return { fromPrice: null, soldPercent: 0, isLowStock: false, isSoldOut: soldOut };
    }
    const active = eventTiers.filter(t => t.quantity > 0);
    const fromPrice = active.length > 0 ? Math.min(...active.map(t => Number(t.price) || 0)) : null;
    const totalQty = eventTiers.reduce((s, t) => s + (Number(t.quantity) || 0), 0);
    const totalSold = eventTiers.reduce((s, t) => s + (Number(t.sold) || 0), 0);
    const pct = totalQty > 0 ? Math.min(100, Math.round((totalSold / totalQty) * 100)) : 0;
    return { fromPrice, soldPercent: pct, isLowStock: pct >= 80 && pct < 100, isSoldOut: soldOut };
  }, [eventTiers, event?.status]);

  if (!event) {
    return (
      <div className="min-h-screen bg-void text-moonlight flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-moonlight/40 mb-3">Error</p>
        <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-6">Evento no encontrado</h1>
        <button onClick={onBack} className="text-[11px] uppercase tracking-[0.3em] font-bold text-moonlight/60 hover:text-moonlight transition-colors">
          ← Volver al inicio
        </button>
      </div>
    );
  }

  const eventDate = new Date(event.event_date);
  const formattedDateLong = eventDate.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const doorsTime = formatDoors(event.doors_open);

  const gmapsHref = event.venue_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.venue_address} ${event.city}`)}`
    : null;

  const handleBuy = () => { if (!isSoldOut) onBuy(event); };

  return (
    <div className="min-h-screen bg-void text-moonlight font-sans relative">
      {/* ── Back ─────────────────────────────────────────────────────────── */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        onClick={onBack}
        className="fixed top-6 left-6 md:top-8 md:left-8 z-40 flex items-center gap-2 text-[10px] md:text-[11px] uppercase tracking-[0.3em] font-bold text-moonlight/60 hover:text-moonlight transition-colors bg-void/40 backdrop-blur-md border border-moonlight/10 rounded-full px-4 py-2"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Volver</span>
      </motion.button>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[90vh] md:min-h-screen flex items-end overflow-hidden">
        <motion.img
          src={event.cover_image || 'https://images.unsplash.com/photo-1514525253361-bee8a19740c1?w=1920&fit=crop'}
          alt={event.title}
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-void/30 via-void/40 to-void" />
        <div className="absolute inset-0 noise-overlay opacity-50" />

        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 pb-20 md:pb-24 space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: EASE_OUT }}
            className="flex items-center gap-3 flex-wrap"
          >
            <span className="text-[10px] font-mono tracking-[0.4em] text-moonlight/50 uppercase">
              Edition {editionNumber}
            </span>
            <span className="w-1 h-1 rounded-full bg-moonlight/30" />
            <span className="text-[10px] font-mono tracking-[0.4em] text-moonlight/50 uppercase">
              Year {eventDate.getFullYear()}
            </span>
            {isSoldOut ? (
              <span className="text-[10px] font-black tracking-[0.4em] text-red-400 uppercase ml-2">· Sold Out</span>
            ) : (
              <span className="flex items-center gap-2 ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
                <span className="text-[10px] font-black tracking-[0.4em] text-moonlight/60 uppercase">Venta Activa</span>
              </span>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: EASE_OUT }}
            className="text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[6rem] font-black tracking-[-0.04em] uppercase leading-[0.9] max-w-4xl"
          >
            {event.title}
          </motion.h1>

          {event.artists && event.artists.length > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5, ease: EASE_OUT }}
              className="text-xs md:text-sm font-light tracking-[0.25em] text-moonlight/65 uppercase max-w-2xl"
            >
              {event.artists.slice(0, 5).join(' · ')}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease: EASE_OUT }}
            className="pt-3"
          >
            <p className="text-[9px] font-bold tracking-[0.4em] text-moonlight/40 uppercase mb-3">Faltan</p>
            <CountdownTimer targetDate={event.event_date} />
          </motion.div>
        </div>
      </section>

      {/* ── FICHA TÉCNICA ───────────────────────────────────────────────── */}
      <section className="border-y border-moonlight/10 bg-void/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <InfoCell icon={<Calendar className="w-4 h-4" />} label="Date" value={formattedDateLong} />
          <InfoCell icon={<Clock className="w-4 h-4" />} label="Doors" value={doorsTime} />
          <InfoCell icon={<Shirt className="w-4 h-4" />} label="Dress Code" value={event.dress_code || 'Strict Nightlife'} />
          <InfoCell icon={<Users className="w-4 h-4" />} label="Edad mínima" value={`${event.min_age ?? 18}+`} />
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────────────────────── */}
      {event.description && (
        <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24">
          <SectionTitle eyebrow="Sobre el evento" title="El protocolo de la noche" />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="text-base md:text-lg font-light leading-relaxed text-moonlight/75 whitespace-pre-line"
          >
            {event.description}
          </motion.p>
        </section>
      )}

      {/* ── LINEUP ──────────────────────────────────────────────────────── */}
      {event.artists && event.artists.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 border-t border-moonlight/5">
          <SectionTitle eyebrow="Lineup" title={`${event.artists.length} ${event.artists.length === 1 ? 'Artist' : 'Artistas'}`} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {event.artists.map((artist, i) => (
              <motion.div
                key={`${artist}-${i}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: EASE_OUT }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-moonlight/10 bg-midnight/40 flex items-end p-4 md:p-5 cursor-default"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-eclipse/10 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 text-[9px] font-mono tracking-[0.3em] text-moonlight/30">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p className="relative text-base md:text-lg font-black tracking-tight text-moonlight uppercase leading-tight">
                  {artist}
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── TIERS DETALLADOS ────────────────────────────────────────────── */}
      <section id="tiers" className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 border-t border-moonlight/5">
        <SectionTitle eyebrow="Entradas" title="Tu nivel de acceso" />
        <div className="space-y-3 md:space-y-4">
          {eventTiers.length === 0 ? (
            <p className="text-moonlight/40 text-sm">Tiers no disponibles aún.</p>
          ) : (
            eventTiers.map((tier, i) => <TierCard key={tier.id} tier={tier} index={i} />)
          )}
        </div>

        {/* % de venta OCULTO al público (decisión del owner): el cliente no debe
            ver cuánto se ha vendido. La info de ventas vive solo en el admin. */}
      </section>

      {/* ── VENUE ──────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 border-t border-moonlight/5">
        <SectionTitle eyebrow="Venue" title={event.venue || 'TBA'} />
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="space-y-3"
          >
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-moonlight/40 mt-1 flex-shrink-0" />
              <div>
                {event.venue_address && (
                  <p className="text-base md:text-lg font-light text-moonlight/85 leading-relaxed">{event.venue_address}</p>
                )}
                <p className="text-[10px] font-black tracking-[0.4em] text-moonlight/40 uppercase mt-1">{event.city}</p>
              </div>
            </div>
            {gmapsHref && (
              <a
                href={gmapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-[11px] uppercase tracking-[0.3em] font-bold text-moonlight/60 hover:text-moonlight transition-colors"
              >
                Cómo llegar <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
            className="relative aspect-video rounded-lg overflow-hidden border border-moonlight/10 bg-midnight/40"
          >
            <img
              src={event.cover_image || ''}
              alt={event.venue}
              className="w-full h-full object-cover opacity-50 blur-sm"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-eclipse/20 to-void/60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-moonlight/50" strokeWidth={1.2} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── GALERÍA (si existe) ─────────────────────────────────────────── */}
      {event.gallery && event.gallery.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 md:px-12 py-16 md:py-24 border-t border-moonlight/5">
          <SectionTitle eyebrow="Archivo" title="Ediciones pasadas" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {event.gallery.map((src, i) => (
              <motion.div
                key={`${src}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.04, duration: 0.5, ease: EASE_OUT }}
                className="relative aspect-[3/4] overflow-hidden rounded-md border border-moonlight/5"
              >
                <img src={src} alt={`${event.title} archivo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 md:px-12 py-16 md:py-24 border-t border-moonlight/5">
        <SectionTitle eyebrow="Antes de venir" title="Lo que debes saber" />
        <div className="space-y-5">
          {event.faq && event.faq.length > 0 ? (
            // FAQ específico del evento (editado en Backoffice)
            event.faq.map((item, i) => (
              <FaqItem key={i} q={item.q}>{item.a}</FaqItem>
            ))
          ) : (
            // FAQ genérico de la plataforma cuando el evento no define el suyo
            <>
              <FaqItem q="¿Cómo recibo mi entrada?">
                Tras el pago recibirás un email con un QR único. Ese QR es tu acceso — preséntalo en la puerta desde tu celular.
              </FaqItem>
              <FaqItem q="¿Puedo transferir mi entrada a alguien más?">
                Sí. Desde tu billetera de Midnight puedes transferir el ticket a otra persona vía su email.
              </FaqItem>
              <FaqItem q="¿Aceptan efectivo en la puerta?">
                Si el cupo lo permite, sí — pero el precio en taquilla es mayor. Recomendamos comprar online antes.
              </FaqItem>
              <FaqItem q="¿Qué pasa si el evento se cancela?">
                Te contactaremos por email con instrucciones para el reembolso o reagendamiento.
              </FaqItem>
            </>
          )}
        </div>
      </section>

      {/* ── BOTTOM SPACE para no tapar contenido con sticky CTA ────────── */}
      <div className="h-32 md:h-24" />

      {/* ── STICKY CTA BOTTOM (móvil + desktop) ─────────────────────────── */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: hasScrolled ? 0 : 80, opacity: hasScrolled ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="fixed bottom-0 inset-x-0 z-30 bg-void/85 backdrop-blur-2xl border-t border-moonlight/10"
      >
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-4 md:py-5 flex items-center gap-4 md:gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.3em] text-moonlight/40 uppercase truncate">{event.title}</p>
            {fromPrice !== null && (
              <p className="text-sm md:text-base font-black tracking-tight text-moonlight font-mono">
                Desde ${fromPrice.toLocaleString('es-CO')} <span className="text-[10px] font-light text-moonlight/40">COP</span>
              </p>
            )}
          </div>
          <button
            onClick={handleBuy}
            disabled={isSoldOut}
            className={`group relative overflow-hidden flex-shrink-0 px-6 md:px-10 py-3.5 md:py-4 rounded-lg transition-all duration-300 active:scale-[0.98] ${
              isSoldOut
                ? 'bg-moonlight/5 cursor-not-allowed border border-moonlight/10'
                : 'bg-moonlight text-void hover:bg-white'
            }`}
          >
            <span className={`relative z-10 text-[10px] md:text-[11px] font-black tracking-[0.4em] uppercase flex items-center gap-2 md:gap-3 ${
              isSoldOut ? 'text-moonlight/30' : 'text-void'
            }`}>
              {isSoldOut ? 'Sold Out' : 'Reservar'}
              {!isSoldOut && <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />}
            </span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Subcomponentes ────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-100px' }}
    transition={{ duration: 0.5, ease: EASE_OUT }}
    className="mb-8 md:mb-12"
  >
    <p className="text-[10px] font-bold tracking-[0.4em] text-moonlight/40 uppercase mb-3">{eyebrow}</p>
    <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-moonlight leading-tight">{title}</h2>
  </motion.div>
);

const InfoCell: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-2 text-moonlight/40">
      {icon}
      <span className="text-[9px] font-bold tracking-[0.4em] uppercase">{label}</span>
    </div>
    <p className="text-sm md:text-base font-bold text-moonlight tracking-tight leading-tight">{value}</p>
  </div>
);

const TierCard: React.FC<{ tier: TicketTier; index: number }> = ({ tier, index }) => {
  const remaining = Math.max(0, (Number(tier.quantity) || 0) - (Number(tier.sold) || 0));
  const low = remaining > 0 && remaining <= 10;
  const out = remaining === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: EASE_OUT }}
      className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 md:p-6 rounded-lg border transition-all ${
        out ? 'border-moonlight/5 bg-moonlight/[0.02] opacity-50' : 'border-moonlight/10 bg-midnight/30 hover:border-moonlight/25'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 flex-wrap mb-1.5">
          <h3 className="text-base md:text-lg font-black tracking-tight text-moonlight uppercase">{tier.name}</h3>
          {out && <span className="text-[9px] font-black tracking-[0.3em] text-moonlight/40 uppercase">· Agotado</span>}
          {low && <span className="text-[9px] font-black tracking-[0.3em] text-red-400 uppercase">· Últimas {remaining}</span>}
        </div>
        {tier.description && (
          <p className="text-xs md:text-sm font-light text-moonlight/55 leading-relaxed">{tier.description}</p>
        )}
        {tier.perks && tier.perks.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {tier.perks.slice(0, 4).map((perk, i) => (
              <li key={i} className="text-[10px] tracking-[0.15em] uppercase text-moonlight/40 font-bold">
                · {perk}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="text-right md:text-right">
        <p className="text-2xl md:text-3xl font-black tracking-tight font-mono text-moonlight">
          ${Number(tier.price || 0).toLocaleString('es-CO')}
          <span className="text-[10px] font-light text-moonlight/40 ml-1.5">COP</span>
        </p>
      </div>
    </motion.div>
  );
};

const FaqItem: React.FC<{ q: string; children: React.ReactNode }> = ({ q, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen(o => !o)}
      className="w-full text-left border-b border-moonlight/10 pb-5 group"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm md:text-base font-bold text-moonlight uppercase tracking-tight">{q}</h3>
        <span className={`text-moonlight/40 text-lg leading-none transition-transform ${open ? 'rotate-45' : ''}`}>+</span>
      </div>
      {open && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="mt-3 text-sm font-light text-moonlight/60 leading-relaxed"
        >
          {children}
        </motion.p>
      )}
    </button>
  );
};

export default EventDetail;
