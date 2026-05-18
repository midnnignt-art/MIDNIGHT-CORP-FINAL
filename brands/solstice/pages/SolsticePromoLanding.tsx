import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Sun, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props {
  refCode: string;
}

interface Promoter {
  name: string;
  university: string | null;
  ref_code: string;
  user_id: string;
}

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060' };

export default function SolsticePromoLanding({ refCode }: Props) {
  const [loading, setLoading] = useState(true);
  const [promoter, setPromoter] = useState<Promoter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';

    const code = refCode.toUpperCase();
    sessionStorage.setItem('ms_ref_code', code);

    async function load() {
      try {
        const { data: seller } = await supabase
          .from('solstice_sellers')
          .select('user_id, ref_code')
          .ilike('ref_code', code)
          .maybeSingle();
        if (!seller) {
          setError('Promotor no encontrado.');
          setLoading(false);
          return;
        }
        const { data: profile } = await supabase
          .from('promoters')
          .select('name')
          .eq('user_id', seller.user_id)
          .maybeSingle();

        // Universidad: tomar de un registro existente o de la semana asignada
        const { data: anyReg } = await supabase
          .from('solstice_registrations')
          .select('customer_university')
          .eq('seller_id', seller.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setPromoter({
          name: profile?.name || 'Tu pana',
          university: anyReg?.customer_university || null,
          ref_code: seller.ref_code,
          user_id: seller.user_id,
        });
      } catch {
        setError('Error al cargar.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refCode]);

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  if (error || !promoter) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}
        className="flex flex-col items-center justify-center px-6 text-center gap-4">
        <AlertCircle size={28} style={{ color: C.red }} />
        <h1 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>
          Código inválido
        </h1>
        <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {error || 'Este código no corresponde a ningún promotor activo.'}
        </p>
        <a href="/sol" className="text-xs uppercase mt-4"
          style={{ color: C.red, letterSpacing: '0.2em', textDecoration: 'underline' }}>
          Ir a Solstice →
        </a>
      </div>
    );
  }

  const firstName = promoter.name.split(' ')[0];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif", overflow: 'hidden', position: 'relative' }}>
      {/* Atmospheric sunset gradient */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(230,57,47,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,122,0,0.08) 0%, transparent 60%),
            #000
          `,
        }}
      />

      {/* Floating particles */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.8, 0],
              y: [0, -50, -100],
              x: [0, Math.random() * 30 - 15, Math.random() * 60 - 30],
            }}
            transition={{
              duration: 6 + Math.random() * 4,
              delay: Math.random() * 4,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              bottom: '-10px',
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              borderRadius: '999px',
              background: i % 2 === 0 ? '#E6392F' : '#FFB48C',
              boxShadow: i % 2 === 0 ? '0 0 8px rgba(230,57,47,0.6)' : '0 0 8px rgba(255,180,140,0.6)',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-md mx-auto px-6 py-14 md:py-20">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <Sparkles size={11} style={{ color: C.red }} />
          <p className="text-[10px] uppercase" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Invitación personal
          </p>
          <Sparkles size={11} style={{ color: C.red }} />
        </motion.div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <p className="text-sm uppercase mb-6" style={{ color: C.gray, letterSpacing: '0.25em' }}>
            {firstName} te invita a
          </p>
          <h1 className="uppercase mb-4"
            style={{
              fontFamily: "'Poiret One', sans-serif",
              fontSize: 'clamp(4rem, 16vw, 7rem)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              fontWeight: 300,
              color: C.red,
              textShadow: '0 0 60px rgba(230,57,47,0.45)',
            }}
          >
            SOLSTICE
          </h1>
          <p className="text-xs uppercase mb-4" style={{ color: C.cream, letterSpacing: '0.35em', fontWeight: 500 }}>
            Santa Marta · 2026
          </p>
          <p className="text-sm" style={{ color: '#a0a0a8', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
            5 días · 5 universidades · Atardecer en catamarán · Lo más codiciado de Latinoamérica este verano.
          </p>
        </motion.div>

        {/* Promoter card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.035)',
            backdropFilter: 'blur(28px) saturate(180%)',
            border: '0.5px solid rgba(230,57,47,0.30)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            padding: '22px',
            marginBottom: '24px',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${C.red}, #FF7A00)`,
                color: '#fff',
                fontSize: '22px',
                fontWeight: 600,
                fontFamily: "'Poiret One', sans-serif",
                boxShadow: '0 8px 24px rgba(230,57,47,0.45)',
              }}
            >
              {firstName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase mb-0.5" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                Tu promotor
              </p>
              <p className="text-base font-semibold" style={{ color: C.cream }}>
                {promoter.name}
              </p>
              {promoter.university && (
                <p className="text-[11px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                  {promoter.university}
                </p>
              )}
            </div>
            <div
              className="flex-shrink-0 px-3 py-1.5 text-[10px] uppercase"
              style={{
                background: 'rgba(230,57,47,0.18)',
                border: '0.5px solid rgba(230,57,47,0.45)',
                color: C.red,
                letterSpacing: '0.2em',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              {promoter.ref_code}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="space-y-3"
        >
          <motion.a
            href="/sol"
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-3 py-4 text-sm uppercase"
            style={{
              background: C.red,
              color: '#fff',
              letterSpacing: '0.2em',
              borderRadius: '999px',
              fontWeight: 600,
              boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
              textDecoration: 'none',
            }}
          >
            <Sun size={16} />
            Reservar mi semana
            <ChevronRight size={16} />
          </motion.a>

          <p className="text-[10px] uppercase text-center" style={{ color: `${C.gray}aa`, letterSpacing: '0.25em' }}>
            Reservás con $40K · Tu compra le acredita a {firstName}
          </p>
        </motion.div>

        {/* Stats trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="grid grid-cols-3 gap-3 mt-12 pt-8"
          style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}
        >
          <Stat label="Días" value="5" />
          <Stat label="Unis" value="5" />
          <Stat label="Cupos" value="200+" />
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl tabular-nums" style={{ color: C.cream, fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}
