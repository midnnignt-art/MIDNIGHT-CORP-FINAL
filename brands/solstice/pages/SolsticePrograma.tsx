import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';
import { Ship, Sun, Waves, Music, Star, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SOLSTICE_DAYS } from '../constants';

const C = {
  bg: '#000', red: '#E6392F', gray: '#606060', cream: '#F9F2D7',
};

interface ProgramDay {
  day_number: number; title: string; subtitle: string;
  price: number; image_url: string | null; highlight: boolean;
}

interface Props { onNavigate: (page: string) => void; }

// ─── Data por día ───────────────────────────────────────────────────────────

const DAY_ICONS: Record<number, React.ReactNode> = {
  1: <Sun   size={20} />,
  2: <Ship  size={20} />,   // día 2 = Lanchas + Beach Club
  3: <Music size={20} />,
  4: <Waves size={20} />,
  5: <Star  size={20} />,
};

const DAY_IMAGES: Record<number, string> = {
  1: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=1600',
  2: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1600',
  3: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1600',
  4: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1600',
  5: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1600',
};

const INCLUDED: Record<number, string[]> = {
  1: ['Tardeada', 'Rooftop más alto de la ciudad'],
  2: ['Lanchas privadas', 'Beach Club exclusivo', 'DJ', 'Bahía privada'],
  3: ['Rooftop party'],
  4: ['Rooftop party'],
  5: ['Fiesta de cierre', 'Edición especial'],
};

