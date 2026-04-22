import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { BrandTransition, BrandType } from './BrandTransition';

// ── Star canvas ────────────────────────────────────────────────────────────────
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
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars: Star[] = Array.from({ length: 280 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.8 + 0.1,
      ts: Math.random() * 0.007 + 0.003,
      tf: Math.random() * Math.PI * 2,
    }));
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.ts * 80 + s.tf);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`;
        ctx.fill();
        s.y -= 0.06;
        if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};

// ── Sun (Solstice) ─────────────────────────────────────────────────────────────
const SunPlanet: React.FC<{ sz: number; hovered: boolean }> = ({ sz, hovered }) => (
  <div style={{ width: sz, height: sz, position: 'relative', flexShrink: 0 }}>
    {/* Outer corona glow — pulses */}
    <motion.div
      style={{ position: 'absolute', inset: -sz * 0.18, borderRadius: '50%' }}
      animate={{
        boxShadow: hovered
          ? [
              `0 0 ${sz * 0.4}px ${sz * 0.18}px rgba(255,110,20,0.85), 0 0 ${sz * 1.1}px ${sz * 0.48}px rgba(255,70,10,0.42)`,
              `0 0 ${sz * 0.58}px ${sz * 0.26}px rgba(255,140,30,1),   0 0 ${sz * 1.5}px ${sz * 0.65}px rgba(255,90,15,0.55)`,
              `0 0 ${sz * 0.4}px ${sz * 0.18}px rgba(255,110,20,0.85), 0 0 ${sz * 1.1}px ${sz * 0.48}px rgba(255,70,10,0.42)`,
            ]
          : [
              `0 0 ${sz * 0.24}px ${sz * 0.1}px rgba(255,100,20,0.6),  0 0 ${sz * 0.7}px ${sz * 0.28}px rgba(255,65,10,0.28)`,
              `0 0 ${sz * 0.36}px ${sz * 0.16}px rgba(255,120,28,0.78), 0 0 ${sz * 0.95}px ${sz * 0.4}px rgba(255,80,15,0.36)`,
              `0 0 ${sz * 0.24}px ${sz * 0.1}px rgba(255,100,20,0.6),  0 0 ${sz * 0.7}px ${sz * 0.28}px rgba(255,65,10,0.28)`,
            ],
      }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    />

    {/* Main sphere */}
    <div
      style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
        background: `radial-gradient(circle at 32% 27%,
          #fff9e0 0%, #ffe566 7%, #ffab40 26%,
          #ff6d00 50%, #e64a19 70%, #bf360c 84%, #4e0000 100%)`,
      }}
    >
      {/* Light source highlight */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 28% 20%, rgba(255,255,220,0.26) 0%, transparent 46%)',
      }} />
      {/* Animated surface hotspot */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 64% 58%, rgba(255,145,20,0.32) 0%, transparent 44%)',
        }}
        animate={{ opacity: [0.35, 0.85, 0.35], x: [0, sz * 0.04, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Second hotspot */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 70%, rgba(255,60,0,0.2) 0%, transparent 38%)',
        }}
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />
    </div>

    {/* Solar flares — thin rays that pulse outward */}
    {Array.from({ length: 8 }, (_, i) => (
      <motion.div
        key={i}
        style={{
          position: 'absolute',
          width: 2,
          height: sz * 0.32,
          background: `linear-gradient(to top, rgba(255,120,20,0.7), transparent)`,
          left: '50%', top: '50%',
          transformOrigin: 'bottom center',
          marginLeft: -1,
          transform: `rotate(${i * 45}deg) translateY(-${sz * 0.5}px)`,
        }}
        animate={{ scaleY: [0.5, 1, 0.5], opacity: [0.25, 0.6, 0.25] }}
        transition={{ delay: i * 0.18, duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

// ── Full Moon (Noctara) ────────────────────────────────────────────────────────
const CRATERS = [
  { cx: 37, cy: 33, r: 6.5 }, { cx: 57, cy: 51, r: 11 },
  { cx: 27, cy: 62, r: 5.5 }, { cx: 68, cy: 36, r: 7.5 },
  { cx: 47, cy: 73, r: 8.5 }, { cx: 74, cy: 63, r: 5.5 },
  { cx: 20, cy: 45, r: 4.5 }, { cx: 62, cy: 20, r: 5 },
  { cx: 50, cy: 38, r: 4 },
];

const FullMoonPlanet: React.FC<{ sz: number; hovered: boolean }> = ({ sz, hovered }) => (
  <div style={{ width: sz, height: sz, position: 'relative', flexShrink: 0 }}>
    <motion.div
      style={{
        position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden',
        background: `radial-gradient(circle at 35% 30%,
          #f0f0f0 0%, #d5d5d5 18%, #b5b5b5 42%,
          #888 68%, #555 84%, #333 100%)`,
      }}
      animate={{
        boxShadow: hovered
          ? [
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.32}px ${sz*0.13}px rgba(0,229,255,0.45)`,
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.5}px  ${sz*0.2}px  rgba(0,229,255,0.62)`,
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.32}px ${sz*0.13}px rgba(0,229,255,0.45)`,
            ]
          : [
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.16}px ${sz*0.06}px rgba(0,229,255,0.18)`,
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.28}px ${sz*0.1}px  rgba(0,229,255,0.3)`,
              `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.22}px rgba(0,0,0,0.42), 0 0 ${sz*0.16}px ${sz*0.06}px rgba(0,229,255,0.18)`,
            ],
      }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Craters */}
      {CRATERS.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${c.r * 2}%`, height: `${c.r * 2}%`,
          left: `${c.cx - c.r}%`, top: `${c.cy - c.r}%`,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 32%, rgba(155,155,155,0.22) 0%, rgba(75,75,75,0.5) 55%, rgba(45,45,45,0.65) 100%)',
          boxShadow: 'inset 1.5px 1.5px 4px rgba(255,255,255,0.09), inset -1px -1px 3px rgba(0,0,0,0.52)',
        }} />
      ))}
      {/* Surface sheen */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 27% 22%, rgba(255,255,255,0.08) 0%, transparent 44%)',
      }} />
    </motion.div>
  </div>
);

