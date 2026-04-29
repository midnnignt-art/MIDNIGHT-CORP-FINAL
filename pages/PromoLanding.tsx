import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

interface Benefit { id: number; label: string; color: string; prob: number; }
interface Campaign { id: string; label: string; event_id: string; benefits: Benefit[] | null; benefit_valid_hours: number; }
interface EventInfo { id: string; title: string; venue: string; }
type View = 'landing' | 'form' | 'wheel' | 'result';

const FALLBACK: Benefit[] = [
  { id: 1, label: '2x1 en tragos',    color: '#C9A84C', prob: 30 },
  { id: 2, label: 'Shot gratis',       color: '#8B1A1A', prob: 25 },
  { id: 3, label: 'Mesa VIP 30 min',  color: '#1A1A4E', prob: 10 },
  { id: 4, label: 'Entrada sin fila', color: '#2D5A27', prob: 20 },
  { id: 5, label: 'Botella a mitad',  color: '#4A2060', prob:  5 },
  { id: 6, label: 'Trago de la casa', color: '#8B5A1A', prob: 10 },
];

function weightedRandom(list: Benefit[]): Benefit {
  const total = list.reduce((s, b) => s + b.prob, 0);
  let r = Math.random() * total;
  for (const b of list) { r -= b.prob; if (r <= 0) return b; }
  return list[list.length - 1];
}

// ── Particles ─────────────────────────────────────────────────────────────────
function Particles({ trigger, color }: { trigger: number | null; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef<any[]>([]);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!trigger) return;
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    pts.current = [];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
      pts.current.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - Math.random() * 4, life: 1, decay: .013 + Math.random() * .018, size: 2 + Math.random() * 5, color: [color, '#C9A84C', '#FFF', '#490F7C'][Math.floor(Math.random() * 4)] });
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.current = pts.current.filter(p => p.life > 0);
      for (const p of pts.current) {
        ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        p.x += p.vx; p.y += p.vy; p.vy += .15; p.life -= p.decay; p.size *= .97;
      }
      if (pts.current.length > 0) raf.current = requestAnimationFrame(draw);
    }
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  }, [trigger]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }} />;
}

