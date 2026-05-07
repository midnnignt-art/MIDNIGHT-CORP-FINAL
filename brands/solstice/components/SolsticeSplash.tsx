import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

export default function SolsticeSplash({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: '#000',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes solstice-orb-x {
          from { transform: translateX(-18vw); }
          to   { transform: translateX(118vw); }
        }
        @keyframes solstice-orb-y {
          0%, 100% { transform: translateY(62vh); }
          50%       { transform: translateY(16vh); }
        }
        @keyframes sol-pulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.12); }
        }
        @keyframes sol-corona {
          0%, 100% { transform: scale(1)   rotate(0deg);   opacity: 0.55; }
          50%       { transform: scale(1.2) rotate(180deg); opacity: 0.30; }
        }
        @keyframes sol-trail {
          0%   { opacity: 0.40; transform: scaleX(0.3); }
          40%  { opacity: 0.18; transform: scaleX(1); }
          100% { opacity: 0;    transform: scaleX(1.8); }
        }
      `}</style>

      {/* ── Orbiting sun ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        animation: 'solstice-orb-x 2.9s linear infinite',
        willChange: 'transform',
        pointerEvents: 'none',
      }}>
        <div style={{
          animation: 'solstice-orb-y 2.9s ease-in-out infinite',
          willChange: 'transform',
        }}>
          {/* Corona / outer glow */}
          <div style={{
            position: 'absolute',
            inset: '-40px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,150,30,0.40) 0%, rgba(255,100,0,0.18) 45%, transparent 72%)',
            filter: 'blur(22px)',
            animation: 'sol-corona 2.9s ease-in-out infinite',
          }} />

          {/* Mid glow ring */}
          <div style={{
            position: 'absolute',
            inset: '-16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,170,50,0.55) 0%, rgba(255,110,10,0.22) 55%, transparent 75%)',
            filter: 'blur(8px)',
          }} />

          {/* Sun core */}
          <div style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 38%, #fffbe0 0%, #FFD040 28%, #FF8C00 62%, #E6392F 100%)',
            boxShadow:
              '0 0 28px 10px rgba(255,160,20,0.80), ' +
              '0 0 56px 24px rgba(255,100,0,0.45), ' +
              '0 0 100px 48px rgba(230,57,47,0.20)',
            animation: 'sol-pulse 2.9s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* ── Orbit arc guide (faint ellipse) ──────────────────────────────── */}
      <div style={{
        position: 'absolute',
        left: '5vw', right: '5vw',
        top: '16vh', bottom: '38vh',
        borderRadius: '50%',
        border: '0.5px solid rgba(255,120,30,0.08)',
        pointerEvents: 'none',
      }} />

      {/* ── Horizon line ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: '38vh',
        left: 0, right: 0,
        height: '0.5px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,120,30,0.25) 30%, rgba(255,120,30,0.25) 70%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Center logo ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
        style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        <p style={{
          fontFamily: "'Poiret One', sans-serif",
          fontSize: 'clamp(3.2rem, 11vw, 7.5rem)',
          letterSpacing: '-0.02em',
          fontWeight: 300,
          color: '#F9F2D7',
          lineHeight: 1,
          userSelect: 'none',
        }}>
          SOLSTICE
        </p>
        <p style={{
          fontSize: '9px',
          letterSpacing: '0.55em',
          color: 'rgba(230,57,47,0.85)',
          textTransform: 'uppercase',
          fontWeight: 500,
          marginTop: '10px',
          userSelect: 'none',
        }}>
          2026
        </p>
      </motion.div>

      {/* ── Subtle fade gradient at bottom ───────────────────────────────── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, height: '30vh',
        background: 'linear-gradient(to top, rgba(20,4,0,0.7) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
    </motion.div>
  );
}