// ── Crescent Moon (Midnight Club) ──────────────────────────────────────────────
const CrescentMoonPlanet: React.FC<{ sz: number; hovered: boolean }> = ({ sz, hovered }) => (
  <div style={{ width: sz, height: sz, position: 'relative', flexShrink: 0 }}>
    <motion.div
      style={{ position: 'absolute', inset: 0 }}
      animate={{
        filter: hovered
          ? [
              'drop-shadow(0 0 12px rgba(240,238,228,0.6)) drop-shadow(0 0 32px rgba(192,192,192,0.3))',
              'drop-shadow(0 0 22px rgba(240,238,228,0.9)) drop-shadow(0 0 60px rgba(192,192,192,0.48))',
              'drop-shadow(0 0 12px rgba(240,238,228,0.6)) drop-shadow(0 0 32px rgba(192,192,192,0.3))',
            ]
          : [
              'drop-shadow(0 0 5px rgba(240,238,228,0.25)) drop-shadow(0 0 14px rgba(192,192,192,0.1))',
              'drop-shadow(0 0 9px rgba(240,238,228,0.4))  drop-shadow(0 0 24px rgba(192,192,192,0.18))',
              'drop-shadow(0 0 5px rgba(240,238,228,0.25)) drop-shadow(0 0 14px rgba(192,192,192,0.1))',
            ],
      }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Moon surface */}
      <div style={{
        position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%,
          #f5f3e8 0%, #dbd8c8 18%, #b0ae9e 42%,
          #7c7a6e 68%, #4e4c44 84%, #252420 100%)`,
        boxShadow: `inset -${sz*0.1}px -${sz*0.07}px ${sz*0.2}px rgba(0,0,0,0.55)`,
      }} />
      {/* Shadow circle shifted right — creates the crescent */}
      <div style={{
        position: 'absolute', width: '100%', height: '100%', borderRadius: '50%',
        background: '#000',
        transform: `translateX(${Math.round(sz * 0.29)}px)`,
      }} />
    </motion.div>
  </div>
);

