import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

// Duration constants — keep in sync with the fade-in delay in SolsticeApp
const SPLASH_DURATION_MS = 2600;

export default function SolsticeSplash({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, SPLASH_DURATION_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.85, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        // Cover the FULL viewport including iOS safe-area notch
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9000,
        background: '#000',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes sol-orbit-x {
          from { transform: translateX(-18vw); }
          to   { transform: translateX(118vw); }
        }
        @keyframes sol-orbit-y {
          0%, 100% { transform: translateY(62vh); }
          50%       { transform: translateY(20vh); }
        }
        @keyframes sol-breathe {
          0%, 100% { transform: scale(1);    opacity: 0.88; }
          50%       { transform: scale(1.14); opacity: 1;    }
        }
        @keyframes sol-corona-spin {
          from { transform: scale(1)    rotate(0deg);   opacity: 0.50; }
          to   { transform: scale(1.18) rotate(360deg); opacity: 0.28; }
        }
      `}</style>

      {/* ── Orbiting sun ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        animation: 'sol-orbit-x 2.7s linear infinite',
        willChange: 'transform',
        pointerEvents: 'none',
      }}>
        <div style={{
          animation: 'sol-orbit-y 2.7s ease-in-out infinite',
          willChange: 'transform',
        }}>
          {/* Outer atmospheric corona */}
          <div style={{
            position: 'absolute',
            inset: '-52px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,140,20,0.35) 0%, rgba(230,57,47,0.12) 50%, transparent 72%)',
            filter: 'blur(28px)',
            animation: 'sol-corona-spin 2.7s linear infinite',
          }} />

          {/* Mid glow */}
          <div style={{
            position: 'absolute',
            inset: '-20px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,180,50,0.50) 0%, rgba(255,100,0,0.20) 55%, transparent 75%)',
            filter: 'blur(10px)',
          }} />

          {/* Sun core */}
          <div style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 36%, #fffbe0 0%, #FFD040 30%, #FF8C00 65%, #E6392F 100%)',
            boxShadow:
              '0 0 32px 12px rgba(255,160,20,0.82), ' +
              '0 0 64px 28px rgba(255,90,0,0.42), ' +
              '0 0 110px 55px rgba(230,57,47,0.18)',
            animation: 'sol-breathe 2.7s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* ── Subtle horizon gradient at bottom — no ellipse, no "U" line ── */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '40vh',
        background: 'linear-gradient(to top, rgba(20,3,0,0.75) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── Center logo — same split style as landing hero ───────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 1.0, ease: 'easeOut' }}
        style={{ textAlign: 'center', position: 'relative', zIndex: 1, userSelect: 'none' }}
      >
        {/* "S ○ LSTICE" — exactly mirroring the landing hero h1 */}
        <h1
          className="uppercase"
          style={{
            fontFamily: "'Poiret One', sans-serif",
            fontSize: 'clamp(3.4rem, 12vw, 8rem)',
            letterSpacing: '-0.02em',
            fontWeight: 300,
            color: '#F9F2D7',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(0.5rem, 2vw, 1.2rem)',
          }}
        >
          S
          <span style={{
            display: 'inline-block',
            width: 'clamp(1.8rem, 4.5vw, 4rem)',
            height: 'clamp(1.8rem, 4.5vw, 4rem)',
            borderRadius: '50%',
            border: '0.5px solid rgba(230,57,47,0.50)',
            flexShrink: 0,
          }} />
          LSTICE
        </h1>

        <p style={{
          fontSize: '8px',
          letterSpacing: '0.55em',
          color: 'rgba(230,57,47,0.80)',
          textTransform: 'uppercase',
          fontWeight: 500,
          marginTop: '12px',
        }}>
          2026
        </p>
      </motion.div>
    </motion.div>
  );
}
