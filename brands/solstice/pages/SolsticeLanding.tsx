import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Ship } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const C = {
  bg:    '#000000',
  bgS:   '#0d0d0d',
  gray:  '#606060',
  red:   '#E6392F',
  cream: '#F9F2D7',
};

interface Props {
  onNavigate: (page: string) => void;
}

interface Season {
  id: string; name: string; tagline: string;
  entry_price: number; combo_total: number; combo1_total: number;
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
function WeekCard({ week, onSelect, idx }: { week: Week; onSelect: () => void; idx: number }) {
  const { days, hours, mins, secs, pct } = useCountdown(week.start_date);
  const urgent = days < 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
      className="relative p-8 flex flex-col"
      style={{ background: C.bgS, border: `1px solid ${urgent ? C.red + '55' : C.gray + '25'}` }}
    >
      {urgent && (
        <div className="absolute -top-3 left-6 px-3 py-1 text-[9px] uppercase font-black"
          style={{ background: C.red, letterSpacing: '0.15em' }}>
          ¡Últimos días!
        </div>
      )}

      <h3 className="text-2xl mb-1 uppercase"
        style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
        {week.university}
      </h3>
      <p className="text-xs mb-6 uppercase" style={{ letterSpacing: '0.2em', color: C.gray }}>
        {new Date(week.start_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
        {' — '}
        {new Date(week.end_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
      </p>

      {/* Countdown */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[['días', days], ['hrs', hours], ['min', mins], ['seg', secs]].map(([label, val]) => (
          <div key={String(label)} className="flex flex-col items-center py-2"
            style={{ background: `${C.gray}08`, border: `1px solid ${C.gray}15` }}>
            <span className="text-xl font-black leading-none" style={{ color: urgent ? C.red : C.cream }}>
              {String(val).padStart(2, '0')}
            </span>
            <span className="text-[8px] uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.15em' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Urgency bar */}
      <div className="w-full h-[2px] mb-1" style={{ background: `${C.gray}20` }}>
        <motion.div className="h-full"
          initial={{ width: 0 }} whileInView={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{ background: urgent ? C.red : `${C.red}80` }} />
      </div>
      <p className="text-[9px] uppercase mb-8" style={{ color: urgent ? `${C.red}90` : C.gray, letterSpacing: '0.15em' }}>
        {days > 0 ? `Faltan ${days} días` : 'Comenzando'}
      </p>

      <button
        onClick={onSelect}
        className="w-full py-3 text-xs uppercase transition-all mt-auto"
        style={{ border: `1px solid ${C.gray}30`, color: C.gray, letterSpacing: '0.2em' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.red; (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.gray}30`; (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}
      >
        Seleccionar semana
      </button>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SolsticeLanding({ onNavigate }: Props) {
  const [season, setSeason] = useState<Season | null>(null);
  const [weeks,  setWeeks]  = useState<Week[]>([]);
  const [days,   setDays]   = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'SOLSTICE 2026';
    return () => { document.title = 'MIDNIGHT Worldwide'; };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: w }, { data: d }] = await Promise.all([
          supabase.from('solstice_seasons').select('*').eq('status', 'open').single(),
          supabase.from('solstice_weeks').select('*').order('start_date'),
          supabase.from('solstice_program_days').select('*').order('day_number'),
        ]);
        if (s) setSeason(s as Season);
        if (w?.length) setWeeks(w as Week[]);
        if (d?.length) setDays(d as Day[]);
      } catch { /* fallback to defaults below */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Fallbacks if DB is empty
  const s: Season = season ?? {
    id: '', name: 'SOLSTICE 2026', tagline: 'SELECTED BEATS. PRIVATE SUNSET.',
    entry_price: 40000, combo_total: 400000, combo1_total: 300000,
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
    { day_number: 3, title: 'Catamarán',     subtitle: '50 p · DJ · AYCD · Bahía', price: 130000, highlight: true  },
    { day_number: 4, title: 'Playa privada', subtitle: 'All you can drink',         price: 100000, highlight: false },
    { day_number: 5, title: 'Cierre',        subtitle: 'Última noche',              price: 70000,  highlight: false },
  ];

  const entryK = Math.round(s.entry_price / 1000);
  const comboK = Math.round(s.combo_total / 1000);
  const cuotaK = Math.round(s.combo_total / (s.installments || 1) / 1000);
  const combo1K = Math.round(s.combo1_total / 1000);
  const cuota1K = Math.round(s.combo1_total / (s.combo1_installments || 1) / 1000);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <div className="w-1 h-12 animate-pulse" style={{ background: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="min-h-screen overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 z-10" style={{ background: 'rgba(0,0,0,0.65)' }} />
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000"
            alt="Atardecer Santa Marta"
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(60%) brightness(0.45)' }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="relative z-20 text-center px-6"
        >
          <h1 className="uppercase flex items-center justify-center gap-3 leading-none mb-6"
            style={{ fontFamily: "'Poiret One', sans-serif", fontSize: 'clamp(4rem, 14vw, 10rem)', letterSpacing: '0.05em' }}>
            S
            <span className="inline-block rounded-full border-4"
              style={{ width: 'clamp(2.2rem,5vw,5rem)', height: 'clamp(2.2rem,5vw,5rem)', borderColor: C.red }} />
            LSTICE
          </h1>
          <p className="text-lg md:text-2xl font-light mb-3" style={{ letterSpacing: '0.22em', color: C.red }}>
            {s.tagline}
          </p>
          <p className="text-sm mb-14 uppercase" style={{ letterSpacing: '0.3em', color: C.gray }}>
            Santa Marta · Sep–Oct 2026 · Una vez al año.
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('reserva')}
            className="px-12 py-4 text-sm font-black uppercase"
            style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}
          >
            RESERVA TU SEMANA
          </motion.button>
        </motion.div>

        {/* Hero badge */}
        <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center gap-3 flex-wrap px-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.gray}40` }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.red }} />
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
              {s.phase1_limit
                ? `Fase 1 activa — primeras ${s.phase1_limit} reservas desde `
                : 'Reserva desde '}
              <strong style={{ color: C.red }}>${entryK}K</strong>
            </span>
          </div>
        </div>
      </section>

      {/* ── SEMANAS ── */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl text-center mb-3 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          Semanas Disponibles
        </h2>
        <p className="text-center text-xs uppercase mb-16" style={{ letterSpacing: '0.3em', color: C.gray }}>
          {displayWeeks.length} universidades · Santa Marta 2026
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayWeeks.map((week, idx) => (
            <WeekCard
              key={week.id}
              week={week}
              idx={idx}
              onSelect={() => onNavigate(`reserva:${week.university}`)}
            />
          ))}
        </div>
      </section>

      {/* ── PROGRAMA ── */}
      <section className="py-24 overflow-hidden" style={{ background: C.bgS }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl text-center mb-3 uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
            Programa — {displayDays.length} Días
          </h2>
          <p className="text-center text-xs uppercase mb-20" style={{ letterSpacing: '0.3em', color: C.gray }}>
            Todo incluido · Atardecer cada noche
          </p>
          <div className="relative">
            <div className="hidden md:block absolute top-[2.4rem] left-0 right-0 h-px" style={{ background: `${C.gray}20` }} />
            <div className="flex flex-col md:flex-row justify-between gap-12 relative z-10">
              {displayDays.map(day => (
                <div key={day.day_number} className="flex-1 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-6 border-2"
                    style={day.highlight
                      ? { background: C.red, borderColor: C.red, color: C.cream }
                      : { borderColor: `${C.gray}50`, color: C.gray }}>
                    {day.highlight ? <Ship size={18} /> : <span className="text-sm">{day.day_number}</span>}
                  </div>
                  <h4 className="text-base mb-1 uppercase"
                    style={{ color: day.highlight ? C.red : C.cream, fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
                    {day.title}
                  </h4>
                  <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.1em' }}>{day.subtitle}</p>
                  <p className="text-[9px] uppercase" style={{ color: `${C.gray}80`, letterSpacing: '0.1em' }}>
                    ${Math.round(day.price / 1000)}K individual
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-14 flex items-center justify-center gap-8 flex-wrap">
            <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
              Sueltos: ${Math.round(displayDays.reduce((a, d) => a + d.price, 0) / 1000)}K
            </span>
            <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.2em' }}>
              Combo completo: ${comboK}K
            </span>
            <span className="text-[10px] uppercase" style={{ color: `${C.gray}80`, letterSpacing: '0.2em' }}>
              Combo 1 (sin Catamarán): ${combo1K}K
            </span>
            <button
              onClick={() => onNavigate('programa')}
              className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest transition-all hover:opacity-100 opacity-60"
              style={{ color: C.cream, letterSpacing: '0.25em' }}>
              Ver programa completo <ChevronRight size={11} />
            </button>
          </div>
        </div>
      </section>

      {/* ── LA VACA ── */}
      <section className="py-24 px-4 max-w-4xl mx-auto text-center">
        <h2 className="text-4xl mb-4 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          La Vaca — Cómo funciona
        </h2>
        <p className="text-sm mb-2" style={{ color: C.gray }}>
          Reserva con <strong style={{ color: C.cream }}>${entryK}K</strong> hoy.
          El resto en cuotas mensuales sin interés.
        </p>
        <p className="text-xs uppercase mb-14" style={{ color: `${C.gray}80`, letterSpacing: '0.2em' }}>
          Sin interés · Sin multa si cancelas antes del primer mes
        </p>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14 text-left">
          {/* Combo 1 */}
          <div className="p-8 relative" style={{ background: C.bgS, border: `1px solid ${C.gray}30` }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] uppercase font-black whitespace-nowrap"
              style={{ background: C.gray, letterSpacing: '0.2em', color: C.bg }}>
              Combo 1
            </div>
            <div className="text-5xl font-black mb-1" style={{ color: C.cream }}>${combo1K}K</div>
            <p className="text-xs uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.15em' }}>
              {s.combo1_installments} cuotas de ${cuota1K}K/mes
            </p>
            <div className="space-y-1.5 text-xs" style={{ color: C.gray }}>
              <div className="flex justify-between">
                <span>Reserva inicial</span>
                <span style={{ color: C.cream }}>${entryK}K</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray}20` }}>
                <span>Total</span>
                <span style={{ color: C.cream }}>${combo1K}K</span>
              </div>
            </div>
          </div>

          {/* Combo completo */}
          <div className="p-8 relative" style={{ background: C.bgS, border: `1px solid ${C.red}40` }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] uppercase font-black whitespace-nowrap"
              style={{ background: C.red, letterSpacing: '0.2em' }}>
              Combo Completo
            </div>
            <div className="text-5xl font-black mb-1" style={{ color: C.red }}>${comboK}K</div>
            <p className="text-xs uppercase mb-4" style={{ color: `${C.red}80`, letterSpacing: '0.15em' }}>
              {s.installments} cuotas de ${cuotaK}K/mes
            </p>
            <div className="space-y-1.5 text-xs" style={{ color: `${C.gray}` }}>
              <div className="flex justify-between">
                <span>Reserva inicial</span>
                <span style={{ color: C.cream }}>${entryK}K</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray}20` }}>
                <span>Total</span>
                <span style={{ color: C.red }}>${comboK}K</span>
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-5 text-left max-w-md mx-auto">
          {[
            'Tocas el botón de reserva',
            `Pagas $${entryK}K por Bold`,
            'Recibes tu QR de confirmación',
            'Cuotas mensuales vía link WhatsApp',
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{ border: `1px solid ${C.gray}`, color: C.gray }}>
                {i + 1}
              </div>
              <p className="text-sm uppercase" style={{ letterSpacing: '0.1em' }}>{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-32 text-center px-4"
        style={{ background: `linear-gradient(to top, ${C.red}22, transparent)` }}>
        <h2 className="text-5xl md:text-7xl mb-8 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.05em' }}>
          Tu semana empieza aquí.
        </h2>
        <p className="text-lg mb-12 max-w-xl mx-auto" style={{ color: `${C.cream}cc` }}>
          ¿Listo para el atardecer perfecto? Asegura tu cupo con ${entryK},000 hoy.
        </p>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate('reserva')}
          className="flex items-center gap-4 mx-auto px-16 py-5 text-base font-black uppercase"
          style={{ background: C.red, color: '#fff', letterSpacing: '0.25em' }}
        >
          RESERVAR AHORA <ChevronRight size={18} />
        </motion.button>
      </section>

    </div>
  );
}
