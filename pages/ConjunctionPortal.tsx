import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Music, GlassWater, Users, Heart } from 'lucide-react';
import { useMouseParallax, usePrefersReducedMotion } from '../lib/useMouseParallax';
import { useLowEnd } from '../lib/perfMode';

export type BrandSelection = 'midnight' | 'solstice' | null;

interface ConjunctionPortalProps {
  onEnterBrand: (brand: 'midnight' | 'solstice') => void;
}

// ═════════════════════════════════════════════════════════════════════════════
// POST-FX LAYER — film grain animado + vignette + scan lines sutiles
// ═════════════════════════════════════════════════════════════════════════════
const PostFXLayer: React.FC<{ lite: boolean }> = ({ lite }) => (
  <>
    {!lite && (
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[97]"
        style={{
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
          animation: 'film-grain 1.2s steps(6) infinite',
        }}
      />
    )}
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-[98]"
      style={{
        background:
          'radial-gradient(ellipse 90% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.55) 90%, rgba(0,0,0,0.85) 100%)',
      }}
    />
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-[99]"
      style={{
        background:
          'linear-gradient(90deg, rgba(73,15,124,0.05) 0%, transparent 8%, transparent 92%, rgba(230,57,47,0.05) 100%)',
        mixBlendMode: 'screen',
      }}
    />
    {!lite && (
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none z-[96]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.012) 3px, transparent 4px)',
          mixBlendMode: 'overlay',
        }}
      />
    )}
  </>
);

// ═════════════════════════════════════════════════════════════════════════════
// STARFIELD — estrellas estáticas, twinkle lento, sin parallax
// ═════════════════════════════════════════════════════════════════════════════
const Starfield: React.FC<{ lite: boolean }> = ({ lite }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const STAR_COUNT = lite ? 120 : 220;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.35 + Math.random() * 1.0,
      base: 0.30 + Math.random() * 0.55,
      speed: 0.08 + Math.random() * 0.32,
      phase: Math.random() * Math.PI * 2,
      bright: Math.random() < 0.02,
      tint: Math.random() < 0.85 ? '#E8DCC0' : Math.random() < 0.5 ? '#C9A961' : '#9F8FB8',
    }));
    let raf: number;
    const start = performance.now();
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const t = (performance.now() - start) / 1000;
      for (const s of stars) {
        const op = Math.max(0.12, s.base + Math.sin(t * s.speed + s.phase) * 0.12);
        ctx.globalAlpha = op;
        ctx.fillStyle = s.tint;
        if (s.bright) {
          ctx.shadowColor = s.tint;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = s.tint;
          ctx.lineWidth = 0.5;
          const len = s.r * 5;
          ctx.beginPath();
          ctx.moveTo(s.x - len, s.y); ctx.lineTo(s.x + len, s.y);
          ctx.moveTo(s.x, s.y - len); ctx.lineTo(s.x, s.y + len);
          ctx.stroke();
        } else {
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [lite]);
  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 pointer-events-none z-[1]" />;
};

