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
    let raf = 0, t = 0;
    type S = { x: number; y: number; r: number; a: number; ts: number; tf: number };
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars: S[] = Array.from({ length: 300 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.3 + 0.15, a: Math.random() * 0.8 + 0.1,
      ts: Math.random() * 0.007 + 0.003, tf: Math.random() * Math.PI * 2,
    }));
    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * s.ts * 80 + s.tf);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a * tw})`; ctx.fill();
        s.y -= 0.055;
        if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
};

// ── NOCTARA — Neptune / cold ice planet ───────────────────────────────────────
const NoctaraPlanet: React.FC<{ sz: number }> = ({ sz }) => {
  const r = sz / 2;
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="noc-base" cx="36%" cy="27%" r="72%">
          <stop offset="0%"   stopColor="#d0eeff" />
          <stop offset="12%"  stopColor="#60c0f0" />
          <stop offset="34%"  stopColor="#1a65c8" />
          <stop offset="58%"  stopColor="#0a2f80" />
          <stop offset="80%"  stopColor="#051545" />
          <stop offset="100%" stopColor="#010820" />
        </radialGradient>
        <radialGradient id="noc-atm" cx="50%" cy="50%" r="50%">
          <stop offset="74%" stopColor="transparent" />
          <stop offset="88%" stopColor="rgba(20,140,240,0.22)" />
          <stop offset="100%" stopColor="rgba(0,70,200,0.45)" />
        </radialGradient>
        <clipPath id="noc-clip"><circle cx={r} cy={r} r={r} /></clipPath>
      </defs>
      <g clipPath="url(#noc-clip)">
        <circle cx={r} cy={r} r={r} fill="url(#noc-base)" />
        {/* Cloud bands */}
        <ellipse cx={r} cy={r*0.25} rx={r}    ry={r*0.13} fill="#7ad0f8" opacity="0.3"  />
        <ellipse cx={r} cy={r*0.5}  rx={r}    ry={r*0.09} fill="#9ae0ff" opacity="0.18" />
        <ellipse cx={r} cy={r*0.72} rx={r}    ry={r*0.1}  fill="#48a0e0" opacity="0.26" />
        <ellipse cx={r} cy={r*1.3}  rx={r}    ry={r*0.2}  fill="#2268b0" opacity="0.32" />
        {/* Storm vortex */}
        <ellipse cx={r*1.22} cy={r*0.36} rx={r*0.2} ry={r*0.11} fill="#b8ecff" opacity="0.52" />
        <ellipse cx={r*1.22} cy={r*0.36} rx={r*0.1} ry={r*0.055} fill="white" opacity="0.38" />
        {/* Polar region */}
        <ellipse cx={r} cy={r*0.04} rx={r*0.58} ry={r*0.22} fill="#e4f8ff" opacity="0.16" />
        {/* Specular highlight */}
        <ellipse cx={r*0.38} cy={r*0.3} rx={r*0.26} ry={r*0.18} fill="white" opacity="0.12" />
        {/* Atmosphere rim */}
        <circle cx={r} cy={r} r={r} fill="url(#noc-atm)" />
      </g>
    </svg>
  );
};

// ── MIDNIGHT CLUB — Crescent moon ─────────────────────────────────────────────
const MidnightClubPlanet: React.FC<{ sz: number }> = ({ sz }) => {
  const r = sz / 2;
  // Shadow circle shifted left → leaves right crescent illuminated
  const shadowCx = r * 0.3;
  const shadowR  = r * 0.88;
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="mc-base" cx="76%" cy="28%" r="78%">
          <stop offset="0%"   stopColor="#e8e4d8" />
          <stop offset="18%"  stopColor="#b8b4a4" />
          <stop offset="44%"  stopColor="#787468" />
          <stop offset="70%"  stopColor="#3c3a36" />
          <stop offset="88%"  stopColor="#181614" />
          <stop offset="100%" stopColor="#060504" />
        </radialGradient>
        {/* Earthshine: faint glow on the shadow side */}
        <radialGradient id="mc-earth" cx="25%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(60,90,140,0.12)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Mask: moon circle minus shadow circle = crescent */}
        <mask id="mc-mask">
          <circle cx={r} cy={r} r={r} fill="white" />
          <circle cx={shadowCx} cy={r} r={shadowR} fill="black" />
        </mask>
        <clipPath id="mc-full"><circle cx={r} cy={r} r={r} /></clipPath>
      </defs>

      {/* Full shadowed sphere (very dark — visible as "earthshine") */}
      <g clipPath="url(#mc-full)">
        <circle cx={r} cy={r} r={r} fill="#0c0b0a" />
        <circle cx={r} cy={r} r={r} fill="url(#mc-earth)" />
      </g>

      {/* Lit crescent, masked to only the right sliver */}
      <g mask="url(#mc-mask)">
        <circle cx={r} cy={r} r={r} fill="url(#mc-base)" />
        {/* Surface craters — visible on lit area */}
        <circle cx={r*1.55} cy={r*0.45} r={r*0.1}  fill="rgba(25,23,20,0.6)"  />
        <circle cx={r*1.72} cy={r*0.75} r={r*0.07}  fill="rgba(20,18,15,0.52)" />
        <circle cx={r*1.45} cy={r*1.15} r={r*0.09}  fill="rgba(28,25,22,0.55)" />
        <circle cx={r*1.82} cy={r*0.38} r={r*0.055} fill="rgba(18,16,14,0.48)" />
        <circle cx={r*1.78} cy={r*1.05} r={r*0.065} fill="rgba(22,20,17,0.5)"  />
        {/* Highlight on lit edge */}
        <ellipse cx={r*1.9} cy={r} rx={r*0.06} ry={r*0.8} fill="rgba(255,252,242,0.12)" />
      </g>

      {/* Pearl glow edge on the terminator */}
      <circle cx={r} cy={r} r={r-0.5} fill="none"
        stroke="rgba(235,232,218,0.15)" strokeWidth="1.5" />
    </svg>
  );
};

// ── SOLSTICE — Jupiter-like warm gas giant ────────────────────────────────────
const SolsticePlanet: React.FC<{ sz: number }> = ({ sz }) => {
  const r = sz / 2;
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id="sol-base" cx="33%" cy="26%" r="74%">
          <stop offset="0%"   stopColor="#fff8e0" />
          <stop offset="10%"  stopColor="#f8c858" />
          <stop offset="28%"  stopColor="#e09028" />
          <stop offset="50%"  stopColor="#b05510" />
          <stop offset="72%"  stopColor="#702208" />
          <stop offset="90%"  stopColor="#3a0e02" />
          <stop offset="100%" stopColor="#140400" />
        </radialGradient>
        <radialGradient id="sol-atm" cx="50%" cy="50%" r="50%">
          <stop offset="74%" stopColor="transparent" />
          <stop offset="88%" stopColor="rgba(190,75,15,0.24)" />
          <stop offset="100%" stopColor="rgba(130,40,5,0.48)" />
        </radialGradient>
        <clipPath id="sol-clip"><circle cx={r} cy={r} r={r} /></clipPath>
      </defs>
      <g clipPath="url(#sol-clip)">
        <circle cx={r} cy={r} r={r} fill="url(#sol-base)" />
        {/* Cloud bands — Jupiter-like horizontal stripes */}
        <rect x="0" y={r*0.10} width={sz} height={r*0.17} fill="#e8b845" opacity="0.44" />
        <rect x="0" y={r*0.33} width={sz} height={r*0.08} fill="#f5e090" opacity="0.28" />
        <rect x="0" y={r*0.46} width={sz} height={r*0.24} fill="#c86020" opacity="0.5"  />
        <rect x="0" y={r*0.76} width={sz} height={r*0.13} fill="#d89038" opacity="0.36" />
        <rect x="0" y={r*0.97} width={sz} height={r*0.13} fill="#e4b865" opacity="0.26" />
        <rect x="0" y={r*1.18} width={sz} height={r*0.1}  fill="#b86018" opacity="0.3"  />
        {/* Band edge highlights */}
        <rect x="0" y={r*0.27} width={sz} height={r*0.022} fill="#f0df98" opacity="0.32" />
        <rect x="0" y={r*0.44} width={sz} height={r*0.018} fill="#d0a048" opacity="0.38" />
        <rect x="0" y={r*0.70} width={sz} height={r*0.018} fill="#e8c070" opacity="0.28" />
        {/* Great Red Spot */}
        <ellipse cx={r*1.38} cy={r*0.60} rx={r*0.26} ry={r*0.15} fill="#c03018" opacity="0.82" />
        <ellipse cx={r*1.38} cy={r*0.60} rx={r*0.17} ry={r*0.09} fill="#d84030" opacity="0.68" />
        <ellipse cx={r*1.38} cy={r*0.60} rx={r*0.08} ry={r*0.04} fill="#e85848" opacity="0.55" />
        {/* White cloud patch */}
        <ellipse cx={r*0.52} cy={r*0.36} rx={r*0.16} ry={r*0.07} fill="rgba(255,252,230,0.5)" />
        {/* Specular highlight */}
        <ellipse cx={r*0.36} cy={r*0.27} rx={r*0.24} ry={r*0.17} fill="white" opacity="0.14" />
        {/* Atmosphere rim */}
        <circle cx={r} cy={r} r={r} fill="url(#sol-atm)" />
      </g>
    </svg>
  );
};

// ── Planet slot wrapper ────────────────────────────────────────────────────────
const PLANET_META: Record<BrandType, { name: string; microcopy: string; accent: string; glow: string }> = {
  noctara:        { name: 'Noctara',       microcopy: 'No es un evento. Es un umbral.',              accent: '#00E5FF', glow: 'rgba(0,180,255,0.65)'   },
  'midnight-club':{ name: 'Midnight Club', microcopy: 'Lista de invitados. Solo para algunos.',      accent: '#F0EEE4', glow: 'rgba(210,205,185,0.52)'  },
  solstice:       { name: 'Solstice',      microcopy: 'El mar. El atardecer. Una sola vez al año.',  accent: '#fe3f25', glow: 'rgba(255,100,18,0.68)'   },
};

interface SlotProps { brand: BrandType; sz: number; floatDelay?: number; onClick: () => void; disabled: boolean; }

const PlanetSlot: React.FC<SlotProps> = ({ brand, sz, floatDelay = 0, onClick, disabled }) => {
  const [hovered, setHovered] = useState(false);
  const { name, microcopy, accent, glow } = PLANET_META[brand];

  const glowFaint  = glow.replace(/[\d.]+\)$/, '0.22)');
  const glowBright = glow.replace(/[\d.]+\)$/, '0.72)');

  const planet =
    brand === 'noctara'        ? <NoctaraPlanet sz={sz} /> :
    brand === 'midnight-club'  ? <MidnightClubPlanet sz={sz} /> :
                                 <SolsticePlanet sz={sz} />;

  return (
    <motion.div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: sz + 48 }}
      animate={{ y: [0, -9, 0] }}
      transition={{ y: { duration: 5.5 + floatDelay, repeat: Infinity, ease: 'easeInOut', delay: floatDelay * 0.55 } }}
    >
      <motion.div
        style={{ position: 'relative', cursor: disabled ? 'default' : 'pointer', borderRadius: '50%' }}
        onHoverStart={() => !disabled && setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        onClick={!disabled ? onClick : undefined}
        whileHover={{ scale: 1.07 }}
        whileTap={!disabled ? { scale: 0.91 } : {}}
        animate={{
          filter: hovered
            ? `drop-shadow(0 0 ${sz * 0.11}px ${glowBright}) drop-shadow(0 0 ${sz * 0.28}px ${glow})`
            : `drop-shadow(0 0 ${sz * 0.055}px ${glowFaint})`,
        }}
        transition={{ duration: 0.38 }}
      >
        {/* Orbit ring */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              style={{
                position: 'absolute', inset: -16, borderRadius: '50%', pointerEvents: 'none',
                border: `1px solid ${accent}35`, boxShadow: `0 0 18px ${accent}15`,
              }}
              initial={{ opacity: 0, scale: 0.78 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.78 }}
              transition={{ duration: 0.25 }}
            />
          )}
        </AnimatePresence>
        {planet}
      </motion.div>

      {/* Brand name */}
      <p style={{
        marginTop: 13, fontSize: 9, fontWeight: 900, letterSpacing: '0.3em',
        textTransform: 'uppercase', color: hovered ? accent : `${accent}50`,
        transition: 'color 0.3s ease', userSelect: 'none', textAlign: 'center',
      }}>
        {name}
      </p>

      {/* Micro-copy on hover */}
      <AnimatePresence>
        {hovered && (
          <motion.p
            style={{
              marginTop: 4, fontSize: 8, fontWeight: 300, letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.35)', textAlign: 'center',
              maxWidth: sz + 8, lineHeight: 1.55, userSelect: 'none',
            }}
            initial={{ opacity: 0, y: 5 }}
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
  { id: 'solstice',      symbol: '☀', accent: '#fe3f25' },
  { id: 'midnight-club', symbol: '☽', accent: '#F0EEE4' },
  { id: 'noctara',       symbol: '●', accent: '#00E5FF' },
];

export const UniverseHeader: React.FC<{ activeBrand: BrandType | null; onNavigate: (p: string) => void }> = ({
  activeBrand, onNavigate,
}) => (
  <div className="fixed top-0 left-0 right-0 z-[85] flex items-center justify-between px-6 md:px-12 h-20 pointer-events-auto">
    <button onClick={() => onNavigate('universe')} className="flex flex-col items-start group">
      <span className="text-sm md:text-base font-black tracking-[-0.08em] text-white group-hover:opacity-70 transition-opacity">MIDNIGHT</span>
      <span className="text-[6px] md:text-[7px] font-light tracking-[0.65em] text-white/40 uppercase -mt-0.5 ml-px">Universe</span>
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
      {NAV_BRANDS.map(b => (
        <button key={b.id} onClick={() => onNavigate(b.id)} className="text-xl md:text-2xl transition-all duration-300"
          style={{
            opacity: activeBrand !== null && activeBrand !== b.id ? 0.2 : 1,
            filter: activeBrand === b.id ? `drop-shadow(0 0 8px ${b.accent}) drop-shadow(0 0 18px ${b.accent}80)` : 'none',
            transform: activeBrand === b.id ? 'scale(1.15)' : 'scale(1)',
          }}>
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

  // Planet size: fills the row evenly, capped for large screens
  const sz = useMemo(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390;
    if (w >= 768) return Math.min(Math.floor((Math.min(w, 900) - 120) / 3), 200);
    return Math.max(Math.floor((w - 56) / 3), 88);
  }, []);

  const activeBrand =
    currentPage && ['solstice', 'noctara', 'midnight-club'].includes(currentPage)
      ? (currentPage as BrandType) : null;

  const handleClick = (brand: BrandType) => { if (!pending) setPending(brand); };
  const handleDone  = () => { if (pending) { onNavigate(pending); setPending(null); } };

  return (
    <MotionConfig reducedMotion="never">
      <div className="relative bg-black" style={{ minHeight: '100vh' }}>
        <StarCanvas />

        {/* Deep-space nebula overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            'radial-gradient(ellipse 90% 55% at 15% 28%, rgba(70,18,130,0.22) 0%, transparent 55%)',
            'radial-gradient(ellipse 70% 45% at 85% 50%, rgba(0,28,95,0.22) 0%, transparent 52%)',
            'radial-gradient(ellipse 100% 60% at 50% 105%, rgba(6,3,20,0.95) 0%, transparent 58%)',
          ].join(', '),
        }} />

        <UniverseHeader activeBrand={activeBrand} onNavigate={onNavigate} />

        {/* Page layout */}
        <div className="relative z-10" style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 88, paddingBottom: 28,
        }}>

          {/* MIDNIGHT — letter reveal */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            {LETTERS.map((ch, i) => (
              <motion.span key={i}
                style={{ fontSize: 'clamp(22px, 7.5vw, 68px)', fontWeight: 900, lineHeight: 1, color: 'white', letterSpacing: '-0.04em', display: 'block' }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              >{ch}</motion.span>
            ))}
          </div>

          <motion.p
            style={{ fontSize: 9, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.26)', fontWeight: 300, marginBottom: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          >
            Elige tu universo
          </motion.p>

          {/* ── Three planets — same height, horizontal row ── */}
          <motion.div
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', maxWidth: 720, padding: '0 12px', gap: 8,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.62, duration: 0.65 }}
          >
            {/* LEFT — NOCTARA */}
            <PlanetSlot brand="noctara"       sz={sz} floatDelay={1.8} onClick={() => handleClick('noctara')}       disabled={!!pending} />
            {/* CENTER — MIDNIGHT CLUB */}
            <PlanetSlot brand="midnight-club" sz={sz} floatDelay={0.9} onClick={() => handleClick('midnight-club')} disabled={!!pending} />
            {/* RIGHT — SOLSTICE */}
            <PlanetSlot brand="solstice"      sz={sz} floatDelay={0}   onClick={() => handleClick('solstice')}      disabled={!!pending} />
          </motion.div>
        </div>

        <AnimatePresence>
          {pending && (
            <BrandTransition key={pending} brand={pending} direction="out" onComplete={handleDone} />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};

export default UniverseLanding;