// ── Planet Card ────────────────────────────────────────────────────────────────
const PLANET_META: Record<BrandType, { name: string; microcopy: string; accent: string }> = {
  solstice:       { name: 'Solstice',      microcopy: 'El mar. El atardecer. Una sola vez al año.', accent: '#fe3f25' },
  noctara:        { name: 'Noctara',       microcopy: 'No es un evento. Es un umbral.',              accent: '#00E5FF' },
  'midnight-club':{ name: 'Midnight Club', microcopy: 'Lista de invitados. Solo para algunos.',      accent: '#F0EEE4' },
};

interface PlanetCardProps {
  brand: BrandType;
  sz: number;
  floatDelay?: number;
  onClick: () => void;
  disabled: boolean;
}

const PlanetCard: React.FC<PlanetCardProps> = ({ brand, sz, floatDelay = 0, onClick, disabled }) => {
  const [hovered, setHovered] = useState(false);
  const { name, microcopy, accent } = PLANET_META[brand];

  const planet =
    brand === 'solstice'      ? <SunPlanet sz={sz} hovered={hovered} /> :
    brand === 'noctara'       ? <FullMoonPlanet sz={sz} hovered={hovered} /> :
                                <CrescentMoonPlanet sz={sz} hovered={hovered} />;

  return (
    <motion.div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      animate={{ y: [0, -10, 0] }}
      transition={{ y: { duration: 5.5 + floatDelay, repeat: Infinity, ease: 'easeInOut', delay: floatDelay * 0.5 } }}
    >
      <motion.div
        style={{ position: 'relative', cursor: disabled ? 'default' : 'pointer' }}
        onHoverStart={() => !disabled && setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={!disabled ? onClick : undefined}
        whileHover={{ scale: 1.07 }}
        whileTap={!disabled ? { scale: 0.91 } : {}}
      >
        {/* Orbit ring on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              style={{
                position: 'absolute', inset: -16, borderRadius: '50%', pointerEvents: 'none',
                border: `1px solid ${accent}40`,
                boxShadow: `0 0 14px ${accent}20`,
              }}
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.28 }}
            />
          )}
        </AnimatePresence>
        {planet}
      </motion.div>

      {/* Brand name */}
      <p style={{
        marginTop: 14, fontSize: 10, fontWeight: 900,
        letterSpacing: '0.3em', textTransform: 'uppercase',
        color: hovered ? accent : `${accent}60`,
        transition: 'color 0.3s ease', userSelect: 'none',
      }}>
        {name}
      </p>

      {/* Micro-copy */}
      <AnimatePresence>
        {hovered && (
          <motion.p
            style={{
              marginTop: 5, fontSize: 9, fontWeight: 300, letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.38)', textAlign: 'center',
              maxWidth: 148, lineHeight: 1.55, userSelect: 'none',
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {microcopy}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Universe Header ────────────────────────────────────────────────────────────
const NAV_BRANDS: { id: BrandType; symbol: string; accent: string }[] = [
  { id: 'solstice',       symbol: '☀', accent: '#fe3f25' },
  { id: 'midnight-club',  symbol: '☽', accent: '#F0EEE4' },
  { id: 'noctara',        symbol: '●', accent: '#00E5FF' },
];

export const UniverseHeader: React.FC<{ activeBrand: BrandType | null; onNavigate: (p: string) => void }> = ({
  activeBrand, onNavigate,
}) => (
  <div className="fixed top-0 left-0 right-0 z-[85] flex items-center justify-between px-6 md:px-12 h-20 pointer-events-auto">
    <button onClick={() => onNavigate('universe')} className="flex flex-col items-start group">
      <span className="text-sm md:text-base font-black tracking-[-0.08em] text-white group-hover:opacity-70 transition-opacity">
        MIDNIGHT
      </span>
      <span className="text-[6px] md:text-[7px] font-light tracking-[0.65em] text-white/40 uppercase -mt-0.5 ml-px">
        Universe
      </span>
    </button>

    <div className="flex items-center gap-5 md:gap-7">
      <AnimatePresence>
        {activeBrand && (
          <motion.button
            onClick={() => onNavigate('universe')}
            className="text-white/40 hover:text-white/80 text-[10px] font-light tracking-[0.25em] uppercase transition-colors"
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
          >
            ← Universo
          </motion.button>
        )}
      </AnimatePresence>
      {NAV_BRANDS.map((b) => (
        <button
          key={b.id}
          onClick={() => onNavigate(b.id)}
          className="text-xl md:text-2xl transition-all duration-300"
          style={{
            opacity: activeBrand !== null && activeBrand !== b.id ? 0.2 : 1,
            filter: activeBrand === b.id
              ? `drop-shadow(0 0 8px ${b.accent}) drop-shadow(0 0 18px ${b.accent}80)`
              : 'none',
            transform: activeBrand === b.id ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          {b.symbol}
        </button>
      ))}
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const LETTERS = 'MIDNIGHT'.split('');

interface Props { onNavigate: (page: string) => void; currentPage?: string; }

const UniverseLanding: React.FC<Props> = ({ onNavigate, currentPage }) => {
  const [pending, setPending] = useState<BrandType | null>(null);

  // Responsive planet sizes computed once at mount
  const sizes = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390;
    const desk = w >= 768;
    return { sun: desk ? 200 : 155, moon: desk ? 176 : 138, crescent: desk ? 156 : 120 };
  }, []);

  const activeBrand =
    currentPage && ['solstice', 'noctara', 'midnight-club'].includes(currentPage)
      ? (currentPage as BrandType) : null;

  const handleClick = (brand: BrandType) => { if (!pending) setPending(brand); };

  const handleTransitionComplete = () => {
    if (pending) { onNavigate(pending); setPending(null); }
  };

  return (
    <MotionConfig reducedMotion="never">
      <div className="relative bg-black overflow-hidden" style={{ minHeight: '100vh' }}>
        <StarCanvas />

        {/* Nebula gradients */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            'radial-gradient(ellipse 85% 55% at 16% 30%, rgba(80,20,140,0.22) 0%, transparent 55%)',
            'radial-gradient(ellipse 65% 42% at 84% 52%, rgba(0,30,100,0.22) 0%, transparent 52%)',
            'radial-gradient(ellipse 100% 65% at 50% 102%, rgba(8,4,24,0.92) 0%, transparent 58%)',
          ].join(', '),
        }} />

        <UniverseHeader activeBrand={activeBrand} onNavigate={onNavigate} />

        {/* Page content */}
        <div className="relative z-10 flex flex-col items-center" style={{ minHeight: '100vh', paddingTop: 88 }}>

          {/* MIDNIGHT — letter reveal */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {LETTERS.map((ch, i) => (
              <motion.span
                key={i}
                style={{
                  fontSize: 'clamp(26px, 8.5vw, 78px)',
                  fontWeight: 900, lineHeight: 1,
                  color: 'white', letterSpacing: '-0.04em', display: 'block',
                }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              >
                {ch}
              </motion.span>
            ))}
          </div>

          <motion.p
            style={{
              fontSize: 9, letterSpacing: '0.52em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.27)', fontWeight: 300, marginBottom: 16,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.58 }}
          >
            Elige tu universo
          </motion.p>

          {/* ── Planet scene — asymmetric space layout ── */}
          <motion.div
            style={{ position: 'relative', width: '100%', flex: 1, minHeight: 520 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            {/* ☀ SOLSTICE — upper left */}
            <div style={{ position: 'absolute', top: '4%', left: '4%' }}>
              <PlanetCard brand="solstice" sz={sizes.sun} floatDelay={0}
                onClick={() => handleClick('solstice')} disabled={!!pending} />
            </div>

            {/* ● NOCTARA — center right */}
            <div style={{ position: 'absolute', top: '40%', right: '4%' }}>
              <PlanetCard brand="noctara" sz={sizes.moon} floatDelay={1.8}
                onClick={() => handleClick('noctara')} disabled={!!pending} />
            </div>

            {/* ☽ MIDNIGHT CLUB — lower center */}
            <div style={{ position: 'absolute', bottom: '4%', left: '50%', transform: 'translateX(-50%)' }}>
              <PlanetCard brand="midnight-club" sz={sizes.crescent} floatDelay={0.9}
                onClick={() => handleClick('midnight-club')} disabled={!!pending} />
            </div>
          </motion.div>
        </div>

        {/* Brand transition overlay */}
        <AnimatePresence>
          {pending && (
            <BrandTransition key={pending} brand={pending} direction="out"
              onComplete={handleTransitionComplete} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};

export default UniverseLanding;
