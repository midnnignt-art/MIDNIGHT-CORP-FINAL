import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Benefit { id: number; label: string; color: string; prob: number; }
interface Campaign { id: string; label: string; event_id: string; benefits: Benefit[] | null; benefit_valid_hours: number; }
interface EventInfo { id: string; title: string; venue: string; }
type View = 'landing' | 'form' | 'wheel' | 'result';

const FALLBACK: Benefit[] = [
  { id: 1, label: '2x1 en tragos',    color: '#C9A84C', prob: 30 },
  { id: 2, label: 'Shot gratis',       color: '#490F7C', prob: 25 },
  { id: 3, label: 'Mesa VIP 30 min',  color: '#C9A84C', prob: 10 },
  { id: 4, label: 'Entrada sin fila', color: '#490F7C', prob: 20 },
  { id: 5, label: 'Botella a mitad',  color: '#C9A84C', prob:  5 },
  { id: 6, label: 'Trago de la casa', color: '#490F7C', prob: 10 },
];

// Paleta Midnight para los segmentos de la ruleta — elegante, no saturada
const SEGMENT_PALETTE = [
  { bg: '#1A0829', accent: '#490F7C' },
  { bg: '#110808', accent: '#C9A84C' },
  { bg: '#0A0F1E', accent: '#490F7C' },
  { bg: '#1C1005', accent: '#C9A84C' },
  { bg: '#120520', accent: '#490F7C' },
  { bg: '#0D0D0D', accent: '#C9A84C' },
  { bg: '#180B2A', accent: '#490F7C' },
  { bg: '#131008', accent: '#C9A84C' },
];

function weightedRandom(list: Benefit[]): Benefit {
  const total = list.reduce((s, b) => s + b.prob, 0);
  let r = Math.random() * total;
  for (const b of list) { r -= b.prob; if (r <= 0) return b; }
  return list[list.length - 1];
}

