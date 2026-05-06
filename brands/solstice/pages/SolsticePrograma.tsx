import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ship, Sun, Waves, Music, Star, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SOLSTICE_DAYS } from '../constants';

const C = {
  bg: '#000', bgS: '#0d0d0d', bgT: '#111',
  red: '#E6392F', gray: '#606060', cream: '#F9F2D7',
};

interface ProgramDay {
  day_number: number; title: string; subtitle: string;
  price: number; image_url: string | null; highlight: boolean;
}

const DAY_ICONS: Record<number, React.ReactNode> = {
  1: <Sun size={20} />,
  2: <Music size={20} />,
  3: <Ship size={20} />,
  4: <Waves size={20} />,
  5: <Star size={20} />,
};

const DAY_IMAGES: Record<number, string> = {
  1: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=900',
  2: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900',
  3: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=900',
  4: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=900',
  5: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=900',
};

const INCLUDED: Record<number, string[]> = {
  1: ['Bienvenida', 'Hospedaje', 'Apertura nocturna'],
  2: ['Día de playa', 'Fiesta nocturna', 'Hospedaje'],
  3: ['Catamarán 50 personas', 'DJ en altamar', 'All You Can Drink', 'Bahía privada'],
  4: ['Playa privada exclusiva', 'All You Can Drink', 'Almuerzo incluido'],
  5: ['Fiesta de cierre', 'Cena grupal', 'Last night ritual'],
};

interface Props { onNavigate: (page: string) => void; }