// ═════════════════════════════════════════════════════════════════════════════
// SHOOTING STARS — 2 streaks ocasionales
// ═════════════════════════════════════════════════════════════════════════════
const ShootingStars: React.FC = () => {
  const stars = useMemo(() => [
    { topPct: 18, leftPct: 8,  angle: 20,  delay: 15, duration: 7, length: 110 },
    { topPct: 32, leftPct: 75, angle: 160, delay: 38, duration: 6, length: 90  },
  ], []);
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${s.topPct}%`,
            left: `${s.leftPct}%`,
            transform: `rotate(${s.angle}deg)`,
            transformOrigin: '0 0',
          }}
        >
          <div
            style={{
              width: s.length, height: 1,
              background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,244,214,0.95) 50%, rgba(255,255,255,0) 100%)',
              opacity: 0,
              animation: `shoot ${s.duration}s ease-out ${s.delay}s infinite`,
              filter: 'drop-shadow(0 0 4px rgba(255,244,214,0.9))',
              willChange: 'transform, opacity',
            }}
          />
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// VOLUMETRIC LIGHT — 4 capas (aura + halo + core + origin)
// ═════════════════════════════════════════════════════════════════════════════
const VolumetricLight: React.FC<{
  side: 'left' | 'right';
  color: string;
  xPct: number;
  delay: number;
  intensity: number;
  parallaxX: number;
}> = ({ side, color, xPct, delay, intensity, parallaxX }) => {
  const sweepKf = side === 'left' ? 'sweep-left' : 'sweep-right';
  return (
    <div
      className="absolute bottom-0"
      style={{
        [side]: `${xPct}%`,
        width: 280,
        height: '110vh',
        transformOrigin: 'bottom center',
        transform: `translate3d(${parallaxX}px, 0, 0)`,
        animation: `${sweepKf} ${10 + delay}s ease-in-out ${delay}s infinite alternate`,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${color}${Math.round(intensity * 50).toString(16).padStart(2, '0')} 0%, ${color}1a 30%, transparent 75%)`,
          clipPath: 'polygon(35% 100%, 65% 100%, 100% 0%, 0% 0%)',
          filter: 'blur(36px)',
          opacity: intensity * 0.95,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${color}${Math.round(intensity * 90).toString(16).padStart(2, '0')} 0%, ${color}33 35%, transparent 78%)`,
          clipPath: 'polygon(43% 100%, 57% 100%, 92% 0%, 8% 0%)',
          filter: 'blur(14px)',
          opacity: intensity,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to top, ${color}ee 0%, ${color}88 30%, transparent 80%)`,
          clipPath: 'polygon(48% 100%, 52% 100%, 76% 0%, 24% 0%)',
          filter: 'blur(2.5px)',
          opacity: intensity * 0.85,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute', bottom: -20, left: '50%',
          width: 90, height: 90, marginLeft: -45,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}cc 0%, ${color}44 40%, transparent 70%)`,
          filter: 'blur(10px)',
          opacity: intensity,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};

const Spotlights: React.FC = () => {
  const { x: mx } = useMouseParallax();
  const reduced = usePrefersReducedMotion();
  const intensity = 0.65;
  const parallaxX = reduced ? 0 : mx * 14;

  // Paleta de marca: Midnight = eclipse #490F7C / Solstice = coral #E6392F
  const lights = [
    { side: 'left'  as const, color: '#490F7C', xPct: 22, delay: 0   },
    { side: 'left'  as const, color: '#7A1FA8', xPct: 38, delay: 1.5 },
    { side: 'right' as const, color: '#E6392F', xPct: 22, delay: 0   },
    { side: 'right' as const, color: '#FF7A00', xPct: 38, delay: 1.5 },
  ];

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none z-[3]">
      {lights.map((l, i) => (
        <VolumetricLight
          key={i}
          side={l.side}
          color={l.color}
          xPct={l.xPct}
          delay={l.delay}
          intensity={intensity}
          parallaxX={l.side === 'left' ? parallaxX : -parallaxX}
        />
      ))}

      <div
        className="absolute left-0 right-0 bottom-0 pointer-events-none"
        style={{
          height: '38%',
          background: `
            radial-gradient(ellipse 55% 65% at 22% 100%, rgba(73,15,124,0.32) 0%, transparent 65%),
            radial-gradient(ellipse 55% 65% at 78% 100%, rgba(230,57,47,0.28) 0%, transparent 65%)
          `,
          filter: 'blur(32px)',
          opacity: 0.85,
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// WING SIGIL
// ═════════════════════════════════════════════════════════════════════════════
const WingSigil: React.FC<{ color: string; opacity?: number; size?: number }> = ({
  color, opacity = 0.85, size = 64,
}) => (
  <svg viewBox="0 0 100 60" fill="none" style={{ width: size, height: 'auto', opacity, display: 'block' }}>
    <path d="M50 30 C 32 14, 14 12, 4 22 C 14 30, 28 32, 38 30 C 28 28, 14 30, 4 38 C 14 48, 32 46, 50 30 Z" fill={color} />
    <path d="M50 30 C 68 14, 86 12, 96 22 C 86 30, 72 32, 62 30 C 72 28, 86 30, 96 38 C 86 48, 68 46, 50 30 Z" fill={color} />
    <circle cx="50" cy="30" r="3" fill={color} />
    <circle cx="50" cy="30" r="5.5" fill="none" stroke={color} strokeWidth="0.6" opacity="0.55" />
  </svg>
);

// ═════════════════════════════════════════════════════════════════════════════
// ORNAMENT + CORNER MARKERS
// ═════════════════════════════════════════════════════════════════════════════
const TopStar: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 8px rgba(201,169,97,0.8))' }}>
    <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" fill="#C9A961" />
  </svg>
);

const CornerMarkers: React.FC = () => {
  const Marker: React.FC<{ pos: string }> = ({ pos }) => (
    <div aria-hidden className={`absolute ${pos} text-[#C9A961]`} style={{ fontSize: 14, textShadow: '0 0 8px rgba(201,169,97,0.5)' }}>◇</div>
  );
  return (
    <>
      <Marker pos="top-3 left-3" />
      <Marker pos="top-3 right-3" />
      <Marker pos="bottom-3 left-3" />
      <Marker pos="bottom-3 right-3" />
    </>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CROWD — 3 filas con profundidad
// ═════════════════════════════════════════════════════════════════════════════
const CrowdSilhouette: React.FC<{ lite: boolean }> = ({ lite }) => {
  const rows = useMemo(() => {
    let seed = 1337;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

    const generateRow = (count: number, baseSize: number) => {
      return Array.from({ length: count }, (_, i) => ({
        x: (i / count) * 100 + (rand() - 0.5) * (100 / count) * 0.8,
        size: baseSize * (0.85 + rand() * 0.3),
        armsUp: rand() < 0.72,
        hasPhone: rand() < 0.12,
      }));
    };

    const layers = [
      { row: generateRow(16, 44), fill: '#0e051c', opacity: 0.80, blur: 0.8, bottomPct: 7  },
      { row: generateRow(12, 64), fill: '#000',    opacity: 1.00, blur: 0,   bottomPct: 0  },
    ];
    if (!lite) {
      layers.unshift({ row: generateRow(20, 28), fill: '#1a0d2e', opacity: 0.55, blur: 2.5, bottomPct: 14 });
    }
    return layers;
  }, [lite]);

  return (
    <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none z-[6]" style={{ height: '40%' }}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.88) 30%, rgba(0,0,0,0.45) 65%, transparent 100%)',
      }} />

      {rows.map((layer, rowIdx) => (
        <div
          key={rowIdx}
          className="absolute inset-x-0"
          style={{
            bottom: `${layer.bottomPct}%`,
            height: '55%',
            opacity: layer.opacity,
            filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
          }}
        >
          {layer.row.map((p, i) => (
            <Person key={`${rowIdx}-${i}`} xPct={p.x} size={p.size} armsUp={p.armsUp} hasPhone={p.hasPhone} fill={layer.fill} />
          ))}
        </div>
      ))}

      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i * 47.3) % 100}%`,
            bottom: `${30 + (i * 11) % 50}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            borderRadius: '999px',
            background: i % 3 === 0 ? '#FFB48C' : i % 3 === 1 ? '#C9A84C' : '#F9F2D7',
            boxShadow: '0 0 6px currentColor',
            color: '#FFB48C',
            opacity: 0,
            animation: `rise-spark ${6 + (i % 4)}s ease-in-out ${(i * 0.5) % 3}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

const Person: React.FC<{
  xPct: number; size: number; armsUp: boolean; hasPhone: boolean; fill: string;
}> = ({ xPct, size, armsUp, hasPhone, fill }) => (
  <div
    style={{
      position: 'absolute',
      left: `${xPct}%`, bottom: 0,
      width: size, height: size * 1.6,
      transform: 'translateX(-50%)',
    }}
  >
    <svg viewBox="0 0 40 64" fill="none" style={{ width: '100%', height: '100%', display: 'block' }}>
      <circle cx="20" cy="9" r="5.5" fill={fill} />
      <rect x="18" y="13" width="4" height="3" fill={fill} />
      <path d="M 11 16 Q 11 14, 13 14 L 27 14 Q 29 14, 29 16 L 30 32 Q 30 40, 28 50 L 24 64 L 16 64 L 12 50 Q 10 40, 10 32 Z" fill={fill} />
      {armsUp ? (
        <>
          <path d="M 12 17 Q 8 14, 6 8 Q 6 5, 7 3 L 9 4 Q 9 8, 11 13 Z" fill={fill} />
          <path d="M 28 17 Q 32 14, 34 8 Q 34 5, 33 3 L 31 4 Q 31 8, 29 13 Z" fill={fill} />
          <circle cx="7" cy="3" r="1.5" fill={fill} />
          <circle cx="33" cy="3" r="1.5" fill={fill} />
          {hasPhone && (
            <rect x="32.2" y="1.5" width="2" height="2.8" rx="0.3" fill="#F9F2D7" opacity="0.8" />
          )}
        </>
      ) : (
        <>
          <path d="M 11 18 Q 7 25, 6 38 L 9 38 Q 10 28, 13 22 Z" fill={fill} />
          <path d="M 29 18 Q 33 25, 34 38 L 31 38 Q 30 28, 27 22 Z" fill={fill} />
        </>
      )}
    </svg>
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// ORBITAL RINGS — 3 anillos + dots + partículas
// ═════════════════════════════════════════════════════════════════════════════
const RingSystem: React.FC<{ variant: 'midnight' | 'solstice'; size: number }> = ({ variant, size }) => {
  const isMid = variant === 'midnight';
  const tilt = isMid ? -18 : 18;
  // Marca real: Midnight = eclipse purple con dots dorados | Solstice = coral red
  const ringColor = isMid ? '73,15,124' : '230,57,47';
  const dotColor = isMid ? '#C9A84C' : '#FF7A00';

  const particles = useMemo(() => Array.from({ length: 12 }, () => ({
    ringIdx: Math.floor(Math.random() * 3),
    angle: Math.random() * 360,
    opacity: 0.45 + Math.random() * 0.5,
    size: 1.5 + Math.random() * 1.5,
  })), []);

  const rings = [
    { scale: 1.0,  thickness: 1.5, opacity: 0.50, duration: 60, reverse: false },
    { scale: 0.78, thickness: 1.2, opacity: 0.35, duration: 80, reverse: true  },
    { scale: 0.58, thickness: 1.0, opacity: 0.25, duration: 100, reverse: false },
  ];

  return (
    <div
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        width: size, height: size,
        left: '50%', top: '50%',
        marginLeft: -size / 2, marginTop: -size / 2,
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {rings.map((r, idx) => {
        const w = size * r.scale;
        const h = w * 0.36;
        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: w, height: h,
              marginLeft: -w / 2, marginTop: -h / 2,
              borderRadius: '50%',
              border: `${r.thickness}px solid rgba(${ringColor},${r.opacity})`,
              boxShadow: `0 0 14px rgba(${ringColor},${r.opacity * 0.6})`,
              animation: `${r.reverse ? 'orbit-reverse' : 'orbit-slow'} ${r.duration}s linear infinite`,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '50%', left: 0,
                width: 5, height: 5,
                marginTop: -2.5, marginLeft: -2.5,
                borderRadius: '999px',
                background: dotColor,
                boxShadow: `0 0 10px ${dotColor}`,
              }}
            />
          </div>
        );
      })}

      {particles.map((p, i) => {
        const ring = rings[p.ringIdx];
        const w = size * ring.scale;
        const h = w * 0.36;
        const a = (p.angle * Math.PI) / 180;
        const x = (w / 2) * Math.cos(a);
        const y = (h / 2) * Math.sin(a);
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: p.size, height: p.size,
              marginLeft: -p.size / 2, marginTop: -p.size / 2,
              transform: `translate(${x}px, ${y}px)`,
              borderRadius: '999px',
              background: dotColor,
              opacity: p.opacity,
              animation: `${ring.reverse ? 'orbit-reverse' : 'orbit-slow'} ${ring.duration}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ORGANIC FLARE