// ── Wheel ─────────────────────────────────────────────────────────────────────
function Wheel({ benefits, onResult, disabled }: { benefits: Benefit[]; onResult: (b: Benefit) => void; disabled: boolean }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0), rafRef = useRef<number | null>(null), tickRef = useRef(-1);
  const [spinning, setSpinning] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [burst, setBurst] = useState<number | null>(null);
  const [burstColor, setBurstColor] = useState('#C9A84C');
  const S = 320, sl = (2 * Math.PI) / Math.max(benefits.length, 1);

  const draw = useCallback((rot: number, pulse = 0) => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const cx = c.width / 2, cy = c.height / 2, r = cx - 12;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201,168,76,${.25 + pulse * .6})`; ctx.lineWidth = 2 + pulse * 5;
    ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 15 + pulse * 50; ctx.stroke(); ctx.restore();
    for (let i = 0; i < 30; i++) {
      const a = rot * .3 + (i / 30) * Math.PI * 2, dr = r + 18;
      ctx.save(); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dr, cy + Math.sin(a) * dr, i % 5 === 0 ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 5 === 0 ? '#C9A84C' : '#2A2A2A';
      if (i % 5 === 0) { ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 8; }
      ctx.fill(); ctx.restore();
    }
    benefits.forEach((b, i) => {
      const st = rot + i * sl, en = st + sl;
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, st, en); ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, r * .15, cx, cy, r);
      g.addColorStop(0, b.color + 'EE'); g.addColorStop(1, b.color + '77');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#050505'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(st);
      ctx.beginPath(); ctx.moveTo(r * .22, 0); ctx.lineTo(r * .92, 0);
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(st + sl / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#F5F0E8';
      ctx.font = `bold 13px 'Cormorant Garamond',serif`;
      ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 8;
      ctx.fillText(b.label, r - 16, 5); ctx.restore();
    });
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * .23, 0, Math.PI * 2); ctx.strokeStyle = '#C9A84C33'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, 26);
    hg.addColorStop(0, '#F0D070'); hg.addColorStop(.5, '#C9A84C'); hg.addColorStop(1, '#5A3A08');
    ctx.fillStyle = hg; ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 25 + pulse * 25; ctx.fill(); ctx.restore();
    ctx.save(); ctx.fillStyle = '#0A0A0A'; ctx.font = 'bold 17px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', cx, cy); ctx.restore();
  }, [benefits, sl]);

  useEffect(() => { draw(rotRef.current); }, [benefits, draw]);

  function spin() {
    if (spinning || disabled || benefits.length < 2) return;
    setSpinning(true); if (navigator.vibrate) navigator.vibrate([30]);
    const winner = weightedRandom(benefits), wi = benefits.findIndex(b => b.id === winner.id);
    const target = -Math.PI / 2 - (wi * sl + sl / 2);
    const full = (6 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
    const sr = rotRef.current, norm = ((target % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sn = ((sr % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let d = norm - sn; if (d < 0) d += Math.PI * 2;
    const fr = sr + full + d, dur = 6200, t0 = performance.now();
    tickRef.current = -1;
    function ease(t: number) { return 1 - Math.pow(1 - t, 4); }
    function frame(now: number) {
      const prog = Math.min((now - t0) / dur, 1), ep = ease(prog);
      const cur = sr + (fr - sr) * ep; rotRef.current = cur;
      const vel = (1 - Math.pow(1 - prog, 3)) * .8, pulse = prog < .85 ? Math.min(vel * .6, 1) : 0;
      const cs = Math.floor(((cur % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / sl);
      if (cs !== tickRef.current) { tickRef.current = cs; if (prog < .88 && navigator.vibrate) navigator.vibrate([4]); }
      draw(cur, pulse);
      if (prog < 1) { rafRef.current = requestAnimationFrame(frame); }
      else {
        draw(cur, 0); setSpinning(false); setShaking(true); setTimeout(() => setShaking(false), 600);
        setBurstColor(winner.color); setBurst(Date.now());
        if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 150]);
        setTimeout(() => onResult(winner), 900);
      }
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(frame);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: S + 80, height: S + 80, borderRadius: '50%', zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(circle,#C9A84C0C 0%,transparent 65%)', animation: spinning ? 'pl_glow .5s ease-in-out infinite alternate' : 'none' }} />
      <div style={{ position: 'relative', zIndex: 15, marginBottom: -8, filter: 'drop-shadow(0 0 10px #C9A84C) drop-shadow(0 4px 8px rgba(0,0,0,.9))', animation: spinning ? 'pl_needle .12s ease-in-out infinite alternate' : 'none' }}>
        <svg width="26" height="32" viewBox="0 0 32 40">
          <defs><linearGradient id="plng" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0D070"/><stop offset="100%" stopColor="#8B6914"/></linearGradient></defs>
          <polygon points="16,38 2,0 30,0" fill="url(#plng)"/><polygon points="16,38 2,0 30,0" fill="none" stroke="#050505" strokeWidth="1.5"/>
          <circle cx="16" cy="6" r="5" fill="#C9A84C"/><circle cx="16" cy="6" r="2" fill="#0A0A0A"/>
        </svg>
      </div>
      <div onClick={spin} style={{ position: 'relative', zIndex: 5, borderRadius: '50%', boxShadow: spinning ? '0 0 80px #C9A84C66,0 0 160px #C9A84C22' : '0 0 40px #C9A84C44,0 0 80px #C9A84C18', animation: shaking ? 'pl_shake .5s ease-in-out' : 'none', cursor: spinning || disabled ? 'not-allowed' : 'pointer', transition: 'box-shadow .4s' }}>
        <canvas ref={cvs} width={S} height={S} style={{ display: 'block', borderRadius: '50%' }} />
        <Particles trigger={burst} color={burstColor} />
      </div>
      {!spinning && !disabled && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' }}>
          <span style={{ animation: 'pl_tap 1.3s ease-in-out infinite', fontSize: 16 }}>👆</span> Toca para girar
        </div>
      )}
      {spinning && <div style={{ marginTop: 16, color: '#C9A84C99', fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: 3, animation: 'pl_blink .7s step-end infinite' }}>● GIRANDO...</div>}
    </div>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function MidnightLogo() {
  return (
    <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ display: 'block', fontSize: 28, fontWeight: 900, letterSpacing: '-0.1em', color: '#fff', fontFamily: "'Space Mono',sans-serif", lineHeight: 1 }}>MIDNIGHT</span>
      <span style={{ display: 'block', fontSize: 7, fontWeight: 300, letterSpacing: '0.8em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: 3, fontFamily: "'Space Mono',monospace" }}>Worldwide</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
        const { data: e } = await supabase.from('events').select('id,title,venue').eq('id', data.event_id).maybeSingle();
        setEv(e as EventInfo);
        setState('ready');
      });
  }, [codigo]);

  const benefits = campaign?.benefits?.length ? campaign.benefits : FALLBACK;

  function alreadySpun(e: string) {
    const obj = JSON.parse(localStorage.getItem(`ms_${codigo}`) || '{}');
    return !!obj[e.toLowerCase().trim()];
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
    await supabase.from('campaign_leads').insert({ campaign_id: campaign!.id, event_id: campaign!.event_id, name: name.trim(), email: email.toLowerCase().trim(), benefit: benefit.label, benefit_color: benefit.color });
    setTimeout(() => setView('result'), 900);
  }

  const fmtDl = (d: Date) => d.toLocaleString('es-CO', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const mono: React.CSSProperties = { fontFamily: "'Space Mono',monospace" };

  const root: React.CSSProperties = {
    minHeight: '100vh',
    background: '#050505',
    fontFamily: "'Cormorant Garamond',Georgia,serif",
    color: '#F5F0E8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };
  const wrap: React.CSSProperties = {
    position: 'relative', zIndex: 2,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    maxWidth: 520, width: '100%', padding: '40px 24px',
  };
  const inp: React.CSSProperties = {
    width: '100%', background: '#0A0A0A',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '14px 16px',
    color: '#F5F0E8', fontSize: 15,
    fontFamily: "'Cormorant Garamond',serif",
    display: 'block', boxSizing: 'border-box',
  };
  const cta: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'linear-gradient(135deg,#C9A84C 0%,#A07820 50%,#C9A84C 100%)',
    backgroundSize: '200% 100%',
    color: '#0A0A0A', border: 'none', borderRadius: 50,
    padding: '14px 32px', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', letterSpacing: 2.5,
    fontFamily: "'Space Mono',monospace",
    boxShadow: '0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(201,168,76,0.1)',
    transition: 'opacity .2s',
  };

  if (state === 'loading') return (
    <div style={{ ...root, flexDirection: 'column', gap: 24 }}>
      <MidnightLogo />
      <Loader2 style={{ width: 28, height: 28, color: '#C9A84C', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (state === 'invalid') return (
    <div style={{ ...root, flexDirection: 'column', padding: 32, textAlign: 'center', gap: 0 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');`}</style>
      <MidnightLogo />
      <div style={{ fontSize: 40, marginBottom: 16 }}>✗</div>
      <h1 style={{ color: '#fff', fontFamily: "'Space Mono',monospace", fontSize: 16, fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 3 }}>Promoción no disponible</h1>
      <p style={{ color: 'rgba(255,255,255,0.2)', ...mono, fontSize: 10, letterSpacing: 2 }}>Este link no existe o fue desactivado.</p>
    </div>
  );

  return (
    <div style={root}>
      {/* Background layers */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 80% 60% at 20% 80%, rgba(73,15,124,0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 20%, rgba(201,168,76,0.06), transparent 50%)' }} />
      <div style={{ position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 400, borderRadius: '50%', zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(circle,rgba(201,168,76,0.04) 0%,transparent 65%)' }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes pl_glow   { from{opacity:.5;transform:translate(-50%,-50%) scale(.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1.06)} }
        @keyframes pl_needle { from{transform:rotate(-4deg)} to{transform:rotate(4deg)} }
        @keyframes pl_shake  { 0%{transform:translate(0,0)} 20%{transform:translate(-5px,0)} 40%{transform:translate(5px,0)} 60%{transform:translate(-3px,0)} 80%{transform:translate(3px,0)} 100%{transform:translate(0,0)} }
        @keyframes pl_tap    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pl_blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pl_in     { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pl_pop    { 0%{transform:scale(.4);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes pl_float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes pl_pulse_dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        input::placeholder   { color:rgba(255,255,255,0.12) }
        input:focus          { border-color:rgba(201,168,76,0.5)!important;outline:none;box-shadow:0 0 0 3px rgba(201,168,76,0.06) }
        .pl-cta:hover        { opacity:.85 }
      `}</style>

      {/* LANDING */}
      {view === 'landing' && (
        <div style={{ ...wrap, animation: 'pl_in .8s ease' }}>
          <MidnightLogo />

          {/* Live badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, background: 'rgba(73,15,124,0.15)', border: '1px solid rgba(73,15,124,0.3)', borderRadius: 50, padding: '6px 16px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C', animation: 'pl_pulse_dot 1.5s ease-in-out infinite' }} />
            <span style={{ ...mono, fontSize: 9, letterSpacing: '0.35em', color: '#C9A84C', textTransform: 'uppercase' }}>
              {ev ? `${ev.title}${ev.venue ? ` · ${ev.venue}` : ''}` : 'Promoción activa'}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px,5vw,46px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 12px', letterSpacing: -.5 }}>
            La noche tiene<br /><em style={{ color: '#C9A84C', fontStyle: 'italic', fontWeight: 400 }}>algo para ti.</em>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 1.7, marginBottom: 36, maxWidth: 320, fontWeight: 300 }}>
            Gira la ruleta y desbloquea tu beneficio exclusivo de esta noche.
          </p>

          <button className="pl-cta" onClick={() => setView('form')} style={cta}>
            <span>Girar la ruleta</span><span style={{ fontSize: 14 }}>→</span>
          </button>

          <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: 2, ...mono, textTransform: 'uppercase' }}>
            Solo válido esta noche · Un giro por persona
          </p>

          {/* Decorative divider */}
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 300, opacity: .15 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
            <span style={{ ...mono, fontSize: 8, letterSpacing: 3, color: '#C9A84C' }}>MC</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
          </div>
        </div>
      )}

      {/* FORM */}
      {view === 'form' && (
        <div style={{ ...wrap, animation: 'pl_in .5s ease' }}>
          <button onClick={() => setView('landing')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(201,168,76,0.5)', cursor: 'pointer', fontSize: 10, ...mono, marginBottom: 32, padding: 0, letterSpacing: 2, textTransform: 'uppercase' }}>← Volver</button>

          <MidnightLogo />

          <h2 style={{ fontSize: 26, fontWeight: 300, margin: '0 0 6px', letterSpacing: -.3 }}>Regístrate para girar</h2>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginBottom: 32, ...mono, letterSpacing: 1 }}>DOS DATOS · UN GIRO · UNA NOCHE DIFERENTE</p>

          <div style={{ width: '100%', maxWidth: 400, marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', ...mono, marginBottom: 8, textTransform: 'uppercase' }}>Nombre completo</label>
            <input autoFocus placeholder="Ej: Valeria Moreno" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} style={{ ...inp, borderColor: errors.name ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.08)' }} />
            {errors.name && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '6px 0 0', ...mono }}>⚠ {errors.name}</p>}
          </div>
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 8, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', ...mono, marginBottom: 8, textTransform: 'uppercase' }}>Correo electrónico</label>
            <input type="email" placeholder="Ej: valeria@correo.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }} onKeyDown={e => e.key === 'Enter' && go()} style={{ ...inp, borderColor: errors.email ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.08)' }} />
            {errors.email && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '6px 0 0', ...mono }}>⚠ {errors.email}</p>}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.1)', fontSize: 9, letterSpacing: 1.5, ...mono, marginBottom: 28, maxWidth: 380, textAlign: 'center' }}>🔒 Solo usamos tu correo para validar tu giro único.</p>
          <button className="pl-cta" onClick={go} style={cta}><span>Ir a la ruleta</span><span style={{ fontSize: 14 }}>→</span></button>
        </div>
      )}

      {/* WHEEL */}
      {view === 'wheel' && (
        <div style={{ ...wrap, animation: 'pl_in .5s ease' }}>
          <h2 style={{ fontSize: 22, fontWeight: 300, margin: '0 0 2px', letterSpacing: -.3 }}>{name.split(' ')[0]}, es tu momento.</h2>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginBottom: 28, ...mono, letterSpacing: 2, textTransform: 'uppercase' }}>La noche decide.</p>
          <Wheel benefits={benefits} onResult={handleResult} disabled={hasSpun} />
        </div>
      )}

      {/* RESULT */}
      {view === 'result' && result && (
        <div style={{ ...wrap, animation: 'pl_in .6s ease', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(ellipse 80% 70% at 50% 35%,${result.color}12,transparent 70%)` }} />

          <div style={{ ...mono, fontSize: 8, letterSpacing: 6, color: 'rgba(201,168,76,0.4)', marginBottom: 20, textTransform: 'uppercase' }}>MIDNIGHT WORLDWIDE</div>

          <div style={{ fontSize: 52, animation: 'pl_float 3s ease-in-out infinite', filter: `drop-shadow(0 0 20px ${result.color})`, marginBottom: 8 }}>🏆</div>
          <h2 style={{ fontSize: 36, color: '#C9A84C', fontWeight: 900, letterSpacing: 1, margin: '0 0 16px', animation: 'pl_pop .6s ease', fontFamily: "'Space Mono',monospace" }}>¡Ganaste!</h2>

          <div style={{ border: `1.5px solid ${result.color}55`, borderRadius: 12, padding: '16px 36px', fontSize: 22, fontWeight: 600, color: result.color, background: result.color + '0D', boxShadow: `0 0 40px ${result.color}22`, marginBottom: 12, animation: 'pl_pop .7s ease .1s both', letterSpacing: -.2 }}>{result.label}</div>

          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 3, ...mono, marginBottom: 24, textTransform: 'uppercase' }}>{name.toUpperCase()} · {email}</p>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '18px 20px', textAlign: 'left', maxWidth: 380, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>🎟</div>
            <p style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, margin: 0, ...mono, fontSize: 11 }}>
              Presenta tu nombre <strong style={{ color: '#F5F0E8' }}>{name.split(' ')[0]}</strong> en la barra para redimir tu beneficio.
              {deadline && <span style={{ display: 'block', marginTop: 6, color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>Válido hasta el {fmtDl(deadline)}.</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  function go() { if (validate()) setView('wheel'); }
};

export default PromoLanding;