export default function SolsticePrograma({ onNavigate }: Props) {
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

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
          // Fallback to constants
          setDays(SOLSTICE_DAYS.map(d => ({
            day_number: d.day,
            title: d.title,
            subtitle: d.subtitle,
            price: d.price,
            image_url: null,
            highlight: !!d.highlight,
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

      {/* Hero header */}
      <div className="relative overflow-hidden px-8 pt-20 pb-16" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 60% 50%, #E6392F 0%, transparent 60%)' }} />
        <div className="relative max-w-4xl">
          <p className="text-[9px] uppercase font-bold mb-3" style={{ color: C.red, letterSpacing: '0.4em' }}>
            Solstice 2026
          </p>
          <h1 className="text-5xl md:text-7xl uppercase mb-4"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.05em', lineHeight: 1 }}>
            El Programa
          </h1>
          <p className="text-sm mb-8 uppercase" style={{ color: C.gray, letterSpacing: '0.25em' }}>
            5 días · Santa Marta · Sep–Oct 2026
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[8px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.25em' }}>
                Sueltos
              </span>
              <span className="text-xl font-black" style={{ color: C.gray }}>
                ${Math.round(totalIndividual / 1000)}K
              </span>
            </div>
            <div className="w-px h-8" style={{ background: `${C.gray}30` }} />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.25em' }}>
                Combo reserva
              </span>
              <span className="text-xl font-black" style={{ color: C.red }}>
                Desde $40K
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('reserva')}
              className="flex items-center gap-2 px-8 py-3 text-xs uppercase font-black tracking-widest ml-auto"
              style={{ background: C.red, color: C.cream }}>
              Reservar <ChevronRight size={14} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Day cards */}
      <div className="px-4 md:px-8 py-16 max-w-7xl mx-auto space-y-6">
        {days.map((day, idx) => {
          const img = day.image_url || DAY_IMAGES[day.day_number];
          const included = INCLUDED[day.day_number] || [];
          const isOpen = expanded === day.day_number;

          return (
            <motion.div
              key={day.day_number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.07 }}
              className="relative overflow-hidden cursor-pointer"
              style={{
                border: day.highlight ? `1px solid ${C.red}60` : `1px solid ${C.gray}18`,
                background: day.highlight ? `${C.red}08` : C.bgS,
              }}
              onClick={() => setExpanded(isOpen ? null : day.day_number)}>

              {/* Image strip + content row */}
              <div className="flex flex-col md:flex-row">

                {/* Image */}
                <div className="md:w-72 h-48 md:h-auto shrink-0 relative overflow-hidden">
                  <img src={img} alt={day.title}
                    className="w-full h-full object-cover transition-transform duration-700"
                    style={{ filter: day.highlight ? 'brightness(0.5) saturate(0.6)' : 'brightness(0.35) grayscale(40%)' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center border-2"
                      style={day.highlight
                        ? { background: C.red, borderColor: C.red, color: C.cream }
                        : { borderColor: `${C.gray}60`, color: C.gray }}>
                      {DAY_ICONS[day.day_number] || <span className="text-lg font-black">{day.day_number}</span>}
                    </div>
                  </div>
                  {day.highlight && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 text-[8px] uppercase font-black"
                      style={{ background: C.red, letterSpacing: '0.2em' }}>
                      Destacado
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-7 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[8px] uppercase mb-1" style={{ color: day.highlight ? `${C.red}90` : C.gray, letterSpacing: '0.3em' }}>
                          Día {day.day_number}
                        </p>
                        <h3 className="text-3xl uppercase"
                          style={{ fontFamily: "'Poiret One', sans-serif", color: day.highlight ? C.red : C.cream, letterSpacing: '0.08em' }}>
                          {day.title}
                        </h3>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[8px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                          Individual
                        </p>
                        <p className="text-xl font-black" style={{ color: day.highlight ? C.red : C.cream }}>
                          ${Math.round(day.price / 1000)}K
                        </p>
                      </div>
                    </div>
                    <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                      {day.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-5">
                    <div className="flex flex-wrap gap-2">
                      {included.slice(0, isOpen ? undefined : 2).map(item => (
                        <span key={item}
                          className="text-[9px] uppercase px-2 py-1"
                          style={{
                            background: day.highlight ? `${C.red}20` : `${C.gray}12`,
                            color: day.highlight ? C.red : C.gray,
                            border: `1px solid ${day.highlight ? C.red + '30' : C.gray + '15'}`,
                          }}>
                          {item}
                        </span>
                      ))}
                      {!isOpen && included.length > 2 && (
                        <span className="text-[9px] uppercase px-2 py-1" style={{ color: C.gray }}>
                          +{included.length - 2} más
                        </span>
                      )}
                    </div>
                    <ChevronRight size={14} className="shrink-0 transition-transform"
                      style={{ color: C.gray, transform: isOpen ? 'rotate(90deg)' : 'none' }} />
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden px-7 pb-6 pt-0"
                  style={{ borderTop: `1px solid ${C.gray}10` }}
                  onClick={e => e.stopPropagation()}>
                  <div className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {included.map(item => (
                      <div key={item} className="flex items-center gap-2 py-2 px-3"
                        style={{ background: `${C.gray}08`, border: `1px solid ${C.gray}12` }}>
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: day.highlight ? C.red : C.gray }} />
                        <span className="text-[10px] uppercase" style={{ color: C.cream, letterSpacing: '0.08em' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onNavigate('reserva')}
                    className="mt-5 flex items-center gap-2 px-6 py-2.5 text-[10px] uppercase font-black tracking-widest transition-all"
                    style={{ background: day.highlight ? C.red : 'transparent', color: day.highlight ? C.cream : C.red, border: `1px solid ${C.red}` }}
                    onMouseEnter={e => { if (!day.highlight) (e.currentTarget as HTMLButtonElement).style.background = `${C.red}15`; }}
                    onMouseLeave={e => { if (!day.highlight) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    Reservar semana completa <ChevronRight size={12} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="px-8 pb-20 max-w-2xl mx-auto text-center space-y-6">
        <div style={{ borderTop: `1px solid ${C.gray}15` }} className="pt-16">
          <h2 className="text-3xl uppercase mb-3"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
            Reserva tu semana
          </h2>
          <p className="text-xs uppercase mb-8" style={{ color: C.gray, letterSpacing: '0.25em' }}>
            Desde $40K · El resto en cómodas cuotas sin interés
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('reserva')}
            className="px-16 py-4 text-sm uppercase font-black tracking-widest"
            style={{ background: C.red, color: C.cream }}>
            Quiero ir — Reservar ahora
          </motion.button>
        </div>
      </div>

    </div>
  );
}