// ═════════════════════════════════════════════════════════════════════════════
const OrganicFlare: React.FC<{
  rotation: number; size: number; delay: number; duration: number; sunRadius: number;
}> = ({ rotation, size, delay, duration, sunRadius }) => {
  const gradId = `fg-${rotation.toFixed(0)}-${size}`;
  const curveVariant = (size + rotation) % 3;
  const pathD =
    curveVariant === 0
      ? 'M 30 100 Q 22 70 28 42 Q 32 22 30 4 Q 30 22 36 42 Q 42 70 30 100 Z'
      : curveVariant === 1
      ? 'M 30 100 Q 18 72 24 44 Q 28 22 30 4 Q 32 22 38 44 Q 40 72 30 100 Z'
      : 'M 30 100 Q 24 68 30 40 Q 32 20 30 2 Q 28 20 32 40 Q 38 68 30 100 Z';

  return (
    <svg
      viewBox="0 0 60 100"
      preserveAspectRatio="xMidYMid meet"
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: size * 0.45,
        height: size,
        marginLeft: -(size * 0.45) / 2,
        marginTop: -size,
        transformOrigin: 'center 100%',
        transform: `rotate(${rotation}deg) translateY(-${sunRadius}px)`,
        mixBlendMode: 'screen',
        animation: `flare ${duration}s ease-in-out ${delay}s infinite`,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="80%" r="60%">
          <stop offset="0%"  stopColor="#FFE4D0" stopOpacity="0.92" />
          <stop offset="25%" stopColor="#FF6B3B" stopOpacity="0.82" />
          <stop offset="55%" stopColor="#E6392F" stopOpacity="0.62" />
          <stop offset="80%" stopColor="#B0241C" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#6B0F0A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={pathD} fill={`url(#${gradId})`} />
    </svg>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PLANET MIDNIGHT
// ═════════════════════════════════════════════════════════════════════════════
interface PlanetProps {
  onClick: () => void;
  onHover: (h: boolean) => void;
  dimmed: boolean;
  parallaxX: number;
  parallaxY: number;
}

const PlanetMidnight: React.FC<PlanetProps & { lite: boolean }> = ({ onClick, onHover, dimmed, parallaxX, parallaxY, lite }) => {
  const moons = useMemo(() => ([
    { size: 8,  orbitR: 200, angle: 30,  duration: 18 },
    { size: 5,  orbitR: 230, angle: 145, duration: 24 },
    { size: 11, orbitR: 175, angle: 260, duration: 14 },
  ]), []);

  const glowSize = 100;
  const beatBoost = 1;
  const mids = 0.3;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 'min(80vw, 520px)', aspectRatio: '1 / 1' }}>
      <motion.div
        animate={{ y: [0, -12, 0], scale: dimmed ? 0.96 : 1, opacity: dimmed ? 0.55 : 1 }}
        transition={{
          y: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 0.6, ease: [0.25, 1, 0.5, 1] },
          opacity: { duration: 0.6 },
        }}
        whileHover={{ scale: dimmed ? 0.96 : 1.05 }}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={onClick}
        className="relative cursor-pointer w-full h-full flex items-center justify-center"
      >
        <div className="absolute flex items-center justify-center" style={{ width: 520, height: 520, transform: 'scale(calc(min(80vw, 520px) / 520))' }}>
          <div className="relative w-full h-full" style={{ transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0)` }}>
      <RingSystem variant="midnight" size={520} />

      {moons.map((m, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: '50%', top: '50%', width: 0, height: 0,
            animation: `orbit-slow ${m.duration}s linear infinite`,
            transform: 'rotate(-18deg)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: m.orbitR * Math.cos((m.angle * Math.PI) / 180),
              top: m.orbitR * 0.36 * Math.sin((m.angle * Math.PI) / 180),
              width: m.size, height: m.size,
              borderRadius: '999px',
              background: 'radial-gradient(circle at 35% 35%, #C9A84C 0%, #2D0950 70%)',
              boxShadow: '0 0 8px rgba(201,168,76,0.55)',
            }}
          />
        </div>
      ))}

      {/* Corona externa difusa — púrpura intenso (la fuente del eclipse) */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: 60,
          background: 'radial-gradient(circle at center, transparent 55%, rgba(176,38,255,0.32) 70%, rgba(122,31,168,0.18) 82%, transparent 95%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Anillo brillante violeta — el rim del eclipse */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: 108,
          background: 'radial-gradient(circle at center, transparent 70%, rgba(176,38,255,0.85) 84%, rgba(216,160,255,0.95) 90%, rgba(176,38,255,0.55) 96%, transparent 100%)',
          filter: 'blur(3px)',
        }}
      />

      {/* Cuerpo del planeta — OSCURO (eclipse), con sutil tinte púrpura interno */}
      <div
        className="absolute rounded-full orb-midnight"
        style={{
          inset: 116,
          transform: `scale(${beatBoost})`,
          transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
          // Glow externo púrpura intenso + inset rim para reforzar la corona
          boxShadow: `
            inset 0 0 80px 12px rgba(176,38,255,0.6),
            inset 0 0 24px 4px rgba(216,160,255,0.7),
            inset 0 0 10px 1px rgba(255,255,255,0.3),
            0 0 20px rgba(176,38,255,0.8),
            0 0 40px rgba(176,38,255,0.6),
            0 0 ${glowSize}px rgba(176,38,255,${0.55 + mids * 0.30}),
            0 0 ${glowSize * 1.5}px rgba(122,31,168,0.5),
            0 0 ${glowSize * 2.5}px rgba(73,15,124,0.3)
          `,
        }}
      >
        {/* Gradiente eclipse: muy oscuro al centro, púrpura sutil hacia el borde */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle at center, #000000 0%, #05010A 40%, #1A052E 80%, #490F7C 100%)',
        }} />

        {!lite && (
          <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none rounded-full" style={{ mixBlendMode: 'overlay', opacity: 0.50 }}>
            <defs>
              <filter id="midNeb">
                <feTurbulence type="fractalNoise" baseFrequency="0.02 0.04" numOctaves="2" seed="5" stitchTiles="stitch" />
                <feColorMatrix values="0 0 0 0 0.29  0 0 0 0 0.06  0 0 0 0 0.49  0 0 0 0.55 0" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#midNeb)" />
          </svg>
        )}

        {/* Sin highlight especular — un eclipse no tiene punto brillante en la cara */}

        {/* Sombra interior para profundizar el centro */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, transparent 60%)',
          }}
        />
      </div>{/* /planet body */}

          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PLANET SOLSTICE
// ═════════════════════════════════════════════════════════════════════════════
const PlanetSolstice: React.FC<PlanetProps & { lite: boolean }> = ({ onClick, onHover, dimmed, parallaxX, parallaxY, lite }) => {
  const bass = 0.3;
  const beatBoost = 1;

  const moons = useMemo(() => ([
    { size: 7,  orbitR: 215, angle: 50,  duration: 20, reverse: false },
    { size: 10, orbitR: 245, angle: 170, duration: 26, reverse: true  },
    { size: 6,  orbitR: 195, angle: 290, duration: 16, reverse: false },
  ]), []);

  const flares = useMemo(() => {
    const count = lite ? 6 : 12;
    const arr: Array<{ rotation: number; size: number; delay: number; duration: number }> = [];
    for (let i = 0; i < count; i++) {
      const rotation = (i * 360) / count + (i % 3) * 4;
      const tier = i % 3;
      const size = tier === 0 ? 130 : tier === 1 ? 95 : 70;
      arr.push({
        rotation,
        size,
        delay: (i * 0.27) % 2.5,
        duration: 2.0 + (i % 3) * 0.5,
      });
    }
    return arr;
  }, [lite]);

  const sunGlow = 120;
  const SUN_RADIUS = 160;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 'min(80vw, 520px)', aspectRatio: '1 / 1' }}>
      <motion.div
        animate={{ y: [0, -10, 0], scale: dimmed ? 0.96 : 1, opacity: dimmed ? 0.55 : 1 }}
        transition={{
          y: { duration: 7, delay: 1, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 0.6, ease: [0.25, 1, 0.5, 1] },
          opacity: { duration: 0.6 },
        }}
        whileHover={{ scale: dimmed ? 0.96 : 1.05 }}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onClick={onClick}
        className="relative cursor-pointer w-full h-full flex items-center justify-center"
      >
        <div className="absolute flex items-center justify-center" style={{ width: 520, height: 520, transform: 'scale(calc(min(80vw, 520px) / 520))' }}>
          <div className="relative w-full h-full" style={{ transform: `translate3d(${parallaxX}px, ${parallaxY}px, 0)` }}>
      <RingSystem variant="solstice" size={520} />

      {moons.map((m, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: '50%', top: '50%', width: 0, height: 0,
            animation: `${m.reverse ? 'orbit-reverse' : 'orbit-slow'} ${m.duration}s linear infinite`,
            transform: 'rotate(18deg)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: m.orbitR * Math.cos((m.angle * Math.PI) / 180),
              top: m.orbitR * 0.36 * Math.sin((m.angle * Math.PI) / 180),
              width: m.size, height: m.size,
              borderRadius: '999px',
              background: 'radial-gradient(circle at 35% 35%, #FF7A00 0%, #6B0F0A 70%)',
              boxShadow: '0 0 8px rgba(230,57,47,0.65)',
            }}
          />
        </div>
      ))}

      {/* Corona externa — rojo coral dominante */}
      <div
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: 50,
          background: 'radial-gradient(circle at center, rgba(230,57,47,0.60) 0%, rgba(176,36,28,0.35) 30%, rgba(107,15,10,0.15) 55%, transparent 75%)',
          filter: 'blur(26px)',
        }}
      />

      {/* Rim pulsante — coral profundo con tinte peach sutil */}
      <motion.div
        aria-hidden
        animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: 100,
          background: 'radial-gradient(circle at center, transparent 42%, rgba(230,57,47,0.65) 48%, rgba(255,107,59,0.88) 51%, rgba(230,57,47,0.55) 54%, transparent 66%)',
          filter: 'blur(1.5px)',
        }}
      />

      <div aria-hidden className="absolute pointer-events-none" style={{ width: 520, height: 520, left: 0, top: 0 }}>
        {flares.map((f, i) => (
          <OrganicFlare
            key={i}
            rotation={f.rotation}
            size={f.size}
            delay={f.delay}
            duration={f.duration}
            sunRadius={SUN_RADIUS}
          />
        ))}
      </div>

      <div
        className="absolute rounded-full orb-solstice"
        style={{
          inset: 100,
          transform: `scale(${beatBoost})`,
          transition: 'transform 120ms ease-out, box-shadow 120ms ease-out',
          boxShadow: `
            inset -30px -26px 90px rgba(58,6,4,0.80),
            inset 20px 16px 55px rgba(255,180,140,0.5),
            inset 0 0 20px 4px rgba(255,200,150,0.4),
            0 0 20px rgba(255,122,0,0.8),
            0 0 45px rgba(230,57,47,0.6),
            0 0 ${sunGlow}px rgba(230,57,47,${0.55 + bass * 0.25}),
            0 0 ${sunGlow * 1.6}px rgba(176,36,28,0.45),
            0 0 ${sunGlow * 2.5}px rgba(107,15,10,0.3)
          `,
        }}
      >
        {/* Sun coral/crimson — rojo dominante, naranja solo como acento */}
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle at 40% 35%, #FFF4E6 0%, #FFB48C 8%, #FF6B3B 18%, #E6392F 38%, #B0241C 65%, #7A0F08 88%, #3A0604 100%)',
        }} />

        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 42px 8px rgba(255,107,59,0.50), inset 0 0 14px 3px rgba(255,180,140,0.30)',
          }}
        />

        {!lite && (
          <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none rounded-full" style={{ mixBlendMode: 'overlay', opacity: 0.55 }}>
            <defs>
              <filter id="sunTex">
                <feTurbulence type="fractalNoise" baseFrequency="0.06 0.10" numOctaves="2" seed="3" stitchTiles="stitch" />
                {/* Coral-red dominante: 0.85 / 0.15 / 0.12 */}
                <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.15  0 0 0 0 0.12  0 0 0 0.72 0" />
              </filter>
            </defs>
            <rect width="100%" height="100%" filter="url(#sunTex)" />
          </svg>
        )}

        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 28% 18% at 25% 60%, rgba(46,6,4,0.65) 0%, transparent 60%),
              radial-gradient(ellipse 22% 16% at 70% 42%, rgba(107,15,10,0.55) 0%, transparent 65%),
              radial-gradient(ellipse 18% 14% at 55% 78%, rgba(176,36,28,0.45) 0%, transparent 60%)
            `,
            animation: 'orbit-slow 80s linear infinite',
            mixBlendMode: 'multiply',
          }}
        />

        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 36% 32%, rgba(249,242,215,0.45) 0%, rgba(255,180,140,0.18) 18%, transparent 45%)',
            mixBlendMode: 'screen',
          }}
        />
      </div>{/* /sun body */}

          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// CENTER SELECTOR