// Atmósfera por día — gradient que va del amanecer al cierre nocturno
const DAY_ATMOSPHERE: Record<number, { eyebrow: string; gradient: string; sunColor: string; sunBlur: string }> = {
  1: {
    eyebrow: 'Apertura · Tardeada + Rooftop',
    gradient: 'linear-gradient(180deg, #1a0a0c 0%, #381210 40%, #6b1e1c 75%, #1a0506 100%)',
    sunColor: 'rgba(255,180,140,0.55)',
    sunBlur: '60px',
  },
  2: {
    eyebrow: 'Día icónico · Lanchas + Beach Club',
    gradient: 'linear-gradient(180deg, #050a18 0%, #0d2440 25%, #1a4060 50%, #6b4520 80%, #2a1108 100%)',
    sunColor: 'rgba(255,220,180,0.85)',
    sunBlur: '40px',
  },
  3: {
    eyebrow: 'Rooftop',
    gradient: 'linear-gradient(180deg, #0a0205 0%, #2a0e10 35%, #8b2c20 70%, #1f0808 100%)',
    sunColor: 'rgba(255,140,80,0.65)',
    sunBlur: '50px',
  },
  4: {
    eyebrow: 'Rooftop',
    gradient: 'linear-gradient(180deg, #200608 0%, #4a1410 30%, #8c2818 55%, #c04020 75%, #1a0506 100%)',
    sunColor: 'rgba(255,100,60,0.85)',
    sunBlur: '70px',
  },
  5: {
    eyebrow: 'Cierre · Midnight (Edición Especial)',
    gradient: 'linear-gradient(180deg, #050308 0%, #1a0a18 40%, #2a0e1c 70%, #050208 100%)',
    sunColor: 'rgba(176,38,255,0.45)',
    sunBlur: '90px',
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function SolsticePrograma({ onNavigate }: Props) {
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('solstice_program_days')
          .select('day_number,title,subtitle,price,image_url,highlight')
          .order('day_number');

        if (data?.length) {
          setDays(data as ProgramDay[]);
        } else {
          setDays(SOLSTICE_DAYS.map(d => ({
            day_number: d.day, title: d.title, subtitle: d.subtitle,
            price: d.price, image_url: null, highlight: !!d.highlight,
          })));
        }
      } catch {
        setDays(SOLSTICE_DAYS.map(d => ({
          day_number: d.day, title: d.title, subtitle: d.subtitle,
          price: d.price, image_url: null, highlight: !!d.highlight,
        })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalIndividual = days.reduce((a, d) => a + d.price, 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* ── HERO HEADER ─────────────────────────────────────────────────── */}
      <ProgramaHero
        totalIndividual={totalIndividual}
        onNavigate={onNavigate}
      />

      {/* ── TIMELINE CINEMÁTICO ────────────────────────────────────────── */}
      <div className="relative">
        {days.map((day, idx) => (
          <DaySection
            key={day.day_number}
            day={day}
            index={idx}
            total={days.length}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* ── CALENDARIOS POR UNIVERSIDAD (v3) ───────────────────────────── */}
      <section className="py-20 md:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>El cronograma oficial</p>
            <h2 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.02em', fontWeight: 300, color: C.cream }}>
              Calendario por universidad
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
            {['javeriana', 'andes', 'cesa'].map((file, i) => (
              <motion.div
                key={file}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.08, duration: 0.7 }}
                style={{ borderRadius: '16px', overflow: 'hidden', border: '0.5px solid rgba(230,57,47,0.25)', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}
              >
                <video
                  src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/assets/solstice/calendars/${file}.mp4`}
                  poster={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/assets/solstice/calendars/${file}.jpg`}
                  autoPlay muted loop playsInline preload="metadata"
                  aria-label={`Calendario ${file}`}
                  className="w-full block"
                  style={{ aspectRatio: '4 / 5', objectFit: 'cover' }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────── */}
      <FinalCta onNavigate={onNavigate} />

    </div>
  );
}

// ─── Hero superior ──────────────────────────────────────────────────────────

function ProgramaHero({ totalIndividual, onNavigate }: { totalIndividual: number; onNavigate: (p: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <section className="relative overflow-hidden px-6 md:px-12 pt-24 md:pt-32 pb-16 md:pb-20"
      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
      {/* Sun glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '70%', top: '30%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(230,57,47,0.18) 0%, transparent 60%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative max-w-6xl">
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-[10px] uppercase mb-4"
          style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}
        >
          Solstice 2026 · El programa
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="uppercase mb-5 leading-none"
          style={{
            fontFamily: "'Poiret One', sans-serif",
            fontSize: 'clamp(3rem, 9vw, 7rem)',
            letterSpacing: '-0.025em',
            fontWeight: 300,
          }}
        >
          5 días en<br/>Santa Marta
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="text-sm md:text-base max-w-xl mb-8"
          style={{ color: '#a0a0a8', fontWeight: 400, lineHeight: 1.65 }}
        >
          Un programa pensado como un ritual: amanecer, fiesta, mar, atardecer
          y cierre. Cada día empuja al siguiente — no es un combo, es una historia.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="flex items-center gap-6 flex-wrap"
        >
          <div className="flex flex-col">
            <span className="text-[9px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 500 }}>
              Sueltos
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: '#a0a0a8', fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>
              ${Math.round(totalIndividual / 1000)}K
            </span>
          </div>
          <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 500 }}>
              Combo reserva
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: C.red, fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>
              Desde $40K
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('reserva')}
            className="flex items-center gap-2 px-8 py-3 text-xs uppercase font-medium ml-auto"
            style={{
              background: hovered ? 'rgba(230,57,47,0.45)' : 'rgba(230,57,47,0.25)',
              color: C.cream,
              borderRadius: '999px',
              border: '0.5px solid rgba(230,57,47,0.55)',
              transform: hovered ? 'translateY(-2px) scale(1.02)' : 'none',
              boxShadow: hovered ? '0 12px 32px rgba(230,57,47,0.4)' : 'none',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              letterSpacing: '0.2em',
              fontWeight: 600,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            Reservar <ChevronRight size={14} />
          </motion.button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 0.4 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-16 flex items-center gap-2"
        >
          <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
            Scroll para empezar
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown size={14} style={{ color: C.red }} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Sección por día con parallax + sticky number ─────────────────────────

function DaySection({ day, index, total, onNavigate }: {
  day: ProgramDay; index: number; total: number; onNavigate: (p: string) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  // Parallax: la imagen se mueve más lento que el viewport
  const imgY    = useTransform(scrollYProgress, [0, 1], ['-15%', '15%']);
  const imgScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1.0, 1.1]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [1, 0.55, 0.55, 1]);

  const img = day.image_url || DAY_IMAGES[day.day_number];
  const included = INCLUDED[day.day_number] || [];
  const atm = DAY_ATMOSPHERE[day.day_number] || DAY_ATMOSPHERE[1];
  const isHighlight = day.highlight || day.day_number === 2;  // día 2 = Lanchas + Beach Club

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: atm.gradient }}
    >
      {/* Sun glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: index % 2 === 0 ? '15%' : '70%',
          top: '25%',
          width: '480px', height: '480px',
          background: `radial-gradient(circle, ${atm.sunColor} 0%, transparent 65%)`,
          filter: `blur(${atm.sunBlur})`,
          pointerEvents: 'none',
        }}
      />

      {/* Imagen parallax */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          y: imgY,
          scale: imgScale,
          zIndex: 1,
        }}
      >
        <img
          src={img}
          alt={day.title}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover',
            filter: isHighlight ? 'saturate(0.85) brightness(0.85)' : 'saturate(0.6) brightness(0.45)',
          }}
        />
      </motion.div>

      {/* Overlay variable */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: `linear-gradient(${index % 2 === 0 ? '90deg' : '270deg'}, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.2) 80%, transparent 100%)`,
          opacity: overlayOpacity,
        }}
      />

      {/* Highlight: partículas extra para Día 3 (Lanchas + Beach Club) */}
      {day.day_number === 2 && <CatamaranSparkles />}

      {/* Contenido */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-24">
        <div className={`grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 ${index % 2 === 0 ? '' : 'md:[direction:rtl]'}`}>

          {/* Número sticky gigante */}
          <div className="md:col-span-3 md:[direction:ltr]">
            <div className="md:sticky md:top-24">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="text-[10px] uppercase mb-4"
                style={{ letterSpacing: '0.4em', color: isHighlight ? C.red : C.gray, fontWeight: 600 }}
              >
                {atm.eyebrow}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="leading-none"
                style={{
                  fontFamily: "'Poiret One', sans-serif",
                  // Reducido para que respete la columna md:col-span-3 (~25% del ancho)
                  // antes desbordaba sobre el título a la derecha
                  fontSize: 'clamp(4.5rem, 13vw, 10rem)',
                  fontWeight: 200,
                  letterSpacing: '-0.03em',
                  color: isHighlight ? C.red : C.cream,
                  WebkitTextStroke: isHighlight ? '0px' : '0.5px rgba(249,242,215,0.3)',
                  WebkitTextFillColor: isHighlight ? undefined : 'transparent',
                  textShadow: isHighlight ? `0 0 60px rgba(230,57,47,0.4)` : 'none',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  maxWidth: '100%',
                }}
              >
                {String(day.day_number).padStart(2, '0')}
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-[10px] uppercase mt-2"
                style={{ letterSpacing: '0.35em', color: C.gray, fontWeight: 500 }}
              >
                Día {day.day_number} de {total}
              </motion.p>
            </div>
          </div>

          {/* Contenido del día */}
          <div className="md:col-span-9 md:[direction:ltr] space-y-6">

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Icon + badge highlight */}
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    background: isHighlight ? C.red : 'rgba(255,255,255,0.05)',
                    color: isHighlight ? C.cream : C.gray,
                    border: isHighlight ? '0.5px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.10)',
                    boxShadow: isHighlight ? '0 8px 24px rgba(230,57,47,0.35)' : 'none',
                  }}
                >
                  {DAY_ICONS[day.day_number] || <span>{day.day_number}</span>}
                </div>
                {isHighlight && (
                  <span
                    className="text-[10px] uppercase px-3 py-1"
                    style={{
                      background: 'rgba(230,57,47,0.18)',
                      color: C.red,
                      letterSpacing: '0.3em',
                      borderRadius: '999px',
                      fontWeight: 600,
                      border: '0.5px solid rgba(230,57,47,0.35)',
                    }}
                  >
                    Destacado
                  </span>
                )}
              </div>

              {/* Título grande */}
              <h2
                className="uppercase mb-3 leading-none"
                style={{
                  fontFamily: "'Poiret One', sans-serif",
                  fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
                  letterSpacing: '-0.025em',
                  fontWeight: 300,
                  color: isHighlight ? C.red : C.cream,
                }}
              >
                {day.title}
              </h2>

              {/* Subtítulo */}
              <p
                className="text-base md:text-lg mb-2"
                style={{
                  color: '#a0a0a8',
                  lineHeight: 1.5,
                  fontWeight: 400,
                  maxWidth: '600px',
                }}
              >
                {day.subtitle}
              </p>
            </motion.div>

            {/* Precio + includes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Precio */}
              <div className="flex items-baseline gap-3 mb-6">
                <span
                  className="tabular-nums"
                  style={{
                    fontFamily: "'Poiret One', sans-serif",
                    fontSize: 'clamp(2rem, 5vw, 3rem)',
                    fontWeight: 300,
                    color: isHighlight ? C.red : C.cream,
                    letterSpacing: '-0.02em',
                  }}
                >
                  ${Math.round(day.price / 1000)}K
                </span>
                <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
                  / día individual
                </span>
              </div>

              {/* Includes */}
              <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.35em', color: isHighlight ? C.red : C.gray, fontWeight: 600 }}>
                Incluye
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {included.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3 py-2"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        background: isHighlight ? C.red : '#a0a0a8',
                        boxShadow: isHighlight ? `0 0 8px rgba(230,57,47,0.6)` : 'none',
                      }}
                    />
                    <span
                      className="text-sm md:text-base"
                      style={{ color: C.cream, letterSpacing: '0.02em', fontWeight: 400 }}
                    >
                      {item}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* CTA por día */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="pt-4"
            >
              <DayCta isHighlight={isHighlight} onClick={() => onNavigate('reserva')} />
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Lanchas + Beach Club: partículas extra para el día icónico ──────────

function CatamaranSparkles() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0],
            y: [0, -40 - Math.random() * 30],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            left: `${10 + Math.random() * 80}%`,
            top: `${40 + Math.random() * 50}%`,
            width: 3,
            height: 3,
            borderRadius: '999px',
            background: '#FFE0B0',
            boxShadow: '0 0 8px rgba(255,180,140,0.85)',
          }}
        />
      ))}
    </div>
  );
}

