import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Ship, Move, Check, X as XIcon, RotateCcw, Ticket, Star, CalendarDays, Plus, CreditCard } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useSolsticeLogo } from '../hooks/useSolsticeLogo';
import { useSolsticeLogoSize } from '../hooks/useSolsticeLogoSize';
import { useSolsticeLogoLayout } from '../hooks/useSolsticeLogoLayout';
import { useSolsticeLogoPosition } from '../hooks/useSolsticeLogoPosition';
import SolsticeAtmosphere from '../components/SolsticeAtmosphere';
import SolsticeMarquee from '../components/SolsticeMarquee';
import { fmtCOP } from '../constants';

const C = {
  bg:    '#000000',
  bgS:   '#0d0d0d',
  gray:  '#606060',
  red:   '#E6392F',
  cream: '#F9F2D7',
};

interface Props {
  onNavigate: (page: string) => void;
  isAdmin?: boolean;
}

interface Season {
  id: string; name: string; tagline: string;
  entry_price: number; combo_total: number; events_pack_total?: number; combo1_total: number;
  installments: number; combo1_installments: number;
  phase1_limit: number | null; phase_increment: number | null;
  phase_increment_type: 'fixed' | 'percent';
}

interface Week {
  id: string; university: string; start_date: string; end_date: string; capacity: number;
}

interface Day {
  day_number: number; title: string; subtitle: string;
  price: number; highlight: boolean;
}

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(targetDate: string) {
  const calc = useCallback(() => {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, pct: 100 };
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    // Urgency: 0% if 180+ days away → 100% when event arrives
    const pct = Math.max(0, Math.min(100, (1 - days / 180) * 100));
    return { days, hours, mins, secs, pct };
  }, [targetDate]);

  const [val, setVal] = useState(calc);
  useEffect(() => {
    setVal(calc());
    const id = setInterval(() => setVal(calc()), 1000);
    return () => clearInterval(id);
  }, [calc]);
  return val;
}