// ═════════════════════════════════════════════════════════════════════════════
const CenterPathSelector: React.FC = () => {
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="60" fill="none" stroke="#C9A84C" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
        
        <path id="top-arc" d="M 10,70 A 60,60 0 0,1 130,70" fill="none" />
        <text style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fill: '#B59E62', letterSpacing: '0.4em', fontWeight: 400 }} textAnchor="middle">
          <textPath href="#top-arc" startOffset="50%">ELÍGE</textPath>
        </text>

        <path id="bottom-arc" d="M 10,70 A 60,60 0 0,0 130,70" fill="none" />
        <text style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, fill: '#B59E62', letterSpacing: '0.4em', fontWeight: 400 }} textAnchor="middle">
          <textPath href="#bottom-arc" startOffset="50%">TU CAMINO</textPath>
        </text>
      </svg>
      
      <div aria-hidden className="absolute pointer-events-none" style={{ filter: 'drop-shadow(0 0 10px rgba(181,158,98,0.5))' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5L12 2Z" fill="#B59E62" />
        </svg>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PREMIUM TITLE
// ═════════════════════════════════════════════════════════════════════════════
const PremiumTitle: React.FC<{
  text: string;
  color: string;
  glowColor: string;
  fontFamily: string;
  fontWeight: number;
}> = ({ text, color, glowColor, fontFamily, fontWeight }) => (
  <h1
    className="uppercase"
    style={{
      fontFamily,
      fontWeight,
      fontSize: 'clamp(1.75rem, 8vw, 5.5rem)',
      letterSpacing: '0.06em',
      lineHeight: 1,
      color,
      textShadow: `0 0 18px ${glowColor}cc, 0 0 48px ${glowColor}66, 0 0 90px ${glowColor}33`,
    }}
  >
    {text}
  </h1>
);

// ═════════════════════════════════════════════════════════════════════════════
// SECTION HEADER + FOOTER
// ═════════════════════════════════════════════════════════════════════════════
const SectionHeader: React.FC<{ variant: 'midnight' | 'solstice' }> = ({ variant }) => {
  const isMid = variant === 'midnight';
  const Icon = isMid ? Moon : Sun;
  const lineColor  = isMid ? '#490F7C' : '#E6392F';
  const iconColor  = '#B59E62';
  const subColor   = '#FFFFFF';
  const titleColor = isMid ? '#B59E62' : '#B0241C';
  const glowColor  = isMid ? '#B59E62' : '#E6392F';
  const titleFont = "'Cormorant Garamond', 'Cinzel', serif";
  const titleWeight = 400;

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="flex items-center gap-4 mb-4">
        <span style={{ width: 90, height: 1, background: `linear-gradient(to right, transparent, ${lineColor}, transparent)` }} />
        <Icon size={22} color={iconColor} style={{ filter: `drop-shadow(0 0 8px ${iconColor})` }} />
        <span style={{ width: 90, height: 1, background: `linear-gradient(to right, transparent, ${lineColor}, transparent)` }} />
      </div>

      <PremiumTitle
        text={isMid ? 'Midnight' : 'Solstice'}
        color={titleColor}
        glowColor={glowColor}
        fontFamily={titleFont}
        fontWeight={titleWeight}
      />

      <p className="uppercase mt-3 flex items-center gap-3"
        style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: subColor, letterSpacing: '0.5em', fontWeight: 400 }}>
        <span style={{ color: subColor, opacity: 0.6 }}>—</span>
        {isMid ? 'The Eclipse' : 'The Awakening'}
        <span style={{ color: subColor, opacity: 0.6 }}>—</span>
      </p>
    </div>
  );
};

