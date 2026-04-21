import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export type BrandType = 'solstice' | 'noctara' | 'midnight-club';
export type TransitionDirection = 'in' | 'out';

interface Props {
  brand: BrandType;
  direction: TransitionDirection;
  onComplete?: () => void;
}

// ── Solstice ──────────────────────────────────────────────────────────────────
const SolsticeTransition: React.FC<{ direction: TransitionDirection; onComplete?: () => void }> = ({
  direction,
  onComplete,
}) => {
  const duration = direction === 'in' ? 1100 : 800;
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, []);

  if (direction === 'in') {
    return (
      <motion.div
        className="fixed inset-0 z-[200]"
        style={{ background: '#fe3f25' }}
        initial={{ clipPath: 'circle(0% at 50% 50%)' }}
        animate={{ clipPath: 'circle(150% at 50% 50%)', opacity: [1, 1, 0] }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], times: [0, 0.55, 1] }}
      />
    );
  }

  // out: black expands from center (content "contracts" toward center then black)
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-black"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    />
  );
};

// ── Noctara ───────────────────────────────────────────────────────────────────
const NoctaraTransition: React.FC<{ direction: TransitionDirection; onComplete?: () => void }> = ({
  direction,
  onComplete,
}) => {
  const duration = direction === 'in' ? 1400 : 700;
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, []);

  if (direction === 'in') {
    return (
      <div className="fixed inset-0 z-[200] bg-black overflow-hidden">
        {/* Instantaneous cold flash */}
        <motion.div
          className="absolute inset-0"
          style={{ background: '#00E5FF' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
        {/* Fade-in scene (darkness → reveal) */}
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 1.4, times: [0, 0.4, 1] }}
        />
      </div>
    );
  }

  // out: horizontal glitch strips sliding in from alternating sides → black
  const strips = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {strips.map((i) => (
        <motion.div
          key={i}
          className="absolute bg-black w-full"
          style={{
            top: `${(i / strips.length) * 100}%`,
            height: `${100 / strips.length + 0.5}%`,
          }}
          initial={{ x: i % 2 === 0 ? '-100%' : '100%' }}
          animate={{ x: '0%' }}
          transition={{ delay: i * 0.035, duration: 0.28, ease: [0.76, 0, 0.24, 1] }}
        />
      ))}
    </div>
  );
};

// ── Midnight Club ─────────────────────────────────────────────────────────────
const MidnightClubTransition: React.FC<{ direction: TransitionDirection; onComplete?: () => void }> = ({
  direction,
  onComplete,
}) => {
  const duration = direction === 'in' ? 1400 : 600;
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, []);

  const particles = useRef(
    Array.from({ length: 28 }, () => ({
      x: Math.random() * 100,
      delay: Math.random() * 0.7,
      size: Math.random() * 2.5 + 0.8,
      speed: Math.random() * 0.6 + 0.9,
    })),
  ).current;

  if (direction === 'in') {
    return (
      <motion.div
        className="fixed inset-0 z-[200] bg-black overflow-hidden"
        animate={{ opacity: [1, 1, 0] }}
        transition={{ duration: 1.4, times: [0, 0.55, 1] }}
      >
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: '-8px',
              width: p.size,
              height: p.size,
              background: '#C0C0C0',
              boxShadow: '0 0 6px #F0EEE4',
            }}
            animate={{ y: '108vh', opacity: [0, 0.9, 0.9, 0] }}
            transition={{ delay: p.delay, duration: p.speed + 0.5, ease: 'easeIn', times: [0, 0.1, 0.8, 1] }}
          />
        ))}
      </motion.div>
    );
  }

  // out: soft fade to black
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    />
  );
};

// ── Public component ──────────────────────────────────────────────────────────
export const BrandTransition: React.FC<Props> = ({ brand, direction, onComplete }) => {
  if (brand === 'solstice') return <SolsticeTransition direction={direction} onComplete={onComplete} />;
  if (brand === 'noctara') return <NoctaraTransition direction={direction} onComplete={onComplete} />;
  return <MidnightClubTransition direction={direction} onComplete={onComplete} />;
};

export default BrandTransition;