// ── Week card ──────────────────────────────────────────────────────────────────
function WeekCard({ week, reserved, onSelect, idx }: { week: Week; reserved: number; onSelect: () => void; idx: number }) {
  const { days, hours, mins, secs, pct } = useCountdown(week.start_date);
  const urgent = days < 30;
  const occupancyPct = week.capacity > 0 ? Math.min(100, (reserved / week.capacity) * 100) : 0;
  const isHot = occupancyPct >= 60;
  const isAlmostFull = occupancyPct >= 85;
  const remaining = Math.max(0, week.capacity - reserved);
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
      className="relative p-8 flex flex-col"
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(32px) saturate(180%)',
        border: urgent ? '0.5px solid rgba(230,57,47,0.35)' : '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: '28px',
        boxShadow: hovered ? '0 32px 64px rgba(0,0,0,0.40)' : '0 24px 48px rgba(0,0,0,0.25)',
        transform: hovered ? 'translateY(-4px) scale(1.005)' : 'translateY(0) scale(1)',
        transition: '0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {urgent && (
        <div
          className="absolute -top-3 left-6 px-3 py-1 text-[9px] uppercase font-medium"
          style={{
            background: C.red,
            letterSpacing: '0.08em',
            borderRadius: '999px',
            fontWeight: 500,
          }}>
          ¡Últimos días!
        </div>
      )}

      {isAlmostFull && !urgent && (
        <div
          className="absolute -top-3 left-6 px-3 py-1 text-[9px] uppercase flex items-center gap-1.5"
          style={{
            background: '#FFB48C', color: '#0a0a0a',
            letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 700,
          }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: '#0a0a0a', animation: 'pulse 1.6s ease-in-out infinite' }} />
          ¡Casi llena!
        </div>
      )}
      {isHot && !isAlmostFull && !urgent && (
        <div
          className="absolute -top-3 left-6 px-3 py-1 text-[9px] uppercase"
          style={{
            background: 'rgba(255,180,140,0.20)',
            color: '#FFB48C',
            border: '0.5px solid rgba(255,180,140,0.45)',
            letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600,
          }}>
          🔥 Trending
        </div>
      )}

      <h3 className="text-2xl mb-1 uppercase"
        style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em', fontWeight: 300 }}>
        {week.university}
      </h3>
      <p className="text-xs mb-6 uppercase" style={{ letterSpacing: '0.2em', color: C.gray, fontWeight: 500 }}>
        {new Date(week.start_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
        {' — '}
        {new Date(week.end_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
      </p>

      {/* Countdown — fondo sólido para evitar inconsistencias visuales
          al apilarse sobre el backdrop-filter del card padre */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[['días', days], ['hrs', hours], ['min', mins], ['seg', secs]].map(([label, val]) => (
          <div
            key={String(label)}
            className="flex flex-col items-center justify-center py-3 px-2"
            style={{
              background: 'rgba(0,0,0,0.55)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '14px',
              minHeight: '64px',
            }}
          >
            <span className="text-xl font-semibold leading-none tabular-nums" style={{ color: urgent ? C.red : C.cream }}>
              {String(val).padStart(2, '0')}
            </span>
            <span className="text-[8px] uppercase mt-1.5" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 600 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Reservas / ocupación OCULTAS al público (pedido owner): que no se vea
          "1 reserva", "8/120", etc. Se mantiene solo el countdown de días. */}

      {/* Urgency bar (días al evento) */}
      <div className="w-full h-[2px] mb-1" style={{ background: `${C.gray}20`, borderRadius: '999px' }}>
        <motion.div className="h-full"
          initial={{ width: 0 }} whileInView={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ background: urgent ? C.red : `${C.red}80`, borderRadius: '999px' }} />
      </div>
      <p className="text-[9px] uppercase mb-8" style={{ color: urgent ? `${C.red}90` : C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
        {days > 0 ? `Faltan ${days} días` : 'Comenzando'}
      </p>

      <button
        onClick={onSelect}
        className="w-full py-3 text-xs uppercase transition-all mt-auto"
        style={{
          border: btnHovered ? '0.5px solid rgba(230,57,47,0.45)' : '0.5px solid rgba(255,255,255,0.10)',
          color: btnHovered ? C.red : C.gray,
          letterSpacing: '0.08em',
          borderRadius: '999px',
          background: btnHovered ? 'rgba(230,57,47,0.22)' : 'transparent',
          transform: btnHovered ? 'translateY(-1px)' : 'none',
          boxShadow: btnHovered ? '0 8px 24px rgba(230,57,47,0.25)' : 'none',
          transition: 'all 0.3s ease',
          fontWeight: 500,
        }}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
      >
        Seleccionar semana
      </button>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SolsticeLanding({ onNavigate, isAdmin }: Props) {
  const [logoUrl] = useSolsticeLogo();
  const [logoSize] = useSolsticeLogoSize('landing');
  const [logoLayout] = useSolsticeLogoLayout('landingHero');
  const [pos, setPos] = useSolsticeLogoPosition();

  // Edit mode drag state
  const [editMode, setEditMode] = useState(false);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  useEffect(() => { if (editMode) setDragPos(pos); }, [editMode]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { mx: e.clientX, my: e.clientY, ox: dragPos.x, oy: dragPos.y };
    e.preventDefault();
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setDragPos({ x: startRef.current.ox + (e.clientX - startRef.current.mx), y: startRef.current.oy + (e.clientY - startRef.current.my) });
  };
  const handlePointerUp = () => setIsDragging(false);

  const [season, setSeason] = useState<Season | null>(null);
  const [weeks,  setWeeks]  = useState<Week[]>([]);
  const [days,   setDays]   = useState<Day[]>([]);
  const [cheapestBoat, setCheapestBoat] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [ctaHovered, setCtaHovered] = useState(false);
  // CTA sticky: aparece cuando el usuario pasa el hero (~80vh)
  const [showStickyCta, setShowStickyCta] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.85;
      setShowStickyCta(window.scrollY > threshold);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [finalCtaHovered, setFinalCtaHovered] = useState(false);

  useEffect(() => {
    document.title = 'SOLSTICE 2026';
    return () => { document.title = 'MIDNIGHT Worldwide'; };
  }, []);

  // Live count de reservas por universidad (clave: university string, valor: count)
  const [reservedByUni, setReservedByUni] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: w }, { data: d }, { data: b }] = await Promise.all([
          supabase.from('solstice_seasons').select('*').eq('status', 'open').single(),
          supabase.from('solstice_weeks').select('*').order('start_date'),
          supabase.from('solstice_program_days').select('*').order('day_number'),
          supabase.from('solstice_boats').select('price_per_person').eq('status', 'active'),
        ]);
        if (s) setSeason(s as Season);
        if (w?.length) setWeeks(w as Week[]);
        if (d?.length) setDays(d as Day[]);
        if (b?.length) {
          const prices = b.map((x: any) => Number(x.price_per_person) || 0).filter((p: number) => p > 0);
          if (prices.length) setCheapestBoat(Math.min(...prices));
        }
      } catch { /* fallback to defaults below */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Reservas por semana + realtime — cuando alguien reserva, el contador sube
  useEffect(() => {
    let mounted = true;

    async function loadReservedCounts() {
      try {
        const { data } = await supabase
          .from('solstice_registrations')
          .select('customer_university, status')
          .neq('status', 'cancelled');
        if (!data || !mounted) return;
        const map: Record<string, number> = {};
        for (const r of data) {
          const uni = (r.customer_university || '').trim();
          if (uni) map[uni] = (map[uni] || 0) + 1;
        }
        setReservedByUni(map);
      } catch {}
    }

    loadReservedCounts();

    const channel = supabase
      .channel('solstice-landing-registrations')
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'solstice_registrations' },
        () => loadReservedCounts(),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Fallbacks if DB is empty
  const s: Season = season ?? {
    id: '', name: 'SOLSTICE 2026', tagline: 'SELECTED BEATS. PRIVATE SUNSET.',
    entry_price: 40000, combo_total: 400000, events_pack_total: 125000, combo1_total: 300000,
    installments: 5, combo1_installments: 5,
    phase1_limit: null, phase_increment: null, phase_increment_type: 'fixed',
  };

  const displayWeeks: Week[] = weeks.length ? weeks : [
    { id: 'w1', university: 'Javeriana', start_date: '2026-09-14', end_date: '2026-09-20', capacity: 120 },
    { id: 'w2', university: 'Los Andes', start_date: '2026-09-28', end_date: '2026-10-03', capacity: 120 },
    { id: 'w3', university: 'CESA',      start_date: '2026-10-05', end_date: '2026-10-11', capacity: 80 },
  ];

  const displayDays: Day[] = days.length ? days : [
    { day_number: 1, title: 'Llegada',       subtitle: 'Apertura nocturna',         price: 70000,  highlight: false },
    { day_number: 2, title: 'Día libre',     subtitle: 'Fiesta nocturna',           price: 70000,  highlight: false },
    { day_number: 3, title: 'Lanchas + Beach Club',     subtitle: 'DJ · AYCD · Bahía privada', price: 130000, highlight: true  },
    { day_number: 4, title: 'Playa privada', subtitle: 'All you can drink',         price: 100000, highlight: false },
    { day_number: 5, title: 'Cierre',        subtitle: 'Última noche',              price: 70000,  highlight: false },
  ];

  const entryK = Math.round(s.entry_price / 1000);
  const comboK = Math.round(s.combo_total / 1000);
  const cuotaK = Math.round(s.combo_total / (s.installments || 1) / 1000);
  const combo1K = Math.round(s.combo1_total / 1000);
  const cuota1K = Math.round(s.combo1_total / (s.combo1_installments || 1) / 1000);
  // Precios en pesos completos (claros): "$150.000" en vez de "150K".
  const entryCOP  = fmtCOP(s.entry_price);
  const comboCOP  = fmtCOP(s.combo_total);
  const eventsPackCOP = fmtCOP(s.events_pack_total || s.combo_total);
  const cuotaCOP  = fmtCOP(s.combo_total / (s.installments || 1));
  // Plan Total "desde" = covers (combo) + lancha MÁS BARATA con el descuento del
  // plan (−$15.000). Es el precio mínimo real que pagaría alguien con Plan Total.
  const planTotalMin    = s.combo_total + (cheapestBoat > 0 ? Math.max(0, cheapestBoat - 15000) : 0);
  const planTotalMinCOP = fmtCOP(planTotalMin);
  // Día más barato (para "arma tu semana · desde")
  const minDayCOP = fmtCOP(Math.min(...displayDays.map(d => d.price)));
  const combo1COP = fmtCOP(s.combo1_total);
  const cuota1COP = fmtCOP(s.combo1_total / (s.combo1_installments || 1));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="w-1 h-12 animate-pulse" style={{ background: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="min-h-screen overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Atardecer animado de fondo (canvas + gradients) */}
        <SolsticeAtmosphere className="absolute inset-0" />

        {/* Overlay del hero — el sunset vive en los bordes, el centro queda
            oscuro para que el texto rojo/cream se lea sin pelearse con el fondo. */}
        <div
          aria-hidden
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 60% 45% at 50% 50%, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 50%, transparent 90%),
              radial-gradient(ellipse 120% 50% at 50% 105%, rgba(230,57,47,0.30) 0%, transparent 65%),
              radial-gradient(ellipse 100% 60% at 50% -10%, rgba(20,5,35,0.55) 0%, transparent 70%),
              linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.55) 100%)
            `,
          }}
        />
        {/* Viñeta laterales — oscurece esquinas izquierda/derecha */}
        <div
          aria-hidden
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 50% 100% at 0% 50%, rgba(0,0,0,0.55) 0%, transparent 60%),
              radial-gradient(ellipse 50% 100% at 100% 50%, rgba(0,0,0,0.55) 0%, transparent 60%)
            `,
          }}
        />

        {/* Decoración: Edition I — chip top */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-[15%] left-1/2 z-10 pointer-events-none -translate-x-1/2 flex items-center gap-3"
        >
          <span style={{ width: 24, height: 1, background: 'rgba(230,57,47,0.45)' }} />
          <span className="text-[9px] uppercase" style={{ letterSpacing: '0.6em', color: C.red, fontWeight: 600 }}>
            Edition I
          </span>
          <span style={{ width: 24, height: 1, background: 'rgba(230,57,47,0.45)' }} />
        </motion.div>

        {/* Decoración: partículas estelares sutiles */}
        <div aria-hidden className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.6, 0],
                y: [0, -40, -80],
                x: [0, Math.random() * 30 - 15, Math.random() * 60 - 30],
              }}
              transition={{
                duration: 8 + Math.random() * 6,
                delay: Math.random() * 5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                bottom: '-10px',
                width: `${1.5 + Math.random() * 2}px`,
                height: `${1.5 + Math.random() * 2}px`,
                borderRadius: '999px',
                background: i % 3 === 0 ? '#E6392F' : i % 3 === 1 ? '#FFB48C' : '#F9F2D7',
                boxShadow: i % 3 === 0 ? '0 0 6px rgba(230,57,47,0.7)' : '0 0 4px rgba(255,180,140,0.5)',
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="relative z-20 text-center px-6 mt-16 md:mt-0 w-full max-w-5xl"
        >
          {logoUrl ? (
            <div className="relative inline-block mb-6">
              {/* Draggable logo wrapper */}
              <div
                style={{
                  transform: editMode
                    ? `translate(${dragPos.x}px, ${dragPos.y}px)`
                    : `translate(${pos.x}px, ${pos.y}px)`,
                  cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  transition: isDragging ? 'none' : 'transform 0.25s ease',
                  touchAction: editMode ? 'none' : 'auto',
                  userSelect: 'none',
                }}
                onPointerDown={editMode ? handlePointerDown : undefined}
                onPointerMove={editMode ? handlePointerMove : undefined}
                onPointerUp={editMode ? handlePointerUp : undefined}
              >
                <img
                  src={logoUrl}
                  alt="SOLSTICE"
                  draggable={false}
                  style={{ height: `${logoSize}px`, maxWidth: '80vw', objectFit: 'contain', opacity: 0.95, display: 'block' }}
                />
                {/* Edit mode outline */}
                {editMode && (
                  <div style={{
                    position: 'absolute', inset: -8, border: '1px dashed rgba(230,57,47,0.6)',
                    borderRadius: 8, pointerEvents: 'none',
                  }}>
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                      background: 'rgba(230,57,47,0.15)', borderRadius: 6, padding: '4px 8px',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Move size={11} style={{ color: '#E6392F' }} />
                      <span style={{ fontSize: 9, color: '#E6392F', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>arrastra</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Admin edit toggle button — only visible when not in edit mode */}
              {isAdmin && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    position: 'absolute', top: -10, right: -10,
                    background: 'rgba(10,0,0,0.85)', border: '0.5px solid rgba(230,57,47,0.5)',
                    borderRadius: '50%', width: 28, height: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(12px)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Editar posición"
                >
                  <Move size={13} style={{ color: '#E6392F' }} />
                </button>
              )}
            </div>
          ) : (
            <h1 className="uppercase flex items-center justify-center gap-3 leading-none mb-6"
              style={{
                fontFamily: "'Poiret One', sans-serif",
                fontSize: 'clamp(4rem, 14vw, 10rem)',
                letterSpacing: '-0.02em',
                fontWeight: 300,
                color: C.cream,
                textShadow: '0 4px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
              }}>
              S
              <span className="inline-block rounded-full"
                style={{
                  width: 'clamp(2.2rem,5vw,5rem)',
                  height: 'clamp(2.2rem,5vw,5rem)',
                  border: '0.5px solid rgba(230,57,47,0.55)',
                  borderRadius: '999px',
                  boxShadow: 'inset 0 0 20px rgba(230,57,47,0.20)',
                }} />
              LSTICE
            </h1>
          )}
          {/* Filete decorativo bajo el wordmark — cream/sutil para legibilidad */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mb-5"
            style={{
              height: 1,
              width: 'clamp(120px, 30vw, 320px)',
              background: 'linear-gradient(90deg, transparent 0%, rgba(249,242,215,0.55) 50%, transparent 100%)',
              transformOrigin: 'center',
            }}
          />

          {/* Tagline: cream para máximo contraste sobre el sunset */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 px-2 uppercase"
            style={{
              fontSize: 'clamp(0.85rem, 1.7vw, 1.35rem)',
              letterSpacing: '0.45em',
              color: C.cream,
              fontWeight: 400,
              fontFamily: "'Poiret One', sans-serif",
              textShadow: '0 2px 16px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.55)',
            }}
          >
            Selected beats <span style={{ color: C.red, margin: '0 0.5em' }}>·</span> Private sunset
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="flex items-center justify-center gap-3 mb-10 md:mb-12"
          >
            <span style={{ width: 18, height: 0.5, background: 'rgba(249,242,215,0.30)' }} />
            <p
              className="text-[10px] md:text-xs uppercase"
              style={{
                letterSpacing: '0.35em',
                color: 'rgba(249,242,215,0.65)',
                fontWeight: 500,
                textShadow: '0 1px 6px rgba(0,0,0,0.65)',
              }}
            >
              Santa Marta · Sep–Oct 2026
            </p>
            <span style={{ width: 18, height: 0.5, background: 'rgba(249,242,215,0.30)' }} />
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.97 }}
            onClick={() => document.getElementById('solstice-opciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-12 py-4 text-sm font-medium uppercase flex items-center gap-3 mx-auto"
            style={{
              background: ctaHovered
                ? 'linear-gradient(135deg, rgba(230,57,47,0.55) 0%, rgba(255,122,0,0.40) 100%)'
                : 'linear-gradient(135deg, rgba(230,57,47,0.32) 0%, rgba(255,122,0,0.18) 100%)',
              color: C.cream,
              letterSpacing: '0.25em',
              borderRadius: '999px',
              border: '0.5px solid rgba(230,57,47,0.55)',
              transform: ctaHovered ? 'translateY(-2px)' : 'none',
              boxShadow: ctaHovered
                ? '0 18px 48px rgba(230,57,47,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 10px 30px rgba(230,57,47,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'pointer',
            }}
            onMouseEnter={() => setCtaHovered(true)}
            onMouseLeave={() => setCtaHovered(false)}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: '#fff',
                boxShadow: '0 0 8px rgba(255,255,255,0.85)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            Reservá tu semana
          </motion.button>

          {/* Mensaje claro del adelanto: reservás con $40K y el resto en cuotas */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 1.25 }}
            className="text-center mt-6 md:mt-8 text-[13px] md:text-sm px-6"
            style={{ color: `${C.cream}dd`, letterSpacing: '0.02em', fontWeight: 400, lineHeight: 1.5 }}
          >
            Reservás tu semana con solo <strong style={{ color: C.red }}>${entryK}.000</strong>.
            <br className="hidden md:block" /> El resto lo pagás en cuotas, sin afán.
          </motion.p>
        </motion.div>

        {/* Scroll hint sutil */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="absolute bottom-8 md:bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-2"
        >
          <span className="text-[8px] md:text-[9px] uppercase" style={{ letterSpacing: '0.5em', color: `${C.gray}aa`, fontWeight: 500 }}>
            Scroll
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: 1, height: 26, background: `linear-gradient(180deg, rgba(230,57,47,0.6) 0%, transparent 100%)` }}
          />
        </motion.div>

        {/* ── Edit mode floating bar ── */}
        {editMode && (
          <div className="fixed bottom-8 left-1/2 z-[220]" style={{ transform: 'translateX(-50%)' }}>
            <div className="flex items-center gap-3 px-5 py-3" style={{
              background: 'rgba(6,0,0,0.92)',
              backdropFilter: 'blur(24px) saturate(160%)',
              border: '0.5px solid rgba(230,57,47,0.45)',
              borderRadius: '999px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}>
              <Move size={13} style={{ color: 'rgba(230,57,47,0.7)', flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: 'rgba(249,242,215,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500, whiteSpace: 'nowrap' }}>
                Modo edición
              </span>
              <button
                onClick={() => { setPos(dragPos); setEditMode(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-widest"
                style={{ background: 'rgba(230,57,47,0.22)', border: '0.5px solid rgba(230,57,47,0.5)', borderRadius: '999px', color: '#F9F2D7', fontWeight: 600 }}
              >
                <Check size={11} /> Guardar
              </button>
              <button
                onClick={() => { setDragPos(pos); setEditMode(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: '999px', color: 'rgba(249,242,215,0.6)', fontWeight: 500 }}
              >
                <XIcon size={11} /> Cancelar
              </button>
              <button
                onClick={() => { setDragPos({ x: 0, y: 0 }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-widest"
                style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '999px', color: 'rgba(249,242,215,0.4)', fontWeight: 500 }}
                title="Restablecer posición"
              >
                <RotateCcw size={11} />
              </button>
            </div>
          </div>
        )}

        {/* Hero badge */}
        <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center gap-3 flex-wrap px-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '999px',
            }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.red }} />
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.08em', fontWeight: 500 }}>
              {s.phase1_limit
                ? `Fase 1 activa — primeras ${s.phase1_limit} reservas desde `
                : 'Reserva desde '}
              <strong style={{ color: C.red }}>{entryCOP}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <section className="py-12 md:py-16">
        <SolsticeMarquee
          items={['SOLSTICE 2026', 'SANTA MARTA', 'ATARDECER PRIVADO', 'LANCHAS · BEACH CLUB', 'UNA VEZ AL AÑO', 'SELECTED BEATS']}
          speedSeconds={60}
        />
      </section>

      {/* ── ELEGÍ TU PLAN — 3 opciones (Pack Fiestas / Plan Total / Arma). Los CTA
            genéricos "Reservá" bajan acá, en vez de a un paso aparte que confundía. ── */}
      <section id="solstice-opciones" className="py-16 md:py-24 px-4" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 md:mb-10">
            {/* Recordatorio del adelanto — card como el mockup */}
            <div className="max-w-md mx-auto flex items-center justify-center gap-3 px-5 py-3.5 mb-8"
              style={{ borderRadius: '14px', border: '0.5px solid rgba(230,57,47,0.4)', background: 'rgba(230,57,47,0.05)' }}>
              <CreditCard size={18} style={{ color: C.red, flexShrink: 0 }} />
              <p className="text-[12px] md:text-sm uppercase text-center" style={{ color: `${C.cream}dd`, letterSpacing: '0.06em', lineHeight: 1.4 }}>
                Reservá hoy con solo <strong style={{ color: C.red }}>{entryCOP}</strong><br />y pagá el resto en cuotas.
              </p>
            </div>
            {/* Divider con texto — "Elegí tu forma de viajar" */}
            <div className="flex items-center gap-3 max-w-md mx-auto">
              <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <p className="text-[10px] md:text-[11px] uppercase" style={{ letterSpacing: '0.3em', color: `${C.cream}cc`, fontWeight: 600 }}>Elegí tu forma de viajar</p>
              <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            </div>
          </div>

          {/* OFERTA LIMITADA · PACK FIESTAS — entrada a todos los eventos (sin lancha).
              Teaser barato que recomienda el Plan Total (el Beach Club requiere lancha). */}
          <motion.button
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onNavigate('reserva@events_pack')}
            className="w-full text-left mb-5 p-5 md:p-6 relative overflow-hidden block"
            style={{ borderRadius: '20px', background: 'rgba(230,57,47,0.10)', border: '0.5px solid rgba(230,57,47,0.5)', boxShadow: '0 16px 44px rgba(230,57,47,0.16)', backdropFilter: 'blur(32px) saturate(180%)' }}
          >
            <div className="px-2.5 py-1 text-[8px] uppercase inline-flex items-center gap-1.5 mb-3"
              style={{ background: C.red, color: C.cream, borderRadius: '999px', fontWeight: 800, letterSpacing: '0.15em' }}>
              <Star size={9} fill={C.cream} /> Oferta limitada
            </div>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-xl md:text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, color: C.cream, letterSpacing: '0.03em', lineHeight: 1.1 }}>Pack Fiestas · 5 eventos</h3>
                <p className="text-[11px] mt-1.5" style={{ color: `${C.cream}bb`, lineHeight: 1.4 }}>
                  Acceso a <strong style={{ color: C.cream }}>todos los eventos</strong> de Solstice.
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-2xl md:text-3xl tabular-nums" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>{eventsPackCOP}</p>
                <p className="text-[9px] uppercase" style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 600 }}>Reservá con {entryCOP}</p>
              </div>
            </div>
            <div className="mt-4 w-full py-2.5 text-center text-[11px] uppercase flex items-center justify-center gap-1.5"
              style={{ background: C.red, color: C.cream, borderRadius: '999px', letterSpacing: '0.12em', fontWeight: 800, boxShadow: '0 8px 22px rgba(230,57,47,0.35)' }}>
              Aprovechar oferta <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Dos columnas SIEMPRE (también en móvil) — las dos opciones se ven de
              un vistazo, como el mockup. Más conversión: comparás al instante. */}
          <div className="grid grid-cols-2 gap-3 md:gap-5 items-stretch">
            {/* ═══ OPCIÓN 2 — PLAN TOTAL (ícono circular, centrado, como el mockup) ═══ */}
            <motion.button
              whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}
              onClick={() => onNavigate('reserva@full_combo')}
              className="relative overflow-hidden p-4 md:p-6 flex flex-col"
              style={{ borderRadius: '20px', background: 'rgba(230,57,47,0.07)', border: '0.5px solid rgba(230,57,47,0.45)', boxShadow: '0 16px 44px rgba(230,57,47,0.13)', backdropFilter: 'blur(32px) saturate(180%)', cursor: 'pointer' }}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <p className="text-[9px] md:text-[10px] uppercase" style={{ letterSpacing: '0.2em', color: C.gray, fontWeight: 700 }}>Opción 2</p>
                <div className="px-2 py-0.5 text-[7px] md:text-[8px] uppercase flex items-center gap-1 flex-shrink-0"
                  style={{ background: C.cream, color: '#0a0a0a', letterSpacing: '0.1em', borderRadius: '999px', fontWeight: 800 }}><Star size={8} fill="#0a0a0a" /> Best value</div>
              </div>
              {/* ícono circular: lancha */}
              <div className="flex justify-center mt-2 mb-3">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(230,57,47,0.12)', border: '0.5px solid rgba(230,57,47,0.4)', color: C.red }}>
                  <Ship size={26} strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-[17px] md:text-2xl uppercase text-center" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.03em', fontWeight: 300, color: C.cream, lineHeight: 1.1 }}>Plan Total</h3>
              <p className="text-[9px] md:text-[11px] uppercase text-center mt-1 mb-3" style={{ color: C.red, letterSpacing: '0.1em', fontWeight: 700 }}>Eventos + lancha</p>
              <p className="text-[9px] uppercase text-center" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 600 }}>Desde</p>
              <p className="text-2xl md:text-4xl tabular-nums text-center" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>{planTotalMinCOP}</p>
              <p className="text-[8px] md:text-[9px] uppercase text-center mb-3" style={{ color: C.gray, letterSpacing: '0.12em' }}>por persona</p>
              <div className="pt-3 mb-4 flex-1" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                <div className="flex items-start gap-1.5 text-[10px] md:text-[11px]" style={{ color: `${C.cream}dd`, lineHeight: 1.35 }}>
                  <Check size={12} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} /> Incluye TODOS los eventos de la semana + tu parte de la lancha.
                </div>
              </div>
              <div className="w-full py-2.5 md:py-3.5 text-center text-[10px] md:text-sm uppercase flex items-center justify-center gap-1.5"
                style={{ background: C.cream, color: '#0a0a0a', borderRadius: '999px', letterSpacing: '0.08em', fontWeight: 800, boxShadow: '0 8px 22px rgba(0,0,0,0.3)' }}>Quiero los 5 días 🌞 <ChevronRight size={14} /></div>
            </motion.button>

            {/* ═══ OPCIÓN 3 — ARMA TU SEMANA ═══ */}
            <motion.button
              whileHover={{ y: -4 }} whileTap={{ scale: 0.99 }}
              onClick={() => onNavigate('reserva@individual_days')}
              className="relative overflow-hidden p-4 md:p-6 flex flex-col"
              style={{ borderRadius: '20px', background: 'rgba(255,255,255,0.035)', border: '0.5px solid rgba(255,255,255,0.12)', boxShadow: '0 14px 36px rgba(0,0,0,0.28)', backdropFilter: 'blur(32px) saturate(180%)', cursor: 'pointer' }}
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <p className="text-[9px] md:text-[10px] uppercase" style={{ letterSpacing: '0.2em', color: C.gray, fontWeight: 700 }}>Opción 3</p>
                <div className="px-2 py-0.5 text-[7px] md:text-[8px] uppercase flex items-center gap-1 flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.10)', color: C.cream, border: '0.5px solid rgba(255,255,255,0.20)', letterSpacing: '0.1em', borderRadius: '999px', fontWeight: 800 }}><CalendarDays size={8} /> Flexibility</div>
              </div>
              {/* ícono circular: calendario */}
              <div className="flex justify-center mt-2 mb-3">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', color: C.cream }}>
                  <CalendarDays size={26} strokeWidth={1.5} />
                </div>
              </div>
              <h3 className="text-[17px] md:text-2xl uppercase text-center" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.03em', fontWeight: 300, color: C.cream, lineHeight: 1.1 }}>Arma tu semana</h3>
              <p className="text-[9px] md:text-[11px] uppercase text-center mt-1 mb-3" style={{ color: C.red, letterSpacing: '0.1em', fontWeight: 700 }}>Eventos y lancha día por día</p>
              <p className="text-[9px] uppercase text-center" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 600 }}>Desde</p>
              <div className="flex items-baseline justify-center gap-1">
                <p className="text-2xl md:text-4xl tabular-nums text-center" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>{minDayCOP}</p>
                <span className="text-[9px] md:text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.1em', fontWeight: 500 }}>/ día</span>
              </div>
              <p className="text-[8px] md:text-[9px] uppercase text-center mb-3" style={{ color: C.gray, letterSpacing: '0.12em' }}>por persona</p>
              <div className="pt-3 mb-4 flex-1" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                <div className="flex items-start gap-1.5 text-[10px] md:text-[11px]" style={{ color: `${C.cream}dd`, lineHeight: 1.35 }}>
                  <Check size={12} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} /> Elegí los eventos y lanchas día por día.
                </div>
              </div>
              <div className="w-full py-2.5 md:py-3.5 text-center text-[10px] md:text-sm uppercase flex items-center justify-center gap-1.5"
                style={{ background: C.cream, color: '#0a0a0a', borderRadius: '999px', letterSpacing: '0.08em', fontWeight: 800, boxShadow: '0 8px 22px rgba(0,0,0,0.3)' }}>Armar mi semana ⛱️ <ChevronRight size={14} /></div>
            </motion.button>
          </div>

          {/* ¿Cómo pagar? — card (como el mockup) */}
          <button
            onClick={() => document.getElementById('solstice-como-pagar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full mt-5 p-4 flex items-center justify-between gap-3"
            style={{ borderRadius: '16px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.10)', cursor: 'pointer' }}
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(230,57,47,0.12)', color: C.red }}>
                <CreditCard size={16} />
              </div>
              <div>
                <p className="text-[12px] uppercase" style={{ color: C.cream, letterSpacing: '0.08em', fontWeight: 700 }}>¿Cómo pagar?</p>
                <p className="text-[10px]" style={{ color: C.gray, lineHeight: 1.3 }}>Cuotas con tarjeta de crédito o transferencia.</p>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: C.gray, flexShrink: 0 }} />
          </button>
        </div>
      </section>

      {/* ── PROGRAMA (subido: lo primero que ve el cliente tras el hero) ── */}
      <section className="py-24 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl text-center mb-3 uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
            Programa — {displayDays.length} Días
          </h2>
          <p className="text-center text-xs uppercase mb-20" style={{ letterSpacing: '0.08em', color: C.gray, fontWeight: 500 }}>
            Todo incluido · Atardecer cada noche
          </p>
          <div className="relative">
            <div className="hidden md:block absolute top-[2.4rem] left-0 right-0 h-px" style={{ background: `${C.gray}20` }} />
            <div className="flex flex-col md:flex-row justify-between gap-12 relative z-10">
              {displayDays.map(day => (
                <div key={day.day_number} className="flex-1 flex flex-col items-center text-center">
                  <div className="w-10 h-10 flex items-center justify-center mb-6"
                    style={day.highlight
                      ? { background: C.red, borderRadius: '999px', color: C.cream, border: '0.5px solid rgba(230,57,47,0.45)' }
                      : { borderRadius: '999px', color: C.gray, border: '0.5px solid rgba(255,255,255,0.10)' }}>
                    {day.highlight ? <Ship size={18} /> : <span className="text-sm">{day.day_number}</span>}
                  </div>
                  <h4 className="text-base mb-1 uppercase"
                    style={{
                      color: day.highlight ? C.red : C.cream,
                      fontFamily: "'Poiret One', sans-serif",
                      letterSpacing: '0.1em',
                      fontWeight: 300,
                    }}>
                    {day.title}
                  </h4>
                  <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>{day.subtitle}</p>
                  <p className="text-[9px] uppercase" style={{ color: `${C.gray}80`, letterSpacing: '0.08em', fontWeight: 500 }}>
                    {fmtCOP(day.price)} individual
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 flex items-center justify-center gap-8 flex-wrap">
            <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              Sueltos: {fmtCOP(displayDays.reduce((a, d) => a + d.price, 0))}
            </span>
            <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 500 }}>
              Combo completo: {comboCOP}
            </span>
            <span className="text-[10px] uppercase" style={{ color: `${C.gray}80`, letterSpacing: '0.08em', fontWeight: 500 }}>
              Combo 1 (sin Día 3): {combo1COP}
            </span>
            <button
              onClick={() => onNavigate('programa')}
              className="flex items-center gap-1.5 text-[10px] uppercase font-medium tracking-widest transition-all hover:opacity-100 opacity-60"
              style={{ color: C.cream, letterSpacing: '0.08em' }}>
              Ver programa completo <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </section>

      {/* ── SEMANAS ── */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <p className="text-center text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
          Elegí tu fecha
        </p>
        <h2 className="text-3xl md:text-4xl text-center mb-3 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
          Semanas Disponibles
        </h2>
        <p className="text-center text-xs uppercase mb-16" style={{ letterSpacing: '0.08em', color: C.gray, fontWeight: 500 }}>
          {displayWeeks.length} universidades · Santa Marta 2026
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayWeeks.map((week, idx) => (
            <WeekCard
              key={week.id}
              week={week}
              reserved={reservedByUni[week.university] || 0}
              idx={idx}
              onSelect={() => onNavigate(`reserva:${week.university}`)}
            />
          ))}
        </div>
      </section>

      {/* ── ¿QUÉ ES LA VACA? — Explicación del sistema de cuotas ── */}
      <section id="solstice-como-pagar" className="py-24 px-4" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
              Sistema de pago
            </p>
            <h2 className="text-3xl md:text-5xl uppercase mb-4"
              style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
              ¿Qué es <span style={{ color: C.red }}>La Vaca</span>?
            </h2>
            <p className="text-sm md:text-base max-w-2xl mx-auto" style={{ color: '#a0a0a8', lineHeight: 1.6 }}>
              Pensado para estudiantes universitarios: <strong style={{ color: C.cream }}>reservás ahora con {entryCOP}</strong> y
              pagás el resto en {s.installments} cuotas mensuales. <strong style={{ color: C.cream }}>Sin recargo. Sin interés.</strong> Como hacer una vaca con tus amigos, pero conmigo.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            {[
              {
                n: '01',
                title: 'Reservás hoy',
                desc: `Con ${entryCOP} asegurás tu lugar. Wompi cobra al instante con tu tarjeta o transferencia.`,
              },
              {
                n: '02',
                title: 'Elegís cómo seguir',
                desc: '5 modalidades: débito automático, mes a mes, efectivo al promotor, días sueltos, o todo de una.',
              },
              {
                n: '03',
                title: 'Te avisamos 24h antes',
                desc: 'WhatsApp + email antes de cada cobro. Cero olvidos. Cero sorpresas.',
              },
              {
                n: '04',
                title: 'Llegás a Santa Marta',
                desc: 'Con tu combo pagado, tu lancha asegurada y QR de acceso en tu billetera digital.',
              },
            ].map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="p-6"
                style={{
                  background: 'rgba(255,255,255,0.035)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '20px',
                  backdropFilter: 'blur(20px)',
                }}
              >
                <p className="text-3xl mb-3 leading-none tabular-nums"
                  style={{
                    fontFamily: "'Poiret One', sans-serif",
                    color: C.red,
                    fontWeight: 300,
                    letterSpacing: '-0.02em',
                  }}>
                  {step.n}
                </p>
                <p className="text-sm uppercase mb-2" style={{ color: C.cream, letterSpacing: '0.08em', fontWeight: 600 }}>
                  {step.title}
                </p>
                <p className="text-[11px]" style={{ color: '#a0a0a8', lineHeight: 1.6 }}>
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <VacaStat icon="✦" value={`${s.installments}`} label="Cuotas mensuales" />
            <VacaStat icon="✓" value="0%" label="Recargo · Sin interés" highlight />
            <VacaStat icon="🔒" value="100%" label="Reembolsable hasta 14 días antes" />
          </div>

          {/* Tagline */}
          <p className="text-center text-[10px] uppercase mt-12" style={{ letterSpacing: '0.35em', color: `${C.gray}cc`, fontWeight: 500 }}>
            Cuotas con tarjeta guardada · Wompi cobra automático · Avisos por WhatsApp
          </p>
        </div>
      </section>

      {/* ── CÓMO SE VIVE — galería inmersiva ── */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 mb-12 text-center">
          <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            La experiencia
          </p>
          <h2 className="text-3xl md:text-4xl uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300, color: C.cream }}>
            Cómo se vive
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-4">
          {GALLERY_IMAGES.map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: i * 0.06, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{
                aspectRatio: i % 3 === 0 ? '3/4' : '1/1',
                background: '#0a0a0a',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                border: '0.5px solid rgba(230,57,47,0.15)',
              }}
            >
              <img
                src={src}
                alt={`Solstice ${i + 1}`}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'saturate(0.85) brightness(0.85)',
                  transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1), filter 0.5s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.05)';
                  (e.currentTarget as HTMLImageElement).style.filter = 'saturate(1) brightness(1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLImageElement).style.filter = 'saturate(0.85) brightness(0.85)';
                }}
              />
              <div
                style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.6) 100%)',
                  pointerEvents: 'none',
                }}
              />
            </motion.div>
          ))}
        </div>
        <p className="text-center text-[9px] uppercase mt-8" style={{ letterSpacing: '0.4em', color: C.gray, fontWeight: 500 }}>
          Ediciones pasadas — Santa Marta 2024–2025
        </p>
      </section>

      {/* ── LA VACA ── */}
      <section className="py-24 px-4 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl mb-4 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
          La Vaca — Cómo funciona
        </h2>
        <p className="text-sm mb-2" style={{ color: C.gray }}>
          Reserva con <strong style={{ color: C.cream }}>{entryCOP}</strong> hoy.
          El resto en cuotas mensuales sin interés.
        </p>
        <p className="text-xs uppercase mb-14" style={{ color: `${C.gray}80`, letterSpacing: '0.08em', fontWeight: 500 }}>
          Sin interés · Sin multa si cancelas antes del primer mes
        </p>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14 text-left">
          {/* Combo 1 */}
          <div className="p-8 relative"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '24px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
            }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] uppercase font-medium whitespace-nowrap"
              style={{
                background: C.gray,
                letterSpacing: '0.08em',
                color: C.bg,
                borderRadius: '999px',
                fontWeight: 500,
              }}>
              Combo 1
            </div>
            <div className="text-5xl font-semibold mb-1" style={{ color: C.cream }}>{combo1COP}</div>
            <p className="text-xs uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              {s.combo1_installments} cuotas de {cuota1COP}/mes
            </p>
            <div className="space-y-1.5 text-xs" style={{ color: C.gray }}>
              <div className="flex justify-between">
                <span>Reserva inicial</span>
                <span style={{ color: C.cream }}>{entryCOP}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                <span>Total</span>
                <span style={{ color: C.cream }}>{combo1COP}</span>
              </div>
            </div>
          </div>

          {/* Combo completo */}
          <div className="p-8 relative"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(230,57,47,0.35)',
              borderRadius: '24px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
            }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] uppercase font-medium whitespace-nowrap"
              style={{
                background: C.red,
                letterSpacing: '0.08em',
                borderRadius: '999px',
                fontWeight: 500,
              }}>
              Combo Completo
            </div>
            <div className="text-5xl font-semibold mb-1" style={{ color: C.red }}>{comboCOP}</div>
            <p className="text-xs uppercase mb-4" style={{ color: `${C.red}80`, letterSpacing: '0.08em', fontWeight: 500 }}>
              {s.installments} cuotas de {cuotaCOP}/mes
            </p>
            <div className="space-y-1.5 text-xs" style={{ color: `${C.gray}` }}>
              <div className="flex justify-between">
                <span>Reserva inicial</span>
                <span style={{ color: C.cream }}>{entryCOP}</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                <span>Total</span>
                <span style={{ color: C.red }}>{comboCOP}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-5 text-left max-w-md mx-auto">
          {[
            'Tocas el botón de reserva',
            `Pagas ${entryCOP} por Wompi`,
            'Recibes tu QR de confirmación',
            'Cuotas mensuales vía link WhatsApp',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 flex items-center justify-center text-xs flex-shrink-0"
                style={{
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  color: C.gray,
                  borderRadius: '999px',
                }}>
                {i + 1}
              </div>
              <p className="text-sm uppercase" style={{ letterSpacing: '0.08em', fontWeight: 500 }}>{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="relative py-40 text-center px-4 overflow-hidden">
        {/* Atardecer del CTA */}
        <div className="absolute inset-0 pointer-events-none">
          <SolsticeAtmosphere className="absolute inset-0 opacity-50" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.85) 80%)' }} />
        </div>
        <div className="relative z-10">
          <p className="text-[10px] uppercase mb-4" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            La hora de tomar la decisión
          </p>
          <h2 className="text-5xl md:text-7xl mb-8 uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
            Tu semana empieza aquí.
          </h2>
          <p className="text-lg mb-12 max-w-xl mx-auto" style={{ color: `${C.cream}cc`, fontWeight: 300 }}>
            ¿Listo para el atardecer perfecto? Asegura tu cupo con <strong style={{ color: C.red }}>${entryK}.000</strong> hoy.
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => document.getElementById('solstice-opciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center gap-4 mx-auto px-16 py-5 text-base font-medium uppercase"
            style={{
              background: finalCtaHovered ? 'rgba(230,57,47,0.45)' : 'rgba(230,57,47,0.25)',
              color: '#fff',
              letterSpacing: '0.08em',
              borderRadius: '999px',
              border: '0.5px solid rgba(230,57,47,0.55)',
              transform: finalCtaHovered ? 'translateY(-2px) scale(1.02)' : 'none',
              boxShadow: finalCtaHovered ? '0 12px 40px rgba(230,57,47,0.4)' : '0 4px 12px rgba(230,57,47,0.15)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={() => setFinalCtaHovered(true)}
            onMouseLeave={() => setFinalCtaHovered(false)}
          >
            RESERVAR AHORA <ChevronRight size={18} />
          </motion.button>
          <p className="text-[9px] uppercase mt-8" style={{ letterSpacing: '0.4em', color: `${C.cream}80`, fontWeight: 500 }}>
            Pago seguro · Cuotas sin interés · Sin multa de cancelación
          </p>
        </div>
      </section>

      {/* ── Sticky CTA — aparece después del hero, baja la fricción de scroll ── */}
      <AnimatePresence>
        {showStickyCta && (
          <motion.div
            key="solstice-sticky-cta"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 inset-x-0 z-[180] px-4 pt-4 pb-5 md:pb-6 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.82) 60%, transparent 100%)',
            }}
          >
            <div className="max-w-md md:max-w-lg mx-auto pointer-events-auto">
              <button
                onClick={() => document.getElementById('solstice-opciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full flex items-center justify-between gap-4 px-5 py-3 md:py-4"
                style={{
                  background: 'linear-gradient(135deg, rgba(230,57,47,0.95) 0%, rgba(255,122,0,0.92) 100%)',
                  color: '#fff',
                  letterSpacing: '0.15em',
                  borderRadius: '999px',
                  fontWeight: 600,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: '0.5px solid rgba(255,180,140,0.40)',
                  boxShadow: '0 16px 40px rgba(230,57,47,0.45), 0 0 0 0 rgba(230,57,47,0.4)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  animation: 'pulse 2.5s ease-in-out infinite',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 20px 50px rgba(230,57,47,0.55)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 16px 40px rgba(230,57,47,0.45)';
                }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }}
                  />
                  <span className="text-left truncate" style={{ fontFamily: "'Archivo', sans-serif" }}>
                    Reservá tu Solstice · {entryCOP}
                  </span>
                </div>
                <ChevronRight size={18} className="flex-shrink-0" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Hero helpers ────────────────────────────────────────────────────────
function HeroStat({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <p
        className="tabular-nums leading-none"
        style={{
          fontFamily: "'Poiret One', sans-serif",
          fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          color: highlight ? '#E6392F' : '#F9F2D7',
        }}
      >
        {value}
      </p>
      <p className="text-[8px] md:text-[9px] uppercase mt-1.5" style={{ letterSpacing: '0.4em', color: '#606060', fontWeight: 600 }}>
        {label}
      </p>
    </div>
  );
}

function HeroDivider() {
  return <span aria-hidden style={{ width: 0.5, height: 28, background: 'rgba(255,255,255,0.10)' }} />;
}

function VacaStat({ icon, value, label, highlight }: { icon: string; value: string; label: string; highlight?: boolean }) {
  return (
    <div
      className="p-5 flex items-center gap-4"
      style={{
        background: highlight ? 'rgba(230,57,47,0.10)' : 'rgba(255,255,255,0.03)',
        border: highlight ? '0.5px solid rgba(230,57,47,0.40)' : '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        backdropFilter: 'blur(24px)',
      }}
    >
      <span
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          background: highlight ? '#E6392F' : 'rgba(255,255,255,0.05)',
          color: highlight ? '#fff' : '#E6392F',
          fontSize: 16,
        }}
      >
        {icon}
      </span>
      <div>
        <p className="text-2xl leading-none tabular-nums"
          style={{
            fontFamily: "'Poiret One', sans-serif",
            color: highlight ? '#E6392F' : '#F9F2D7',
            fontWeight: 300,
            letterSpacing: '-0.02em',
          }}>
          {value}
        </p>
        <p className="text-[10px] uppercase mt-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 500 }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponentes y data estática
// ─────────────────────────────────────────────────────────────────────────────

const GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1551244072-5d12893278ab?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&q=80&w=800',
  'https://images.unsplash.com/photo-1533777324565-a040eb52facd?auto=format&fit=crop&q=80&w=800',
];