// ── Canvas Wheel ───────────────────────────────────────────────────────────────
function Wheel({ benefits, onResult, disabled }: {
  benefits: Benefit[];
  onResult: (b: Benefit) => void;
  disabled: boolean;
}) {
  const cvs  = useRef<HTMLCanvasElement>(null);
  const rot  = useRef(0);
  const raf  = useRef<number | null>(null);
  const tick = useRef(-1);
  const [spinning,  setSpinning]  = useState(false);
  const [shaking,   setShaking]   = useState(false);
  const [resultColor, setResultColor] = useState('#C9A84C');
  const [showBurst,   setShowBurst]   = useState(false);

  const N  = Math.max(benefits.length, 1);
  const sl = (2 * Math.PI) / N;
  const S  = typeof window !== 'undefined' && window.innerWidth < 420 ? 280 : 320;

  const drawWheel = useCallback((angle: number, pulse = 0) => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const cx = c.width / 2, cy = c.height / 2, R = cx - 4;
    ctx.clearRect(0, 0, c.width, c.height);

    // Outer ring glow
    if (pulse > 0) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${pulse * 0.5})`;
      ctx.lineWidth = 6; ctx.shadowColor = '#C9A84C';
      ctx.shadowBlur = 20 * pulse; ctx.stroke(); ctx.restore();
    }

    // Segments
    benefits.forEach((b, i) => {
      const { bg, accent } = SEGMENT_PALETTE[i % SEGMENT_PALETTE.length];
      const startA = angle + i * sl;
      const endA   = startA + sl;

      // Segment fill — dark radial gradient
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startA, endA);
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      g.addColorStop(0,   bg + 'FF');
      g.addColorStop(0.6, bg + 'EE');
      g.addColorStop(1,   accent + '44');
      ctx.fillStyle = g;
      ctx.fill();

      // Segment separator line
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, startA, startA);
      const x2 = cx + Math.cos(startA) * R;
      const y2 = cy + Math.sin(startA) * R;
      ctx.moveTo(cx, cy); ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(201,168,76,0.2)';
      ctx.lineWidth = 1; ctx.stroke(); ctx.restore();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startA + sl / 2);
      ctx.textAlign = 'right';
      ctx.font = `400 11px 'Cormorant Garamond', serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur  = 6;
      ctx.fillText(b.label, R - 12, 4);
      ctx.restore();
    });

    // Outer border ring — gold
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,168,76,0.35)';
    ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();

    // Inner decorative ring
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,168,76,0.15)';
    ctx.lineWidth = 1; ctx.stroke(); ctx.restore();

    // Center hub
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    const hub = ctx.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 22);
    hub.addColorStop(0, '#2A1A06');
    hub.addColorStop(0.5, '#1A0E04');
    hub.addColorStop(1, '#0A0804');
    ctx.fillStyle = hub;
    ctx.shadowColor = 'rgba(201,168,76,0.3)';
    ctx.shadowBlur  = 12 + pulse * 8;
    ctx.fill(); ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201,168,76,${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 1; ctx.stroke(); ctx.restore();

    // M letter
    ctx.save();
    ctx.font = 'bold 900 14px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(201,168,76,${0.7 + pulse * 0.3})`;
    ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 4 + pulse * 6;
    ctx.fillText('M', cx, cy + 1); ctx.restore();
  }, [benefits, sl]);

  useEffect(() => { drawWheel(rot.current); }, [benefits, drawWheel]);

  function spin() {
    if (spinning || disabled || N < 2) return;
    setSpinning(true);
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);

    const winner = weightedRandom(benefits);
    const wi     = benefits.findIndex(b => b.id === winner.id);
    const target = -Math.PI / 2 - (wi * sl + sl / 2);
    const turns  = (5 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
    const sr     = rot.current;
    const norm   = ((target % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sn     = ((sr   % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let d = norm - sn; if (d < 0) d += Math.PI * 2;
    const fr = sr + turns + d;
    const dur = 5800, t0 = performance.now();
    tick.current = -1;

    function ease(t: number) { return 1 - Math.pow(1 - t, 4); }
    function frame(now: number) {
      const prog = Math.min((now - t0) / dur, 1);
      const cur  = sr + (fr - sr) * ease(prog);
      rot.current = cur;
      const vel  = Math.min((1 - Math.pow(1 - prog, 3)) * 0.7, 1);
      const pulse = prog < 0.85 ? vel * 0.5 : 0;
      const cs = Math.floor(((cur % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / sl);
      if (cs !== tick.current) {
        tick.current = cs;
        if (prog < 0.88 && navigator.vibrate) navigator.vibrate([3]);
      }
      drawWheel(cur, pulse);
      if (prog < 1) {
        raf.current = requestAnimationFrame(frame);
      } else {
        drawWheel(cur, 0);
        setSpinning(false);
        setShaking(true);
        setTimeout(() => setShaking(false), 500);
        setResultColor(SEGMENT_PALETTE[wi % SEGMENT_PALETTE.length].accent);
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 1200);
        if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 120]);
        setTimeout(() => onResult(winner), 800);
      }
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(frame);
  }

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Ambient glow under wheel */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: S + 60, height: S + 60, borderRadius: '50%', background: `radial-gradient(circle, ${spinning ? 'rgba(201,168,76,0.06)' : 'rgba(73,15,124,0.08)'} 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 1s', zIndex: 0 }} />

      {/* Burst ring on win */}
      {showBurst && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: S + 20, height: S + 20, borderRadius: '50%', border: `1px solid ${resultColor}40`, animation: 'wl_burst .8s ease forwards', pointerEvents: 'none', zIndex: 10 }} />
      )}

      {/* Needle */}
      <div style={{ position: 'relative', zIndex: 15, marginBottom: -10, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>
        <svg width="20" height="28" viewBox="0 0 20 28">
          <defs>
            <linearGradient id="ndg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8CC6A"/>
              <stop offset="100%" stopColor="#7A5A18"/>
            </linearGradient>
          </defs>
          <polygon points="10,26 1,0 19,0" fill="url(#ndg)"/>
          <circle cx="10" cy="5" r="3.5" fill="#C9A84C"/>
          <circle cx="10" cy="5" r="1.5" fill="#050505"/>
        </svg>
      </div>

      {/* Wheel canvas */}
      <div
        onClick={spin}
        style={{
          position: 'relative', zIndex: 5, borderRadius: '50%',
          animation: shaking ? 'wl_shake .4s ease' : 'none',
          cursor: spinning || disabled ? 'default' : 'pointer',
          boxShadow: '0 0 0 1px rgba(201,168,76,0.12), 0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        <canvas ref={cvs} width={S} height={S} style={{ display: 'block', borderRadius: '50%' }} />
      </div>

      {/* Tap hint */}
      {!spinning && !disabled && (
        <p style={{ marginTop: 18, fontSize: 9, fontWeight: 700, letterSpacing: 3, color: 'rgba(201,168,76,0.5)', textTransform: 'uppercase', animation: 'wl_fade 2s ease-in-out infinite alternate' }}>
          Toca para girar
        </p>
      )}
      {spinning && (
        <p style={{ marginTop: 18, fontSize: 9, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>
          Girando...
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
const PromoLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  const [state,    setState]    = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ev,       setEv]       = useState<EventInfo | null>(null);
  const [view,     setView]     = useState<View>('landing');
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [errors,   setErrors]   = useState<{ name?: string; email?: string }>({});
  const [result,   setResult]   = useState<Benefit | null>(null);
  const [hasSpun,  setHasSpun]  = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(null);

  useEffect(() => {
    supabase.from('campaigns')
      .select('id,label,event_id,benefits,benefit_valid_hours')
      .eq('code', codigo).eq('type', 'ruleta').eq('active', true)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setState('invalid'); return; }
        setCampaign(data as Campaign);
        const { data: e } = await supabase.from('events')
          .select('id,title,venue')
          .eq('id', data.event_id).maybeSingle();
        setEv(e as EventInfo);
        setState('ready');
      });
  }, [codigo]);

  const benefits = campaign?.benefits?.length ? campaign.benefits : FALLBACK;

  function alreadySpun(e: string) {
    return !!(JSON.parse(localStorage.getItem(`ms_${codigo}`) || '{}')[e.toLowerCase().trim()]);
  }

  function validate() {
    const e: { name?: string; email?: string } = {};
    if (name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = 'Ingresa nombre y apellido completos';
    if (!email.trim().includes('@')) e.email = 'Email inválido';
    else if (alreadySpun(email)) e.email = 'Este correo ya participó en esta promoción';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleResult(benefit: Benefit) {
    setResult(benefit); setHasSpun(true);
    const dl = new Date(Date.now() + (campaign?.benefit_valid_hours ?? 12) * 3600000);
    setDeadline(dl);
    const obj = JSON.parse(localStorage.getItem(`ms_${codigo}`) || '{}');
    obj[email.toLowerCase().trim()] = { benefit: benefit.label, ts: Date.now() };
    localStorage.setItem(`ms_${codigo}`, JSON.stringify(obj));
    await supabase.from('campaign_leads').insert({
      campaign_id: campaign!.id, event_id: campaign!.event_id,
      name: name.trim(), email: email.toLowerCase().trim(),
      benefit: benefit.label, benefit_color: benefit.color,
    });
    setTimeout(() => setView('result'), 800);
  }

  const fmtDl = (d: Date) =>
    d.toLocaleString('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

  // ── Shared CSS ───────────────────────────────────────────────────────────────
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes wl_in    { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
    @keyframes wl_shake { 0%,100%{transform:rotate(0)} 20%{transform:rotate(-1.5deg)} 60%{transform:rotate(1.5deg)} }
    @keyframes wl_burst { 0%{opacity:.8;transform:translate(-50%,-50%) scale(.9)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)} }
    @keyframes wl_fade  { from{opacity:.35} to{opacity:.65} }
    @keyframes wl_pop   { 0%{transform:scale(.6);opacity:0} 70%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
    @keyframes wl_float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes wl_dot   { 0%,100%{opacity:1} 50%{opacity:.2} }
    @keyframes wl_shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes spin     { to { transform: rotate(360deg) } }

    input::placeholder { color: rgba(255,255,255,0.18) }
    input:focus        { border-color: rgba(201,168,76,0.5) !important; outline: none; box-shadow: 0 0 0 3px rgba(201,168,76,0.07) }

    .wl-cta {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 14px 36px; border-radius: 50px; border: none; cursor: pointer;
      font-family: Inter, sans-serif; font-size: 11px; font-weight: 700;
      letter-spacing: 2.5px; text-transform: uppercase;
      background: linear-gradient(90deg, #C9A84C, #E8CC6A, #C9A84C);
      background-size: 200%; color: #0A0A0A;
      box-shadow: 0 4px 24px rgba(201,168,76,0.2);
      transition: opacity .2s ease, transform .15s ease, box-shadow .2s ease;
      animation: wl_shimmer 3s linear infinite;
    }
    .wl-cta:hover  { opacity:.9; transform:translateY(-2px); box-shadow: 0 8px 32px rgba(201,168,76,0.3); }
    .wl-cta:active { transform:translateY(0); }
    .wl-cta:disabled { opacity:.45; cursor:default; animation:none; }
  `;

  // ── Layout shells ────────────────────────────────────────────────────────────
  const root: React.CSSProperties = {
    minHeight: '100vh', background: '#050505',
    fontFamily: 'Inter, sans-serif', color: '#F2F2F2',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  };
  const card: React.CSSProperties = {
    position: 'relative', zIndex: 2,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    width: '100%', maxWidth: 460, padding: '48px 28px',
    animation: 'wl_in .6s ease both',
  };

  // ── Logo ─────────────────────────────────────────────────────────────────────
  const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div style={{ marginBottom: size === 'sm' ? 28 : 40 }}>
      <div style={{
        fontSize: size === 'sm' ? 22 : 26,
        fontWeight: 900, letterSpacing: '-0.1em',
        color: '#fff', lineHeight: 1, textAlign: 'center',
      }}>MIDNIGHT</div>
      <div style={{
        fontSize: 7, fontWeight: 300, letterSpacing: '0.8em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        marginTop: 4, textAlign: 'center', marginLeft: '0.8em',
      }}>Worldwide</div>
    </div>
  );

  const Divider = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 240, opacity: .15, marginTop: 40 }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
      <span style={{ fontSize: 8, letterSpacing: 4, color: '#C9A84C', fontWeight: 700 }}>MC</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
    </div>
  );

  const inp: React.CSSProperties = {
    width: '100%', display: 'block',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10, padding: '13px 16px',
    color: '#F2F2F2', fontSize: 15,
    fontFamily: "'Cormorant Garamond', serif",
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (state === 'loading') return (
    <div style={{ ...root, gap: 24 }}>
      <style>{CSS}</style>
      <Logo />
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.08)', borderTopColor: '#C9A84C', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  // ── Invalid ───────────────────────────────────────────────────────────────────
  if (state === 'invalid') return (
    <div style={{ ...root, gap: 0 }}>
      <style>{CSS}</style>
      <div style={card}>
        <Logo />
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginTop: 12 }}>Promoción no disponible</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)', marginTop: 8 }}>Este link no existe o fue desactivado.</p>
      </div>
    </div>
  );

  // ── Background decoration ─────────────────────────────────────────────────────
  const BG = () => (
    <>
      <div style={{ position: 'fixed', top: '-20%', left: '-20%', width: '70vw', height: '70vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,15,124,0.12) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-25%', right: '-15%', width: '65vw', height: '65vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0 }} />
    </>
  );

  return (
    <div style={root}>
      <style>{CSS}</style>
      <BG />

      {/* ── LANDING ─────────────────────────────────────────────────────────── */}
      {view === 'landing' && (
        <div style={card}>
          <Logo />

          {ev && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 50, background: 'rgba(73,15,124,0.18)', border: '1px solid rgba(73,15,124,0.35)', marginBottom: 32 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C9A84C', display: 'block', animation: 'wl_dot 1.8s ease-in-out infinite' }} />
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C' }}>
                {ev.title}{ev.venue ? ` · ${ev.venue}` : ''}
              </span>
            </div>
          )}

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(36px,8vw,54px)',
            fontWeight: 300, fontStyle: 'italic',
            lineHeight: 1.1, letterSpacing: -0.5,
            color: '#F2F2F2', marginBottom: 12,
          }}>
            La noche tiene<br />
            <span style={{ color: '#C9A84C', fontWeight: 400 }}>algo para ti.</span>
          </h1>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7, marginBottom: 36, maxWidth: 280, fontWeight: 300 }}>
            Gira la ruleta y descubre tu beneficio exclusivo de esta noche.
          </p>

          <button className="wl-cta" onClick={() => setView('form')}>
            Girar la ruleta
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <p style={{ marginTop: 14, fontSize: 9, color: 'rgba(255,255,255,0.12)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 500 }}>
            Un giro por persona · Solo esta noche
          </p>

          <Divider />
        </div>
      )}

      {/* ── FORM ────────────────────────────────────────────────────────────── */}
      {view === 'form' && (
        <div style={card}>
          <button
            onClick={() => setView('landing')}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', padding: 0, marginBottom: 36, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Volver
          </button>

          <Logo size="sm" />

          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, marginBottom: 6, letterSpacing: -0.3 }}>
            Regístrate para girar
          </h2>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32, fontWeight: 600 }}>
            Un giro por persona
          </p>

          {/* Name */}
          <div style={{ width: '100%', marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
              Nombre completo
            </label>
            <input
              autoFocus
              placeholder="Ej: Valeria Moreno"
              value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
              style={{ ...inp, borderColor: errors.name ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.09)' }}
            />
            {errors.name && <p style={{ color: '#FF7070', fontSize: 10, marginTop: 6, fontWeight: 500 }}>↑ {errors.name}</p>}
          </div>

          {/* Email */}
          <div style={{ width: '100%', marginBottom: 10, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="Ej: valeria@correo.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
              onKeyDown={e => e.key === 'Enter' && go()}
              style={{ ...inp, borderColor: errors.email ? 'rgba(255,80,80,0.5)' : 'rgba(255,255,255,0.09)' }}
            />
            {errors.email && <p style={{ color: '#FF7070', fontSize: 10, marginTop: 6, fontWeight: 500 }}>↑ {errors.email}</p>}
          </div>

          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.1)', letterSpacing: 1.5, marginBottom: 28, fontWeight: 500 }}>
            🔒 Solo para validar tu giro único. Sin spam.
          </p>

          <button className="wl-cta" onClick={go}>
            Ir a la ruleta
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── WHEEL ───────────────────────────────────────────────────────────── */}
      {view === 'wheel' && (
        <div style={{ ...card, padding: '36px 24px' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, fontStyle: 'italic', marginBottom: 4, color: 'rgba(255,255,255,0.8)' }}>
            {name.split(' ')[0]}, es tu momento.
          </p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: 3, marginBottom: 28, textTransform: 'uppercase', fontWeight: 700 }}>
            La noche decide
          </p>
          <Wheel benefits={benefits} onResult={handleResult} disabled={hasSpun} />
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────────────────────── */}
      {view === 'result' && result && (
        <div style={{ ...card, position: 'relative' }}>
          {/* Subtle bg tint */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 40%, rgba(201,168,76,0.06), transparent 65%)', pointerEvents: 'none' }} />

          <Logo size="sm" />

          {/* Trophy */}
          <div style={{ fontSize: 48, marginBottom: 12, animation: 'wl_float 3.5s ease-in-out infinite', filter: 'drop-shadow(0 0 16px rgba(201,168,76,0.4))' }}>
            🏆
          </div>

          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, color: 'rgba(201,168,76,0.5)', textTransform: 'uppercase', marginBottom: 8 }}>
            Ganaste
          </p>

          {/* Prize card */}
          <div style={{
            border: '1px solid rgba(201,168,76,0.2)',
            borderRadius: 16, padding: '18px 32px',
            background: 'rgba(201,168,76,0.04)',
            marginBottom: 16, animation: 'wl_pop .5s ease .1s both',
            width: '100%', maxWidth: 340,
          }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#C9A84C', lineHeight: 1.2 }}>
              {result.label}
            </p>
          </div>

          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: 2.5, marginBottom: 24, fontWeight: 600, textTransform: 'uppercase' }}>
            {name.toUpperCase()}
          </p>

          {/* Instructions */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px', maxWidth: 360, display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🎟</span>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75 }}>
              Presenta tu nombre <strong style={{ color: '#F2F2F2', fontWeight: 600 }}>{name.split(' ')[0]}</strong> en la barra para reclamar tu beneficio.
              {deadline && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  Válido hasta el {fmtDl(deadline)}
                </div>
              )}
            </div>
          </div>

          <Divider />
        </div>
      )}
    </div>
  );

  function go() { if (validate()) setView('wheel'); }
};

export default PromoLanding;