// ─── Botón CTA por día ───────────────────────────────────────────────────

function DayCta({ isHighlight, onClick }: { isHighlight: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex items-center gap-2.5 px-7 py-3 text-xs uppercase"
      style={{
        background: isHighlight
          ? (hovered ? 'rgba(230,57,47,0.45)' : 'rgba(230,57,47,0.25)')
          : (hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'),
        color: isHighlight ? C.cream : '#F9F2D7',
        border: isHighlight ? '0.5px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.18)',
        borderRadius: '999px',
        letterSpacing: '0.2em',
        fontWeight: 600,
        transform: hovered ? 'translateY(-1px) scale(1.01)' : 'none',
        boxShadow: hovered && isHighlight ? '0 12px 32px rgba(230,57,47,0.4)' : 'none',
        transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
      }}
    >
      Reservar la semana <ChevronRight size={14} />
    </button>
  );
}

// ─── CTA final ────────────────────────────────────────────────────────────

function FinalCta({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <section className="relative py-32 px-6 md:px-12 text-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(230,57,47,0.08) 100%)' }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', left: '50%', bottom: '0',
          transform: 'translateX(-50%)',
          width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(230,57,47,0.20) 0%, transparent 65%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div className="relative max-w-3xl mx-auto">
        <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
          La hora de tomar la decisión
        </p>
        <h2 className="uppercase mb-6 leading-none"
          style={{
            fontFamily: "'Poiret One', sans-serif",
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            letterSpacing: '-0.025em',
            fontWeight: 300,
            color: C.cream,
          }}
        >
          5 días que no se repiten.<br/>Una semana al año.
        </h2>
        <p className="text-base mb-10 max-w-xl mx-auto" style={{ color: '#a0a0a8', lineHeight: 1.6 }}>
          Desde <strong style={{ color: C.red }}>$40K</strong> hoy y el resto en cuotas sin interés.
          Tu lugar queda bloqueado al confirmar.
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate('reserva')}
          className="inline-flex items-center gap-3 px-16 py-5 text-sm uppercase"
          style={{
            background: hovered ? 'rgba(230,57,47,0.45)' : 'rgba(230,57,47,0.25)',
            color: C.cream,
            borderRadius: '999px',
            border: '0.5px solid rgba(230,57,47,0.55)',
            transform: hovered ? 'translateY(-2px) scale(1.02)' : 'none',
            boxShadow: hovered ? '0 16px 40px rgba(230,57,47,0.45)' : '0 4px 12px rgba(230,57,47,0.15)',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            letterSpacing: '0.25em',
            fontWeight: 600,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          Quiero ir <ChevronRight size={18} />
        </motion.button>
        <p className="text-[9px] uppercase mt-8" style={{ letterSpacing: '0.4em', color: '#a0a0a880', fontWeight: 500 }}>
          Pago seguro · Sin recargo de cuotas · Sin multa de cancelación
        </p>
      </div>
    </section>
  );
}