const SectionFooter: React.FC<{ variant: 'midnight' | 'solstice' }> = ({ variant }) => {
  const isMid = variant === 'midnight';
  const textColor = '#FFFFFF';
  const lines = isMid ? ['Misterio. Vibras.', 'Toda la noche.'] : ['Energía. Luz.', 'Un nuevo comienzo.'];
  return (
    <div className="flex flex-col items-center gap-6 mt-6">
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: textColor, letterSpacing: '0.3em', textTransform: 'uppercase', lineHeight: 1.8, textAlign: 'center', fontWeight: 400 }}>
        <div>{lines[0]}</div>
        <div>{lines[1]}</div>
      </div>
      
      <button
        className="px-8 py-3 rounded-full text-[10px] uppercase tracking-[0.3em] font-medium transition-all duration-300"
        style={{
          fontFamily: "'Inter', sans-serif",
          color: isMid ? '#F2F2F2' : '#F9F2D7',
          border: `1px solid ${isMid ? '#b026ff' : '#E6392F'}`,
          background: `rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.05)`,
          boxShadow: `0 0 15px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.2), inset 0 0 10px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.1)`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.15)`;
          e.currentTarget.style.boxShadow = `0 0 25px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.4), inset 0 0 15px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.3)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = `rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.05)`;
          e.currentTarget.style.boxShadow = `0 0 15px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.2), inset 0 0 10px rgba(${isMid ? '176,38,255' : '230,57,47'}, 0.1)`;
        }}
      >
        Ver Eventos
      </button>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════════
