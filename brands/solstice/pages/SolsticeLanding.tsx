import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Ship, Zap, ArrowLeft } from 'lucide-react';
import { SOLSTICE_SEASON_MOCK, SOLSTICE_WEEKS_MOCK, SOLSTICE_DAYS } from '../constants';
import { SolsticeWeek } from '../types';

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

export default function SolsticeLanding({ onNavigate }: Props) {
  const [weeks, setWeeks] = useState<SolsticeWeek[]>(SOLSTICE_WEEKS_MOCK.map(w => ({ ...w })));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'SOLSTICE 2026 — Preview';
    return () => { document.title = 'MIDNIGHT Worldwide'; };
  }, []);

  // Simulated live cupo updates
  useEffect(() => {
    const names = ['Valentina R.', 'Sebastián M.', 'Daniela C.', 'Felipe A.', 'Natalia P.'];
    const id = setInterval(() => {
      setWeeks(prev => {
        const avail = prev.filter(w => w.reserved < w.capacity);
        if (!avail.length) return prev;
        const t = avail[Math.floor(Math.random() * avail.length)];
        const name = names[Math.floor(Math.random() * names.length)];
        setToast(`${name} reservó semana ${t.university}`);
        setTimeout(() => setToast(null), 3500);
        return prev.map(w => w.id === t.id ? { ...w, reserved: Math.min(w.reserved + 1, w.capacity) } : w);
      });
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const s = SOLSTICE_SEASON_MOCK;
  const entryK = Math.round(s.entry_price / 1000);
  const comboK = Math.round(s.combo_total / 1000);
  const cuotaK = Math.round(s.combo_total / s.installments / 1000);
  const totalLeft = weeks.reduce((a, w) => a + (w.capacity - w.reserved), 0);

  return (
    <div style={{ background: C.bg, color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="min-h-screen overflow-x-hidden">

      {/* Admin preview badge */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-4 py-2 rounded-full"
        style={{ background: 'rgba(230,57,47,0.15)', border: '1px solid rgba(230,57,47,0.4)' }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.red }} />
        <span className="text-[10px] uppercase font-bold" style={{ color: C.red, letterSpacing: '0.3em' }}>Admin Preview</span>
        <button onClick={() => onNavigate('home')} className="flex items-center gap-1 text-[10px] uppercase ml-2 opacity-60 hover:opacity-100 transition-opacity" style={{ color: C.cream }}>
          <ArrowLeft size={10} /> Salir
        </button>
      </div>

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
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="relative z-20 text-center px-6"
        >
          <h1 className="uppercase flex items-center justify-center gap-3 leading-none mb-6"
            style={{ fontFamily: "'Poiret One', sans-serif", fontSize: 'clamp(4rem, 14vw, 10rem)', letterSpacing: '0.05em' }}>
            S
            <span className="inline-block rounded-full border-4" style={{
              width: 'clamp(2.2rem, 5vw, 5rem)',
              height: 'clamp(2.2rem, 5vw, 5rem)',
              borderColor: C.red,
            }} />
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

        {/* badges */}
        <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center gap-3 flex-wrap px-4">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.gray}40` }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.red }} />
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.18em' }}>
              Fase 1 activa &mdash; desde <strong style={{ color: C.red }}>${entryK}K</strong>
            </span>
          </div>
          <div className="flex items-center px-5 py-2.5 rounded-full backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${C.gray}40` }}>
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.18em', color: C.gray }}>
              {totalLeft} cupos disponibles
            </span>
          </div>
        </div>
      </section>

      {/* Activity toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 16, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[9000] flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl"
            style={{ background: C.bgS, border: `1px solid ${C.red}40` }}
          >
            <Zap size={13} style={{ color: C.red }} />
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.15em' }}>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SEMANAS ── */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <h2 className="text-3xl text-center mb-3 uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          Semanas Disponibles
        </h2>
        <p className="text-center text-xs uppercase mb-16" style={{ letterSpacing: '0.3em', color: C.gray }}>
          Cupos en tiempo real · 3 universidades
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {weeks.map((week, idx) => {
            const pct = (week.reserved / week.capacity) * 100;
            const left = week.capacity - week.reserved;
            const urgent = left <= 20;
            return (
              <motion.div key={week.id}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: idx * 0.1 }}
                className="relative p-8"
                style={{ background: C.bgS, border: `1px solid ${urgent ? C.red + '55' : C.gray + '25'}` }}
              >
                {urgent && (
                  <div className="absolute -top-3 left-6 px-3 py-1 text-[9px] uppercase font-black"
                    style={{ background: C.red, letterSpacing: '0.15em' }}>
                    ¡Últimos cupos!
                  </div>
                )}
                <div className="absolute top-4 right-4 text-[10px] uppercase" style={{ color: C.gray }}>
                  {week.reserved}/{week.capacity}
                </div>
                <h3 className="text-2xl mb-2 uppercase"
                  style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
                  {week.university}
                </h3>
                <p className="text-xs mb-6 uppercase" style={{ letterSpacing: '0.2em', color: C.gray }}>
                  {new Date(week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                </p>
                <div className="w-full h-[2px] mb-1" style={{ background: `${C.gray}20` }}>
                  <motion.div className="h-full"
                    initial={{ width: 0 }} whileInView={{ width: `${pct}%` }}
                    animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }}
                    style={{ background: C.red }} />
                </div>
                <p className="text-[9px] uppercase mb-8" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                  {left} cupos libres · {pct.toFixed(0)}% vendido
                </p>
                <button
                  onClick={() => onNavigate(`reserva:${week.university}`)}
                  className="w-full py-3 text-xs uppercase transition-colors"
                  style={{ border: `1px solid ${C.gray}30`, color: C.gray, letterSpacing: '0.2em' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.red; (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.gray}30`; (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}
                >
                  Seleccionar semana
                </button>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── PROGRAMA ── */}
      <section className="py-24 overflow-hidden" style={{ background: C.bgS }}>
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl text-center mb-3 uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
            Programa — 5 Días
          </h2>
          <p className="text-center text-xs uppercase mb-20" style={{ letterSpacing: '0.3em', color: C.gray }}>
            Todo incluido · Atardecer cada noche
          </p>
          <div className="relative">
            <div className="hidden md:block absolute top-[2.4rem] left-0 right-0 h-px" style={{ background: `${C.gray}20` }} />
            <div className="flex flex-col md:flex-row justify-between gap-12 relative z-10">
              {SOLSTICE_DAYS.map(day => (
                <div key={day.day} className="flex-1 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-6 border-2"
                    style={day.highlight
                      ? { background: C.red, borderColor: C.red, color: C.cream }
                      : { borderColor: `${C.gray}50`, color: C.gray }}>
                    {day.highlight ? <Ship size={18} /> : <span className="text-sm">{day.day}</span>}
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
          <div className="mt-14 flex justify-center gap-8 flex-wrap">
            <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Sueltos: $440K</span>
            <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.2em' }}>Combo: ${comboK}K · Ahorras $40K</span>
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
          El resto en {s.installments} cuotas de <strong style={{ color: C.cream }}>${cuotaK}K</strong>.
        </p>
        <p className="text-xs uppercase mb-14" style={{ color: `${C.gray}80`, letterSpacing: '0.2em' }}>
          Sin interés · Sin multa si cancelas antes del primer mes
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center text-left">
          <div className="p-10 relative" style={{ background: C.bgS, border: `1px solid ${C.red}40` }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 text-[10px] uppercase font-black"
              style={{ background: C.red, letterSpacing: '0.2em' }}>
              Reserva
            </div>
            <div className="text-6xl font-black mb-1" style={{ fontFamily: "'Archivo', sans-serif", fontStretch: '125%', color: C.red }}>
              ${entryK}K
            </div>
            <p className="text-xs uppercase mb-6" style={{ color: C.gray, letterSpacing: '0.15em' }}>Pago inicial · Hoy</p>
            <div className="space-y-2 text-xs" style={{ color: C.gray }}>
              <div className="flex justify-between">
                <span>Cuota mensual ×{s.installments}</span>
                <span style={{ color: C.cream }}>${cuotaK}K</span>
              </div>
              <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${C.gray}20` }}>
                <span>Total combo</span>
                <span style={{ color: C.cream }}>${comboK}K</span>
              </div>
            </div>
          </div>
          <div className="space-y-5">
            {[
              'Tocas el botón de reserva',
              `Pagas $${entryK}K por Bold`,
              `${s.installments} cuotas mensuales de $${cuotaK}K`,
              'Recibes confirmación y acceso al programa',
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
        <p className="mt-6 text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {totalLeft} cupos restantes
        </p>
      </section>

    </div>
  );
}
