import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandTransition, BrandType } from './BrandTransition';

// ── Star canvas ───────────────────────────────────────────────────────────────
const StarCanvas: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    type Star = { x: number; y: number; r: number; a: number; ts: number; tf: number };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars: Star[] = Array.from({ length: 260 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.75 + 0.1,
      ts: Math.random() * 0.007 + 0.003,
      tf: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * s.ts * 80 + s.tf);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
        ctx.fill();
        s.y -= 0.07;
        if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

// ── Portal ─────────────────────────────────────────────────────────────────────
interface PortalConfig {
  id: BrandType;
  symbol: string;
  name: string;
  microcopy: string;
  accent: string;
  glow: string;
}

interface PortalProps extends PortalConfig {
  onClick: () => void;
  disabled: boolean;
}

const Portal: React.FC<PortalProps> = ({ id, symbol, name, microcopy, accent, glow, onClick, disabled }) => {
  const [hovered, setHovered] = useState(false);

  // Solstice sun-ray burst
  const SolsticeRays = () => (
    <AnimatePresence>
      {hovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                width: 1.5,
                height: 80,
                background: `linear-gradient(to top, transparent 0%, ${accent}90 50%, transparent 100%)`,
                top: '50%',
                left: 'calc(50% - 0.75px)',
                transformOrigin: 'top center',
                rotate: `${i * 30}deg`,
                translateY: '-100%',
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 0.8 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ delay: i * 0.018, duration: 0.32 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );

  // Noctara pulse rings
  const NoctaraRings = () => (
    <AnimatePresence>
      {hovered && (
        <div className="absolute inset-0 pointer-events-none">
          {[0.3, 0.55, 0.8].map((delay, n) => (
            <motion.div
              key={n}
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: accent, borderWidth: 1 }}
              initial={{ scale: 0.85, opacity: 0.9 }}
              animate={{ scale: 1.7 + n * 0.35, opacity: 0 }}
              transition={{ delay, duration: 1.4, repeat: Infinity, repeatDelay: 0.2 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );

  // Midnight Club rotating halo
  const MCHalo = () => (
    <AnimatePresence>
      {hovered && (
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: '-12px',
            border: '1px solid #C0C0C080',
            boxShadow: '0 0 24px #F0EEE430, inset 0 0 16px #C0C0C015',
          }}
          initial={{ opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: 360 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.3 }, rotate: { duration: 8, ease: 'linear', repeat: Infinity } }}
        />
      )}
    </AnimatePresence>
  );

  const glitchVariants = {
    idle: { x: 0, skewX: 0 },
    glitch: {
      x: [0, -3, 3, -2, 1, 0],
      skewX: [0, -4, 4, -2, 1, 0],
      transition: { duration: 0.45, repeat: Infinity, repeatDelay: 2.5 },
    },
  };

  return (
    <motion.button
      className="relative flex flex-col items-center gap-3 cursor-pointer"
      onHoverStart={() => !disabled && setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={!disabled ? onClick : undefined}
      whileTap={!disabled ? { scale: 0.94 } : {}}
    >
      {/* Outer glow ring */}
      <div className="relative">
        <motion.div
          className="relative w-28 h-28 md:w-36 md:h-36 rounded-full flex items-center justify-center"
          style={{
            border: `1px solid`,
            borderColor: hovered ? `${accent}80` : '#ffffff15',
            transition: 'border-color 0.4s ease, box-shadow 0.4s ease',
            boxShadow: hovered ? `0 0 32px ${glow}, 0 0 80px ${glow}50` : 'none',
          }}
          animate={id === 'midnight-club' && hovered ? { rotate: 6 } : { rotate: 0 }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
        >
          {id === 'solstice' && <SolsticeRays />}
          {id === 'noctara' && <NoctaraRings />}
          {id === 'midnight-club' && <MCHalo />}

          {/* Inner fill on hover */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle at center, ${accent}12, transparent 70%)` }}
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          />

          {/* Symbol */}
          <span
            className="relative z-10 text-4xl md:text-5xl select-none leading-none"
            style={{
              filter: hovered ? `drop-shadow(0 0 14px ${accent}) drop-shadow(0 0 28px ${glow}80)` : 'none',
              transition: 'filter 0.35s ease',
            }}
          >
            {symbol}
          </span>
        </motion.div>
      </div>

      {/* Brand name */}
      <motion.span
        className="text-[10px] md:text-[11px] font-black tracking-[0.35em] uppercase"
        style={{ color: hovered ? accent : '#ffffff50', transition: 'color 0.3s ease' }}
        animate={id === 'noctara' && hovered ? 'glitch' : 'idle'}
        variants={glitchVariants}
      >
        {name}
      </motion.span>

      {/* Micro-copy */}
      <AnimatePresence>
        {hovered && (
          <motion.p
            className="text-[9px] md:text-[10px] font-light tracking-wide text-center leading-relaxed max-w-[150px]"
            style={{ color: '#ffffff45' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.25 }}
          >
            {microcopy}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ── Universe Header ────────────────────────────────────────────────────────────
interface UniverseHeaderProps {
  activeBrand: BrandType | null;
  onNavigate: (page: string) => void;
}

const NAV_BRANDS: { id: BrandType; symbol: string; accent: string }[] = [
  { id: 'solstice', symbol: '☀', accent: '#fe3f25' },
  { id: 'midnight-club', symbol: '☽', accent: '#F0EEE4' },
  { id: 'noctara', symbol: '●', accent: '#00E5FF' },
];

export const UniverseHeader: React.FC<UniverseHeaderProps> = ({ activeBrand, onNavigate }) => (
  <div className="fixed top-0 left-0 right-0 z-[85] flex items-center justify-between px-6 md:px-12 h-20 pointer-events-auto">
    {/* Left: Midnight Universe logo */}
    <button
      onClick={() => onNavigate('universe')}
      className="flex flex-col items-start group"
    >
      <span className="text-sm md:text-base font-black tracking-[-0.08em] text-white group-hover:opacity-70 transition-opacity duration-200">
        MIDNIGHT
      </span>
      <span className="text-[6px] md:text-[7px] font-light tracking-[0.65em] text-white/40 uppercase -mt-0.5 ml-px">
        Universe
      </span>
    </button>

    {/* Right: brand symbol nav + back arrow */}
    <div className="flex items-center gap-5 md:gap-7">
      <AnimatePresence>
        {activeBrand && (
          <motion.button
            onClick={() => onNavigate('universe')}
            className="text-white/40 hover:text-white/80 text-[10px] font-light tracking-[0.25em] uppercase transition-colors duration-200"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
          >
            ← Universo
          </motion.button>
        )}
      </AnimatePresence>

      {NAV_BRANDS.map((b) => {
        const isActive = activeBrand === b.id;
        const isDimmed = activeBrand !== null && !isActive;
        return (
          <button
            key={b.id}
            onClick={() => onNavigate(b.id)}
            className="text-xl md:text-2xl transition-all duration-300"
            style={{
              opacity: isDimmed ? 0.2 : 1,
              filter: isActive ? `drop-shadow(0 0 8px ${b.accent}) drop-shadow(0 0 18px ${b.accent}80)` : 'none',
              transform: isActive ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {b.symbol}
          </button>
        );
      })}
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const PORTALS: PortalConfig[] = [
  {
    id: 'solstice',
    symbol: '☀',
    name: 'Solstice',
    microcopy: 'El mar. El atardecer. Una sola vez al año.',
    accent: '#fe3f25',
    glow: 'rgba(254,63,37,0.55)',
  },
  {
    id: 'midnight-club',
    symbol: '☽',
    name: 'Midnight Club',
    microcopy: 'Lista de invitados. Solo para algunos.',
    accent: '#F0EEE4',
    glow: 'rgba(192,192,192,0.5)',
  },
  {
    id: 'noctara',
    symbol: '●',
    name: 'Noctara',
    microcopy: 'No es un evento. Es un umbral.',
    accent: '#00E5FF',
    glow: 'rgba(0,229,255,0.55)',
  },
];

const LETTERS = 'MIDNIGHT'.split('');

interface UniverseLandingProps {
  onNavigate: (page: string) => void;
  currentPage?: string;
}

const UniverseLanding: React.FC<UniverseLandingProps> = ({ onNavigate, currentPage }) => {
  const [pending, setPending] = useState<BrandType | null>(null);

  const activeBrand =
    currentPage && ['solstice', 'noctara', 'midnight-club'].includes(currentPage)
      ? (currentPage as BrandType)
      : null;

  const handlePortalClick = (brand: BrandType) => {
    if (pending) return;
    setPending(brand);
  };

  const handleTransitionComplete = () => {
    if (pending) {
      onNavigate(pending);
      setPending(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      {/* Starfield */}
      <StarCanvas />

      {/* Cosmic nebula gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 75% 45% at 18% 38%, rgba(73,15,124,0.18) 0%, transparent 60%)',
            'radial-gradient(ellipse 55% 40% at 82% 55%, rgba(0,20,90,0.22) 0%, transparent 52%)',
            'radial-gradient(ellipse 90% 60% at 50% 105%, rgba(8,4,24,0.9) 0%, transparent 65%)',
          ].join(', '),
        }}
      />

      {/* Persistent header */}
      <UniverseHeader activeBrand={activeBrand} onNavigate={onNavigate} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 pt-20 pb-16">

        {/* MIDNIGHT — letter-by-letter reveal */}
        <div className="flex items-end justify-center mb-3 overflow-hidden">
          {LETTERS.map((ch, i) => (
            <motion.span
              key={i}
              className="text-[11vw] md:text-[8vw] lg:text-[7rem] font-black leading-none text-white"
              style={{ letterSpacing: '-0.04em' }}
              initial={{ opacity: 0, y: 55, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                delay: 0.25 + i * 0.075,
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {ch}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          className="text-[9px] md:text-[10px] font-light tracking-[0.55em] text-white/35 uppercase mb-16 md:mb-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.15, duration: 0.9 }}
        >
          Elige tu universo
        </motion.p>

        {/* ── Three portals — asymmetric on desktop, stacked on mobile ── */}
        <motion.div
          className="w-full max-w-2xl md:max-w-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          {/* Desktop: triangular/cascade grid */}
          <div className="hidden md:grid grid-cols-3 grid-rows-3 min-h-[420px]">
            {/* SOLSTICE — top-left */}
            <div className="col-start-1 row-start-1 flex items-center justify-start pl-4">
              <Portal
                {...PORTALS[0]}
                onClick={() => handlePortalClick('solstice')}
                disabled={!!pending}
              />
            </div>

            {/* NOCTARA — middle-right */}
            <div className="col-start-3 row-start-2 flex items-center justify-end pr-4">
              <Portal
                {...PORTALS[2]}
                onClick={() => handlePortalClick('noctara')}
                disabled={!!pending}
              />
            </div>

            {/* MIDNIGHT CLUB — bottom-center */}
            <div className="col-start-2 row-start-3 flex items-end justify-center pb-2">
              <Portal
                {...PORTALS[1]}
                onClick={() => handlePortalClick('midnight-club')}
                disabled={!!pending}
              />
            </div>
          </div>

          {/* Mobile: stacked */}
          <div className="flex md:hidden flex-col items-center gap-14">
            <Portal {...PORTALS[0]} onClick={() => handlePortalClick('solstice')} disabled={!!pending} />
            <Portal {...PORTALS[2]} onClick={() => handlePortalClick('noctara')} disabled={!!pending} />
            <Portal {...PORTALS[1]} onClick={() => handlePortalClick('midnight-club')} disabled={!!pending} />
          </div>
        </motion.div>
      </div>

      {/* Brand transition overlay */}
      <AnimatePresence>
        {pending && (
          <BrandTransition
            key={pending}
            brand={pending}
            direction="out"
            onComplete={handleTransitionComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UniverseLanding;
