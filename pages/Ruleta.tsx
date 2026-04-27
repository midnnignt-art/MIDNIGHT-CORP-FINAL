import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PrizeDef {
  id: string;
  label: string;
  short: string;
  quote: string;
  serif: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PRIZES: PrizeDef[] = [
  { id: 'p1', label: 'Botella a mitad',   short: 'Botella · ½',   quote: 'La noche se duplica. La cuenta, no.',     serif: true  },
  { id: 'p2', label: 'Trago de la casa',  short: 'Trago · casa',  quote: 'Pide. Te lo sirve el barman.',            serif: false },
  { id: 'p3', label: '2×1 en tragos',     short: '2 × 1',         quote: 'Uno para ti. Uno para quien decidas.',    serif: false },
  { id: 'p4', label: 'Shot gratis',       short: 'Shot · gratis', quote: 'Corto, seco, sin testigos.',              serif: false },
  { id: 'p5', label: 'Mesa VIP · 1h',     short: 'VIP · 1h',      quote: 'Sesenta minutos en la cima de la noche.', serif: false },
  { id: 'p6', label: 'Entrada sin fila',  short: 'Sin · fila',    quote: 'Cruza el umbral. Sin esperar.',           serif: false },
  { id: 'p7', label: 'Brindis con el DJ', short: 'Con el DJ',     quote: 'Whisky, cabina, una historia.',           serif: true  },
  { id: 'p8', label: 'Otra vuelta',       short: 'Otra · vuelta', quote: 'La rueda nunca se cansa.',               serif: true  },
];

const SLICE_COLORS = [
  { fill: '#3D0B6A', stroke: '#6B19B5' },
  { fill: '#1A0833', stroke: '#3D0B6A' },
  { fill: '#5C1810', stroke: '#A85C38' },
  { fill: '#1A0833', stroke: '#3D0B6A' },
  { fill: '#3D0B6A', stroke: '#6B19B5' },
  { fill: '#0F1A33', stroke: '#2E3B6E' },
  { fill: '#5C4515', stroke: '#C9A84C' },
  { fill: '#1A0833', stroke: '#3D0B6A' },
];

const CHIP_COLORS = ['#6B19B5','#3D0B6A','#A85C38','#3D0B6A','#6B19B5','#2E3B6E','#C9A84C','#3D0B6A'];

const SPIN_DURATION = 5400;

// ─── CSS ──────────────────────────────────────────────────────────────────────
const RULETA_CSS = `
  @keyframes rl-orbit    { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  @keyframes rl-bob      { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes rl-shine    { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
  @keyframes rl-veil-in  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rl-pass-in  { to { transform: scale(1); opacity: 1; } }
  @keyframes rl-spark    { 0% { transform: translate(0,0) scale(0); opacity: 1; } 20% { opacity: 1; } 100% { transform: translate(var(--rl-dx), var(--rl-dy)) scale(1); opacity: 0; } }
  @keyframes rl-hub-glow {
    0%,100% { box-shadow: inset 0 0 30px rgba(176,38,255,0.25), inset 0 2px 0 rgba(255,255,255,0.08), 0 0 50px rgba(73,15,124,0.5); }
    50%     { box-shadow: inset 0 0 40px rgba(176,38,255,0.4),  inset 0 2px 0 rgba(255,255,255,0.08), 0 0 90px rgba(176,38,255,0.6); }
  }
  @keyframes rl-dot-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

  .rl-spark { position: absolute; border-radius: 50%; opacity: 0; animation: rl-spark 2s ease-out forwards; }
  .rl-hub-pulse { animation: rl-hub-glow 2.4s ease-in-out infinite; }
  .rl-shine-text {
    background: linear-gradient(95deg, #B026FF 0%, #EAB308 60%, #B026FF 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: rl-shine 6s ease infinite;
  }
  .rl-dot { animation: rl-dot-pulse 1.6s ease infinite; }
`;

// ─── Confetti ─────────────────────────────────────────────────────────────────
const Confetti: React.FC<{ trigger: number }> = ({ trigger }) => {
  const [sparks, setSparks] = useState<Array<{
    id: string; left: number; top: number; dx: number; dy: number;
    color: string; size: number; delay: number;
  }>>([]);

  useEffect(() => {
    if (!trigger) return;
    const colors = ['#B026FF', '#EAB308', '#FDE047', '#00F0FF', '#F2F2F2'];
    const next = Array.from({ length: 64 }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 200 + Math.random() * 400;
      return {
        id:    `${trigger}-${i}`,
        left:  50 + (Math.random() - 0.5) * 4,
        top:   50 + (Math.random() - 0.5) * 4,
        dx:    Math.cos(angle) * dist,
        dy:    Math.sin(angle) * dist - 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size:  3 + Math.random() * 6,
        delay: Math.random() * 200,
      };
    });
    setSparks(next);
    const t = setTimeout(() => setSparks([]), 2500);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 250, overflow: 'hidden' }} aria-hidden>
      {sparks.map(s => (
        <div
          key={s.id}
          className="rl-spark"
          style={{
            left: `${s.left}%`,
            top:  `${s.top}%`,
            background: s.color,
            width:  s.size,
            height: s.size,
            boxShadow: `0 0 12px ${s.color}`,
            '--rl-dx': `${s.dx}px`,
            '--rl-dy': `${s.dy}px`,
            animationDelay: `${s.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

// ─── SVG Wheel ────────────────────────────────────────────────────────────────
const RouletteWheel: React.FC<{
  prizes: PrizeDef[];
  rotation: number;
  isSpinning: boolean;
  onClick: () => void;
}> = ({ prizes, rotation, isSpinning, onClick }) => {
  const S  = 560;
  const r  = 260;
  const cx = S / 2;
  const cy = S / 2;
  const segAngle = 360 / prizes.length;

  const slices = prizes.map((prize, i) => {
    const sa  = i * segAngle - 90 - segAngle / 2;
    const ea  = sa + segAngle;
    const sr  = (sa * Math.PI) / 180;
    const er  = (ea * Math.PI) / 180;
    const x1  = cx + r * Math.cos(sr);
    const y1  = cy + r * Math.sin(sr);
    const x2  = cx + r * Math.cos(er);
    const y2  = cy + r * Math.sin(er);
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
    const colors = SLICE_COLORS[i % SLICE_COLORS.length];
    const tRad   = ((i * segAngle - 90) * Math.PI) / 180;
    const tR     = r * 0.62;
    const tx     = cx + tR * Math.cos(tRad);
    const ty     = cy + tR * Math.sin(tRad);
    return { path, colors, prize, tx, ty, rotate: i * segAngle - 90 + 90 };
  });

  return (
    <div style={{ position: 'relative', width: 'min(520px, 84vw)', aspectRatio: '1', flexShrink: 0, margin: '0 auto' }}>
      {/* Pointer */}
      <svg
        style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', zIndex: 6, filter: 'drop-shadow(0 4px 14px rgba(176,38,255,0.5))' }}
        width="36" height="44" viewBox="0 0 40 48" fill="none"
      >
        <defs>
          <linearGradient id="rl-ptr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0"   stopColor="#FDE047" />
            <stop offset="0.6" stopColor="#EAB308" />
            <stop offset="1"   stopColor="#7a5400" />
          </linearGradient>
        </defs>
        <path d="M20 44 L4 8 Q4 4 8 4 L32 4 Q36 4 36 8 Z" fill="url(#rl-ptr)" stroke="#0B0316" strokeWidth="1.5" />
        <circle cx="20" cy="12" r="3" fill="#0B0316" />
      </svg>

      {/* Orbit ring */}
      <div style={{ position: 'absolute', inset: -28, borderRadius: '50%', border: '1px dashed rgba(176,38,255,0.15)', animation: 'rl-orbit 80s linear infinite', pointerEvents: 'none' }} />

      {/* Halo */}
      <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, transparent 62%, rgba(176,38,255,0.18) 70%, transparent 78%)', filter: 'blur(8px)', pointerEvents: 'none' }} />

      {/* Wheel SVG */}
      <svg
        viewBox={`0 0 ${S} ${S}`}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          zIndex: 3,
          filter: isSpinning
            ? 'drop-shadow(0 24px 48px rgba(0,0,0,0.7)) drop-shadow(0 0 70px rgba(73,15,124,0.5)) blur(0.5px)'
            : 'drop-shadow(0 24px 48px rgba(0,0,0,0.7)) drop-shadow(0 0 70px rgba(73,15,124,0.5))',
          transition: `transform ${SPIN_DURATION}ms cubic-bezier(0.16, 0.84, 0.24, 1)`,
          transform: `rotate(${rotation}deg)`,
          willChange: 'transform',
        }}
      >
        <defs>
          {slices.map((s, i) => (
            <radialGradient key={`rl-g${i}`} id={`rl-g${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0"   stopColor={s.colors.fill} stopOpacity="0.7" />
              <stop offset="0.6" stopColor={s.colors.fill} />
              <stop offset="1"   stopColor="#06010F" />
            </radialGradient>
          ))}
          <radialGradient id="rl-rim" cx="50%" cy="50%" r="50%">
            <stop offset="0.94" stopColor="transparent" />
            <stop offset="0.96" stopColor="#B026FF" stopOpacity="0.22" />
            <stop offset="1"    stopColor="#B026FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={r + 14} fill="#06010F" stroke="rgba(176,38,255,0.18)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r + 6}  fill="none"    stroke="rgba(242,242,242,0.06)" strokeWidth="1" />

        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={`url(#rl-g${i})`} stroke={s.colors.stroke} strokeWidth="1" strokeLinejoin="round" />
        ))}

        {slices.map((_, i) => {
          const angle = i * segAngle - 90 - segAngle / 2;
          const rad   = (angle * Math.PI) / 180;
          return <line key={`rl-d${i}`} x1={cx} y1={cy} x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)} stroke="rgba(234,179,8,0.18)" strokeWidth="0.5" />;
        })}

        {slices.map((s, i) => (
          <g key={`rl-t${i}`} transform={`rotate(${s.rotate} ${s.tx} ${s.ty})`}>
            <text
              x={s.tx} y={s.ty}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontSize: s.prize.label.length < 14 ? '14px' : '11px',
                fill: '#F2F2F2',
                fontFamily: s.prize.serif ? "'Cormorant Garamond', serif" : "'Inter', sans-serif",
                fontWeight: s.prize.serif ? 600 : 700,
                fontStyle: s.prize.serif ? 'italic' : 'normal',
                letterSpacing: s.prize.serif ? '0.02em' : '0.16em',
                textTransform: s.prize.serif ? 'none' : 'uppercase',
              } as React.CSSProperties}
            >
              {s.prize.label}
            </text>
          </g>
        ))}

        {Array.from({ length: prizes.length * 4 }).map((_, i) => {
          const a  = (i * 360) / (prizes.length * 4) - 90;
          const rd = (a * Math.PI) / 180;
          const r1 = r + 1;
          const r2 = r + (i % 4 === 0 ? 8 : 4);
          return <line key={`rl-tk${i}`} x1={cx + r1 * Math.cos(rd)} y1={cy + r1 * Math.sin(rd)} x2={cx + r2 * Math.cos(rd)} y2={cy + r2 * Math.sin(rd)} stroke={i % 4 === 0 ? 'rgba(234,179,8,0.5)' : 'rgba(242,242,242,0.18)'} strokeWidth="1" />;
        })}

        <circle cx={cx} cy={cy} r={r + 14} fill="url(#rl-rim)" />
      </svg>

      {/* Hub */}
      <button
        onClick={onClick}
        disabled={isSpinning}
        className={!isSpinning ? 'rl-hub-pulse' : ''}
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '22%', aspectRatio: '1',
          borderRadius: '50%',
          zIndex: 5,
          background: 'radial-gradient(circle at 35% 30%, #2a0c4d 0%, #0B0316 75%)',
          border: '1px solid rgba(176,38,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: isSpinning ? 'not-allowed' : 'pointer',
          opacity: isSpinning ? 0.7 : 1,
          transition: 'transform 0.3s',
        }}
        aria-label="Girar la ruleta"
      >
        <div style={{
          width: '76%', height: '76%',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #FDE047 0%, #EAB308 35%, #7a5400 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 -6px 12px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.4)',
          position: 'relative',
        }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 'clamp(18px, 3.5vw, 32px)', letterSpacing: '-0.06em', color: '#0B0316', lineHeight: 1 }}>M</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 6, letterSpacing: '0.38em', textTransform: 'uppercase', color: 'rgba(11,3,22,0.65)', marginTop: 2, fontWeight: 700 }}>SPIN</span>
        </div>
      </button>
    </div>
  );
};

