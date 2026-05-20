import React from 'react';
import { motion } from 'framer-motion';

interface PlanetOrbProps {
  type: 'midnight' | 'solstice';
  isActive: boolean;
  isHovered?: boolean;
}

export default function PlanetOrb({ type, isActive, isHovered = false }: PlanetOrbProps) {
  const isMidnight = type === 'midnight';

  const scaleValue = isActive ? 1.15 : isHovered ? 1.05 : 0.95;
  const opacityValue = isActive ? 1 : isHovered ? 0.9 : 0.65;

  return (
    <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 flex items-center justify-center select-none">
      <motion.div
        className="absolute rounded-full w-[110%] h-[110%] ambient-glow transition-all duration-700 blur-[80px]"
        animate={{
          scale: isActive ? 1.25 : isHovered ? 1.1 : 0.95,
          opacity: opacityValue,
          background: isMidnight
            ? 'radial-gradient(circle, rgba(99, 102, 241, 0.45) 0%, rgba(139, 92, 246, 0.1) 60%, transparent 100%)'
            : 'radial-gradient(circle, rgba(234, 88, 12, 0.45) 0%, rgba(220, 38, 38, 0.1) 60%, transparent 100%)',
        }}
      />

      <motion.svg
        className="absolute w-full h-full overflow-visible pointer-events-none"
        animate={{ rotate: isMidnight ? -360 : 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      >
        <ellipse
          cx="50%"
          cy="50%"
          rx={isMidnight ? '145' : '155'}
          ry={isMidnight ? '55' : '65'}
          fill="none"
          stroke={isMidnight ? 'rgba(129, 140, 248, 0.22)' : 'rgba(249, 115, 22, 0.22)'}
          strokeWidth="0.75"
          strokeDasharray={isMidnight ? '7, 4' : '10, 5'}
          style={{ transform: isMidnight ? 'rotate(-12deg)' : 'rotate(15deg)', transformOrigin: 'center' }}
        />
        <ellipse
          cx="50%"
          cy="50%"
          rx={isMidnight ? '160' : '140'}
          ry={isMidnight ? '45' : '50'}
          fill="none"
          stroke={isMidnight ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
          strokeWidth="0.5"
          strokeDasharray="4, 8"
          style={{ transform: isMidnight ? 'rotate(25deg)' : 'rotate(-20deg)', transformOrigin: 'center' }}
        />
        <motion.circle
          cx="50%"
          cy="50%"
          r="3"
          fill={isMidnight ? '#818cf8' : '#f97316'}
          animate={{
            cx: isMidnight ? [50, 145, 50] : [50, 155, 50],
            cy: isMidnight ? [50, 105, 50] : [50, 115, 50],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="50%"
          cy="50%"
          r="2"
          fill={isMidnight ? '#c084fc' : '#ef4444'}
          animate={{
            cx: isMidnight ? [50, -160, 50] : [50, -140, 50],
            cy: isMidnight ? [50, 95, 50] : [50, 100, 50],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.svg>

      <motion.div
        className="relative flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60 md:w-72 md:h-72 rounded-full cursor-pointer"
        animate={{ scale: scaleValue }}
        transition={{ type: 'spring', stiffness: 110, damping: 22 }}
      >
        {isMidnight ? (
          <div className="relative w-full h-full rounded-full flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full filter blur-md"
              animate={{
                boxShadow: isActive
                  ? '0 0 70px 22px rgba(129, 140, 248, 0.85), inset 0 0 45px rgba(129, 140, 248, 0.3)'
                  : isHovered
                  ? '0 0 55px 14px rgba(129, 140, 248, 0.55)'
                  : '0 0 40px 8px rgba(129, 140, 248, 0.35)',
              }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="absolute -inset-2 rounded-full border border-indigo-400/20 mix-blend-screen"
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative w-[98.8%] h-[98.8%] rounded-full bg-[#050209] z-10 overflow-hidden shadow-[inset_0_-15px_35px_rgba(129,140,248,0.18)] flex items-center justify-center">
              <div className="absolute top-1 left-3 w-full h-full rounded-full bg-gradient-to-br from-indigo-300/10 via-transparent to-transparent pointer-events-none" />
              <motion.div
                className="w-32 h-32 rounded-full border border-indigo-500/5 rotate-45 opacity-30"
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full rounded-full flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full filter blur-md"
              animate={{
                boxShadow: isActive
                  ? '0 0 70px 22px rgba(234, 88, 12, 0.85), inset 0 0 45px rgba(234, 88, 12, 0.3)'
                  : isHovered
                  ? '0 0 55px 14px rgba(234, 88, 12, 0.55)'
                  : '0 0 40px 8px rgba(234, 88, 12, 0.35)',
              }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="absolute -inset-2 rounded-full border border-orange-500/20 mix-blend-screen"
              animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative w-[98.8%] h-[98.8%] rounded-full bg-[#050209] z-10 overflow-hidden shadow-[inset_0_-15px_35px_rgba(234,88,12,0.18)] flex items-center justify-center">
              <div className="absolute top-1 left-3 w-full h-full rounded-full bg-gradient-to-br from-amber-300/10 via-transparent to-transparent pointer-events-none" />
              <motion.div
                className="w-32 h-32 rounded-full border border-orange-500/5 rotate-45 opacity-30"
                animate={{ rotate: -360 }}
                transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