export const ConjunctionPortal: React.FC<ConjunctionPortalProps> = ({ onEnterBrand }) => {
  const [hoveredBrand, setHoveredBrand] = useState<BrandSelection>(null);
  const [selectedBrand, setSelectedBrand] = useState<BrandSelection>(null);
  const [fadeOut, setFadeOut] = useState(false);
  const { x: mx, y: my } = useMouseParallax();
  const reduced = usePrefersReducedMotion();
  const lite = useLowEnd();

  const handleSelect = (brand: 'midnight' | 'solstice') => {
    if (selectedBrand) return;
    setSelectedBrand(brand);
    setFadeOut(true);
    setTimeout(() => onEnterBrand(brand), 700);
  };

  const introVariants = {
    hidden: { opacity: 0, y: 12 },
    show: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 1.2, delay: 0.5 + i * 0.15, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  const pxPlanet = reduced ? 0 : mx * 18;
  const pyPlanet = reduced ? 0 : my * 12;

  return (
    <>
      <main
        className="relative w-full overflow-hidden"
        style={{
          minHeight: '100vh',
          backgroundColor: '#05020A',
        }}
      >
        {/* Curtains of Light */}
        <div className="absolute top-0 bottom-0 left-0 w-[60%] pointer-events-none z-[0] overflow-hidden">
          <div className="absolute top-[-20%] left-[-40%] w-[160%] h-[140%] rounded-full opacity-60" 
               style={{ background: 'radial-gradient(ellipse at center, rgba(122,31,168,0.35) 0%, transparent 70%)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
        </div>
        <div className="absolute top-0 bottom-0 right-0 w-[60%] pointer-events-none z-[0] overflow-hidden">
          <div className="absolute top-[-20%] right-[-40%] w-[160%] h-[140%] rounded-full opacity-60" 
               style={{ background: 'radial-gradient(ellipse at center, rgba(230,57,47,0.3) 0%, transparent 70%)', filter: 'blur(90px)', mixBlendMode: 'screen' }} />
        </div>

        <Starfield lite={lite} />
        {!lite && <ShootingStars />}
        <Spotlights />

        <div className="absolute inset-6 pointer-events-none z-[4]" style={{ border: '0.5px solid rgba(58,42,26,0.40)' }}>
          <CornerMarkers />
        </div>

        <motion.div
          className="relative z-[10] pt-10 md:pt-14 flex flex-col items-center"
          custom={0}
          initial="hidden"
          animate="show"
          variants={introVariants}
        >
          <h2 className="uppercase mb-4" style={{
            fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#B59E62',
            letterSpacing: '0.45em', fontWeight: 400, textShadow: '0 0 8px rgba(181,158,98,0.2)',
          }}>
            Elige Tu Experiencia
          </h2>
          <div className="flex flex-col items-center opacity-70">
            <span style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, #B59E62, transparent)' }} />
            <svg width="6" height="6" viewBox="0 0 24 24" fill="none" style={{ marginTop: -2 }}>
              <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10L12 2Z" fill="#B59E62" />
            </svg>
          </div>
        </motion.div>

        <div
          className="relative z-[10] flex flex-col lg:flex-row items-center justify-center px-4 md:px-10 lg:px-16 mt-8 md:mt-14 gap-10 lg:gap-16 xl:gap-24"
        >
          <motion.div className="flex flex-col items-center" custom={1} initial="hidden" animate="show" variants={introVariants}>
            <SectionHeader variant="midnight" />
            <PlanetMidnight
              onClick={() => handleSelect('midnight')}
              onHover={(h) => setHoveredBrand(h ? 'midnight' : null)}
              dimmed={hoveredBrand === 'solstice'}
              parallaxX={pxPlanet}
              parallaxY={pyPlanet}
              lite={lite}
            />
            <div className="mt-8">
              <SectionFooter variant="midnight" />
            </div>
          </motion.div>

          <motion.div custom={2} initial="hidden" animate="show" variants={introVariants}>
            <CenterPathSelector />
          </motion.div>

          <motion.div className="flex flex-col items-center" custom={3} initial="hidden" animate="show" variants={introVariants}>
            <SectionHeader variant="solstice" />
            <PlanetSolstice
              onClick={() => handleSelect('solstice')}
              onHover={(h) => setHoveredBrand(h ? 'solstice' : null)}
              dimmed={hoveredBrand === 'midnight'}
              parallaxX={-pxPlanet}
              parallaxY={pyPlanet}
              lite={lite}
            />
            <div className="mt-8">
              <SectionFooter variant="solstice" />
            </div>
          </motion.div>
        </div>

        <CrowdSilhouette lite={lite} />

        <motion.div
          className="relative lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:bottom-[4.5%] z-[10] flex flex-col items-center pointer-events-none mt-10 mb-12 lg:mt-0 lg:mb-0 px-4 text-center"
          custom={5} initial="hidden" animate="show" variants={introVariants}
        >
          <p className="uppercase mb-8 text-center px-4" style={{
            fontFamily: "'Cormorant Garamond', 'Cinzel', serif", fontSize: 'clamp(12px, 2.5vw, 15px)', color: '#B59E62',
            letterSpacing: '0.35em', fontWeight: 400, textShadow: '0 0 10px rgba(181,158,98,0.2)'
          }}>
            Una Experiencia. Dos Caminos. Recuerdos Inolvidables.
          </p>

          <div className="flex items-center gap-6 md:gap-14 mt-2 flex-wrap justify-center">
            {[
              { icon: Music, label: 'Música' },
              { icon: GlassWater, label: 'Bebidas' },
              { icon: Users, label: 'Baile' },
              { icon: Heart, label: 'Conexión' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 transition-colors duration-300 cursor-default group" style={{ color: '#8a7355' }}>
                <Icon size={14} className="transition-all duration-300 group-hover:text-[#B59E62]" />
                <span className="uppercase transition-colors duration-300 group-hover:text-[#B59E62]" style={{
                  fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: '0.3em', fontWeight: 400,
                }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        <PostFXLayer lite={lite} />

        <AnimatePresence>
          {fadeOut && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
              className="fixed inset-0 z-[150] pointer-events-none"
              style={{
                background: selectedBrand === 'midnight'
                  ? 'radial-gradient(circle at 25% 50%, rgba(73,15,124,0.92) 0%, #0B0316 70%)'
                  : 'radial-gradient(circle at 75% 50%, rgba(230,57,47,0.55) 0%, rgba(107,15,10,0.92) 50%, #000 80%)',
              }}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
};