// ─── Prize Modal ──────────────────────────────────────────────────────────────
const PrizeModal: React.FC<{
  prize: PrizeDef | null;
  guestName: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  ticketNum: string;
  onClose: () => void;
  onSpinAgain: () => void;
}> = ({ prize, guestName, eventName, eventDate, eventVenue, ticketNum, onClose, onSpinAgain }) => {
  if (!prize) return null;

  const corners: React.CSSProperties[] = [
    { top: -1, left: -1, borderRight: 0, borderBottom: 0 },
    { top: -1, right: -1, borderLeft: 0, borderBottom: 0 },
    { bottom: -1, left: -1, borderRight: 0, borderTop: 0 },
    { bottom: -1, right: -1, borderLeft: 0, borderTop: 0 },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(73,15,124,0.5), rgba(6,1,15,0.94) 70%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'rl-veil-in 0.45s ease forwards',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(440px, 95vw)',
          background: '#0B0316',
          border: '1px solid rgba(176,38,255,0.38)',
          backgroundImage: 'radial-gradient(ellipse at 50% 100%, rgba(176,38,255,0.28), transparent 60%)',
          boxShadow: '0 40px 80px rgba(0,0,0,0.75), 0 0 120px rgba(176,38,255,0.4)',
          animation: 'rl-pass-in 0.65s cubic-bezier(0.16, 0.84, 0.24, 1) forwards',
          transform: 'scale(0.88)',
          opacity: 0,
        }}
      >
        {/* Perforation line */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '28%', width: 1, background: 'repeating-linear-gradient(180deg, rgba(242,242,242,0.06) 0 4px, transparent 4px 10px)' }} />

        {/* Corners */}
        {corners.map((pos, i) => (
          <span key={i} style={{ position: 'absolute', width: 14, height: 14, border: '1px solid #B026FF', ...pos }} />
        ))}

        {/* Header */}
        <div style={{ padding: '26px 32px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(242,242,242,0.07)', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.38em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.38)' }}>
          <span>MIDNIGHT ✦ {eventName.toUpperCase().slice(0, 20)}</span>
          <span>№ <b style={{ color: '#EAB308', fontWeight: 500 }}>{ticketNum}</b></span>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 32px 24px', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.52em', textTransform: 'uppercase', color: '#00FF9D', marginBottom: 16 }}>
            · Beneficio confirmado ·
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.38)', marginBottom: 14 }}>
            {guestName} — Tu premio
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(34px, 6vw, 54px)', lineHeight: 0.95, letterSpacing: '-0.01em', marginBottom: 14, background: 'linear-gradient(95deg, #FDE047, #EAB308)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {prize.label}
          </h2>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(242,242,242,0.65)', fontWeight: 400, maxWidth: 300, margin: '0 auto', lineHeight: 1.45 }}>
            "{prize.quote}"
          </p>
        </div>

        {/* Perforation band */}
        <div style={{ position: 'relative', height: 26, borderTop: '1px dashed rgba(242,242,242,0.07)', borderBottom: '1px dashed rgba(242,242,242,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 7.5, letterSpacing: '0.5em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.3)', background: 'rgba(11,3,22,0.65)' }}>
          VÁLIDO SOLO ESTA NOCHE
          <span style={{ position: 'absolute', left: -12, width: 22, height: 22, borderRadius: '50%', background: '#06010F', border: '1px solid rgba(176,38,255,0.2)' }} />
          <span style={{ position: 'absolute', right: -12, width: 22, height: 22, borderRadius: '50%', background: '#06010F', border: '1px solid rgba(176,38,255,0.2)' }} />
        </div>

        {/* Stub */}
        <div style={{ padding: '18px 32px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[['Fecha', eventDate], ['Sala', eventVenue], ['Pase', `#${ticketNum}`]].map(([label, value]) => (
            <dl key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <dt style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 7.5, letterSpacing: '0.38em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.35)', fontWeight: 500 }}>{label}</dt>
              <dd style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: '#F2F2F2' }}>{value}</dd>
            </dl>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(242,242,242,0.06)', borderTop: '1px solid rgba(242,242,242,0.07)' }}>
          {([
            ['↻  Otra vuelta', 'rgba(242,242,242,0.9)', onSpinAgain],
            ['Reclamar  →',    '#EAB308',              onClose],
          ] as [string, string, () => void][]).map(([label, color, handler]) => (
            <button
              key={label}
              onClick={handler}
              style={{ background: '#0B0316', padding: '17px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', fontWeight: 500, color, border: 0, cursor: 'pointer', transition: 'background 0.3s' }}
              onMouseEnter={e => { e.currentTarget.style.background = color === '#EAB308' ? 'rgba(234,179,8,0.12)' : 'rgba(176,38,255,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0B0316'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const Ruleta: React.FC = () => {
  const { currentUser, currentCustomer, events } = useStore();

  const derivedName = (
    currentUser?.name?.split(' ')[0]?.toUpperCase() ||
    currentCustomer?.email?.split('@')[0]?.toUpperCase() ||
    ''
  );
  const [guestName, setGuestName] = useState(derivedName || 'INVITADO');
  const [editingName, setEditingName] = useState(!derivedName);

  // Event data
  const nextEvent = events.find(e => new Date(e.event_date) >= new Date()) || events[0];
  const eventName  = nextEvent?.title  || 'MIDNIGHT EVENTS';
  const rawDate    = nextEvent?.event_date ? new Date(nextEvent.event_date) : null;
  const eventDate  = rawDate
    ? rawDate.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()
    : 'PRÓXIMAMENTE';
  const eventVenue = nextEvent?.venue || 'MIDNIGHT VENUE';

  // Wheel state
  const [rotation,    setRotation]    = useState(0);
  const [isSpinning,  setIsSpinning]  = useState(false);
  const [winnerIdx,   setWinnerIdx]   = useState<number | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [confettiTick, setConfettiTick] = useState(0);
  const [history,     setHistory]     = useState<Array<{ time: string; label: string; id: number }>>([]);
  const [activeTick,  setActiveTick]  = useState<number | null>(null);
  const [status,      setStatus]      = useState('Listo para girar');
  const [ticketNum,   setTicketNum]   = useState(() => String(Math.floor(10000 + Math.random() * 89999)).padStart(5, '0'));
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const segAngle = 360 / PRIZES.length;

  useEffect(() => {
    if (!isSpinning) { setActiveTick(null); return; }
    const tick = setInterval(() => { setActiveTick(i => ((i ?? -1) + 1) % PRIZES.length); }, 110);
    tickIntervalRef.current = tick;
    return () => clearInterval(tick);
  }, [isSpinning]);

  const spin = () => {
    if (isSpinning) return;
    const idx     = Math.floor(Math.random() * PRIZES.length);
    const turns   = 6 + Math.random() * 2;
    const jitter  = (Math.random() - 0.5) * (segAngle * 0.6);
    const target  = -idx * segAngle + jitter;
    const curTurn = Math.floor(rotation / 360);
    const newRot  = (curTurn + turns) * 360 + target;

    setIsSpinning(true);
    setStatus('Girando…');
    setWinnerIdx(null);
    setRotation(newRot);

    setTimeout(() => {
      setIsSpinning(false);
      setWinnerIdx(idx);
      setActiveTick(idx);
      setStatus('Premio revelado');
      setConfettiTick(c => c + 1);
      const num = String(Math.floor(10000 + Math.random() * 89999)).padStart(5, '0');
      setTicketNum(num);
      const now  = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setHistory(h => [{ time, label: PRIZES[idx].short, id: Date.now() }, ...h].slice(0, 6));
      setTimeout(() => setShowModal(true), 600);
    }, SPIN_DURATION + 60);
  };

  const closeModal  = () => { setShowModal(false); setStatus('Listo para girar'); };
  const spinAgain   = () => { setShowModal(false); setTimeout(spin, 350); };

  const ritualSteps = [
    { tag: 'T·00 · Llegada',  state: 'done' },
    { tag: 'T·01 · Cocktail', state: 'done' },
    { tag: 'T·02 · Ruleta',   state: 'on'   },
    { tag: 'T·03 · Pleno',    state: 'idle' },
    { tag: 'T·04 · Amanecer', state: 'idle' },
  ];

  const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
  const serif: React.CSSProperties = { fontFamily: "'Cormorant Garamond', serif" };

  return (
    <>
      <style>{RULETA_CSS}</style>

      <div className="animate-in fade-in duration-700">
        {/* ─── 3-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(220px,1fr)_min(520px,84vw)_minmax(220px,1fr)] gap-10 xl:gap-14 items-center">

          {/* ── LEFT · Identity ─────────────────────────────── */}
          <section className="order-2 xl:order-1 flex flex-col gap-6 xl:gap-8">

            {/* Kicker */}
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.38)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 26, height: 1, background: '#B026FF', boxShadow: '0 0 8px #B026FF', flexShrink: 0 }} />
              § R · 02 · RULETA DE LA NOCHE
            </div>

            {/* Greeting */}
            {editingName ? (
              <div className="flex flex-col gap-2">
                <div style={{ ...mono, fontSize: 10, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.35)' }}>
                  ¿Cómo te llaman?
                </div>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={guestName}
                    onChange={e => setGuestName(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && guestName.trim() && setEditingName(false)}
                    placeholder="TU NOMBRE"
                    className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white font-black text-sm uppercase tracking-widest outline-none focus:border-neon-purple/50 transition-colors"
                    style={mono}
                  />
                  <button
                    onClick={() => guestName.trim() && setEditingName(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                    style={{ background: '#EAB308', color: '#0B0316', ...mono }}
                  >
                    OK
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditingName(true)} className="text-left group">
                <div style={{ ...mono, fontSize: 11, letterSpacing: '0.32em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.38)' }}>
                  HOLA, <b style={{ color: '#EAB308', fontWeight: 700 }}>{guestName}</b>
                  <span className="opacity-0 group-hover:opacity-60 transition-opacity ml-2 text-[9px]">✎</span>
                </div>
              </button>
            )}

            {/* Headline */}
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 'clamp(38px, 5vw, 68px)', lineHeight: 0.88, letterSpacing: '-0.05em', color: '#F2F2F2', marginTop: 4 }}>
              Esta noche<br />
              la{' '}
              <em className="rl-shine-text not-italic" style={{ ...serif, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(42px, 5.5vw, 74px)' }}>suerte</em>
              <br />
              se sirve.
            </h1>

            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(242,242,242,0.55)', fontWeight: 300, maxWidth: 340 }}>
              Una sola vuelta. Ocho beneficios reales — botellas, mesas, brindis con el DJ. Lo que toque, te lo entrega el anfitrión en barra.
            </p>

            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: '1px solid rgba(242,242,242,0.06)', background: 'rgba(242,242,242,0.06)' }}>
              {[
                ['Evento',   <em style={{ ...serif, fontStyle: 'italic', fontWeight: 400, color: '#EAB308' }}>{eventName}</em>],
                ['Fecha',    eventDate],
                ['Sala',     eventVenue],
                ['Tu pase',  `№ ${ticketNum}`],
              ].map(([label, value]) => (
                <dl key={label as string} style={{ background: 'rgba(11,3,22,0.6)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <dt style={{ ...mono, fontSize: 8, letterSpacing: '0.38em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.35)', fontWeight: 500 }}>{label}</dt>
                  <dd style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#F2F2F2' }}>{value}</dd>
                </dl>
              ))}
            </div>
          </section>

          {/* ── CENTER · Wheel ───────────────────────────────── */}
          <section className="order-1 xl:order-2 flex flex-col items-center gap-6">
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.32)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ width: 36, height: 1, background: 'rgba(242,242,242,0.1)' }} />
              Tu única vuelta · {PRIZES.length} beneficios
              <span style={{ width: 36, height: 1, background: 'rgba(242,242,242,0.1)' }} />
            </div>

            <RouletteWheel
              prizes={PRIZES}
              rotation={rotation}
              isSpinning={isSpinning}
              onClick={spin}
            />

            {/* CTA label */}
            <div className="flex flex-col items-center gap-2 mt-1">
              <div style={{ ...mono, fontSize: 11, letterSpacing: '0.42em', textTransform: 'uppercase', color: '#F2F2F2', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#EAB308', animation: 'rl-bob 1.6s ease-in-out infinite' }}>↑</span>
                {isSpinning ? 'No la sueltes…' : 'TOCA EL CENTRO PARA GIRAR'}
                <span style={{ color: '#EAB308', animation: 'rl-bob 1.6s ease-in-out infinite' }}>↑</span>
              </div>
              <div style={{ ...serif, fontStyle: 'italic', fontSize: 13, color: 'rgba(242,242,242,0.4)', fontWeight: 400 }}>
                {isSpinning ? 'la noche decide' : 'la noche te espera'}
              </div>
            </div>

            {/* Status */}
            <div style={{ ...mono, fontSize: 9, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.3)', display: 'flex', alignItems: 'center', gap: 14, minHeight: 14 }}>
              <span style={{ width: 28, height: 1, background: 'rgba(242,242,242,0.07)' }} />
              STATUS · <b style={{ color: '#00FF9D', fontWeight: 500 }}>{status.toUpperCase()}</b>
              <span style={{ width: 28, height: 1, background: 'rgba(242,242,242,0.07)' }} />
            </div>
          </section>

          {/* ── RIGHT · Prizes ──────────────────────────────── */}
          <aside className="order-3 flex flex-col gap-6">

            {/* Section head */}
            <div style={{ ...mono, fontSize: 10, letterSpacing: '0.42em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.38)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 26, height: 1, background: '#EAB308', boxShadow: '0 0 8px #EAB308', flexShrink: 0 }} />
              § R · 03 · INVENTARIO
            </div>

            <div>
              <h3 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: '-0.03em', color: '#F2F2F2' }}>
                Lo que <em style={{ ...serif, fontStyle: 'italic', fontWeight: 400, color: '#EAB308' }}>se juega</em>.
              </h3>
              <p style={{ fontSize: 12, color: 'rgba(242,242,242,0.38)', lineHeight: 1.6, fontWeight: 300, marginTop: 8 }}>
                Stock real esta noche. Lo que señale la flecha, es tuyo.
              </p>
            </div>

            {/* Prize list */}
            <div style={{ borderTop: '1px solid rgba(242,242,242,0.06)' }}>
              {PRIZES.map((p, i) => {
                const isActive = activeTick === i || winnerIdx === i;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '22px 1fr auto',
                      gap: 12, alignItems: 'center',
                      padding: isActive ? '13px 10px' : '13px 4px',
                      borderBottom: '1px solid rgba(242,242,242,0.05)',
                      fontSize: 13,
                      background: isActive ? 'linear-gradient(90deg, rgba(176,38,255,0.16), transparent)' : 'transparent',
                      transition: 'background 0.25s, padding 0.2s',
                    }}
                  >
                    <span style={{ ...mono, fontSize: 10, letterSpacing: '0.15em', color: isActive ? '#B026FF' : 'rgba(242,242,242,0.3)', fontWeight: 500 }}>
                      0{i + 1}
                    </span>
                    <span style={{ color: isActive ? '#F2F2F2' : 'rgba(242,242,242,0.75)', fontWeight: 400, letterSpacing: '-0.005em' }}>
                      {p.label}
                    </span>
                    <span style={{ width: 13, height: 13, borderRadius: 2, background: CHIP_COLORS[i], border: '1px solid rgba(242,242,242,0.07)', boxShadow: isActive ? `0 0 8px ${CHIP_COLORS[i]}88` : 'none', flexShrink: 0, transition: 'box-shadow 0.3s' }} />
                  </div>
                );
              })}
            </div>

            {/* History */}
            <div style={{ position: 'relative', padding: 16, border: '1px solid rgba(242,242,242,0.07)', background: 'rgba(11,3,22,0.55)' }}>
              {[
                { style: { top: -1, left: -1, borderRight: 0, borderBottom: 0 } },
                { style: { top: -1, right: -1, borderLeft: 0, borderBottom: 0 } },
                { style: { bottom: -1, left: -1, borderRight: 0, borderTop: 0 } },
                { style: { bottom: -1, right: -1, borderLeft: 0, borderTop: 0 } },
              ].map((c, i) => (
                <span key={i} style={{ position: 'absolute', width: 7, height: 7, border: '1px solid #B026FF', ...c.style }} />
              ))}

              <div style={{ ...mono, fontSize: 9, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.3)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>HISTORIAL · ESTA NOCHE</span>
                <b style={{ color: '#00FF9D', fontWeight: 500 }}>● {history.length} GIROS</b>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', ...mono, fontSize: 10, color: 'rgba(242,242,242,0.55)' }}>
                {history.length === 0 ? (
                  <div style={{ ...serif, fontStyle: 'italic', fontSize: 12, color: 'rgba(242,242,242,0.3)', padding: '6px 0' }}>
                    Aún nadie ha girado. Sé tú.
                  </div>
                ) : history.map(h => (
                  <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px dashed rgba(242,242,242,0.05)' }}>
                    <time style={{ color: 'rgba(242,242,242,0.3)' }}>{h.time}</time>
                    <span style={{ color: '#F2F2F2', fontWeight: 400 }}>{h.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Ritual line ─────────────────────────────────── */}
          <div className="order-4 xl:col-span-3 xl:border-t xl:border-white/[0.04] xl:pt-6 mt-4 hidden xl:flex items-center justify-between">
            {ritualSteps.map((s, i) => (
              <React.Fragment key={i}>
                <div style={{ ...mono, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: s.state === 'on' ? '#B026FF' : s.state === 'done' ? '#00FF9D' : 'rgba(242,242,242,0.1)',
                    boxShadow: s.state === 'on' ? '0 0 10px #B026FF' : s.state === 'done' ? '0 0 8px #00FF9D' : 'none',
                  }} />
                  {s.tag}
                </div>
                {i < ritualSteps.length - 1 && <div style={{ flex: 1, height: 1, background: 'rgba(242,242,242,0.06)', margin: '0 12px' }} />}
              </React.Fragment>
            ))}
          </div>

        </div>
      </div>

      {/* ── Prize Modal ── */}
      {showModal && (
        <PrizeModal
          prize={winnerIdx !== null ? PRIZES[winnerIdx] : null}
          guestName={guestName}
          eventName={eventName}
          eventDate={eventDate}
          eventVenue={eventVenue}
          ticketNum={ticketNum}
          onClose={closeModal}
          onSpinAgain={spinAgain}
        />
      )}

      <Confetti trigger={confettiTick} />
    </>
  );
};
