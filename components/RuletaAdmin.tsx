import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Printer, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Benefit {
  id: number;
  label: string;
  color: string;
  prob: number;
}

const MOCK_BENEFITS: Benefit[] = [
  { id: 1, label: '2x1 en tragos',    color: '#C9A84C', prob: 30 },
  { id: 2, label: 'Shot gratis',       color: '#8B1A1A', prob: 25 },
  { id: 3, label: 'Mesa VIP 30 min',  color: '#1A1A4E', prob: 10 },
  { id: 4, label: 'Entrada sin fila', color: '#2D5A27', prob: 20 },
  { id: 5, label: 'Botella a mitad',  color: '#4A2060', prob:  5 },
  { id: 6, label: 'Trago de la casa', color: '#8B5A1A', prob: 10 },
];

function weightedRandom(benefits: Benefit[]): Benefit {
  const total = benefits.reduce((s, b) => s + b.prob, 0);
  let r = Math.random() * total;
  for (const b of benefits) { r -= b.prob; if (r <= 0) return b; }
  return benefits[benefits.length - 1];
}

// ── Particle burst overlay ────────────────────────────────────────────────────
function ParticleCanvas({ trigger, color }: { trigger: number | null; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{
    x: number; y: number; vx: number; vy: number;
    life: number; decay: number; size: number; color: string;
  }[]>([]);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 7;
      particlesRef.current.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 4,
        life: 1,
        decay: 0.013 + Math.random() * 0.018,
        size: 2 + Math.random() * 5,
        color: [color, '#C9A84C', '#FFFFFF', '#FFD700'][Math.floor(Math.random() * 4)],
      });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      for (const p of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        p.x += p.vx; p.y += p.vy; p.vy += 0.15;
        p.life -= p.decay; p.size *= 0.97;
      }
      if (particlesRef.current.length > 0)
        animRef.current = requestAnimationFrame(draw);
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 20,
      }}
    />
  );
}

// ── Wheel canvas ──────────────────────────────────────────────────────────────
function WheelCanvas({
  benefits, onResult, disabled,
}: {
  benefits: Benefit[];
  onResult: (b: Benefit) => void;
  disabled: boolean;
}) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rotRef       = useRef(0);
  const animRef      = useRef<number | null>(null);
  const lastTickRef  = useRef(-1);
  const [spinning,  setSpinning]  = useState(false);
  const [shaking,   setShaking]   = useState(false);
  const [particles, setParticles] = useState<number | null>(null);
  const [pColor,    setPColor]    = useState('#C9A84C');

  const SIZE       = 400;
  const sliceAngle = (2 * Math.PI) / Math.max(benefits.length, 1);

  const draw = useCallback((rot: number, pulse = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2, r = W / 2 - 12;
    ctx.clearRect(0, 0, W, H);

    // outer glow ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201,168,76,${0.25 + pulse * 0.6})`;
    ctx.lineWidth = 2 + pulse * 5;
    ctx.shadowColor = '#C9A84C';
    ctx.shadowBlur  = 15 + pulse * 50;
    ctx.stroke();
    ctx.restore();

    // rotating outer dots
    for (let i = 0; i < 30; i++) {
      const a  = rot * 0.3 + (i / 30) * Math.PI * 2;
      const dr = r + 18;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dr, cy + Math.sin(a) * dr, i % 5 === 0 ? 3 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 5 === 0 ? '#C9A84C' : '#2A2A2A';
      if (i % 5 === 0) { ctx.shadowColor = '#C9A84C'; ctx.shadowBlur = 8; }
      ctx.fill();
      ctx.restore();
    }

    // slices
    benefits.forEach((b, i) => {
      const start = rot + i * sliceAngle;
      const end   = start + sliceAngle;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      g.addColorStop(0, b.color + 'EE');
      g.addColorStop(1, b.color + '77');
      ctx.fillStyle   = g;
      ctx.fill();
      ctx.strokeStyle = '#070707';
      ctx.lineWidth   = 2;
      ctx.stroke();
      ctx.restore();

      // separator shimmer
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start);
      ctx.beginPath();
      ctx.moveTo(r * 0.22, 0);
      ctx.lineTo(r * 0.92, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();

      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + sliceAngle / 2);
      ctx.textAlign    = 'right';
      ctx.fillStyle    = '#F5F0E8';
      ctx.font         = "bold 14px 'Cormorant Garamond', serif";
      ctx.shadowColor  = 'rgba(0,0,0,0.95)';
      ctx.shadowBlur   = 8;
      ctx.fillText(b.label, r - 18, 5);
      ctx.restore();
    });

    // inner accent ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.23, 0, Math.PI * 2);
    ctx.strokeStyle = '#C9A84C33';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.restore();

    // hub
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    const hg = ctx.createRadialGradient(cx - 5, cy - 5, 0, cx, cy, 28);
    hg.addColorStop(0, '#F0D070');
    hg.addColorStop(0.5, '#C9A84C');
    hg.addColorStop(1, '#5A3A08');
    ctx.fillStyle  = hg;
    ctx.shadowColor = '#C9A84C';
    ctx.shadowBlur  = 25 + pulse * 25;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle     = '#0A0A0A';
    ctx.font          = 'bold 18px serif';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText('M', cx, cy);
    ctx.restore();
  }, [benefits, sliceAngle]);

  useEffect(() => { draw(rotRef.current); }, [benefits, draw]);

  function spin() {
    if (spinning || disabled || benefits.length < 2) return;
    setSpinning(true);

    const winner    = weightedRandom(benefits);
    const wi        = benefits.findIndex(b => b.id === winner.id);
    const target    = -Math.PI / 2 - (wi * sliceAngle + sliceAngle / 2);
    const fullSpins = (6 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
    const startRot  = rotRef.current;
    const norm      = ((target    % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const startN    = ((startRot  % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let   delta     = norm - startN;
    if (delta < 0) delta += 2 * Math.PI;
    const finalRot  = startRot + fullSpins + delta;
    const duration  = 6200;
    const t0        = performance.now();
    lastTickRef.current = -1;

    function ease(t: number) { return 1 - Math.pow(1 - t, 4); }

    function frame(now: number) {
      const prog = Math.min((now - t0) / duration, 1);
      const ep   = ease(prog);
      const cur  = startRot + (finalRot - startRot) * ep;
      rotRef.current = cur;
      const vel   = (1 - Math.pow(1 - prog, 3)) * 0.8;
      const pulse = prog < 0.85 ? Math.min(vel * 0.6, 1) : 0;
      const cs    = Math.floor(((cur % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / sliceAngle);
      if (cs !== lastTickRef.current) lastTickRef.current = cs;
      draw(cur, pulse);
      if (prog < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        draw(cur, 0);
        setSpinning(false);
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        setPColor(winner.color);
        setParticles(Date.now());
        setTimeout(() => onResult(winner), 900);
      }
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(frame);
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* ambient glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: SIZE + 80, height: SIZE + 80, borderRadius: '50%',
        background: 'radial-gradient(circle, #C9A84C0C 0%, transparent 65%)',
        animation: spinning ? 'mc_glowPulse 0.5s ease-in-out infinite alternate' : 'none',
        pointerEvents: 'none',
      }} />

      {/* needle */}
      <div style={{
        position: 'relative', zIndex: 15, marginBottom: -8,
        filter: 'drop-shadow(0 0 10px #C9A84C) drop-shadow(0 4px 8px rgba(0,0,0,0.9))',
        animation: spinning ? 'mc_needleWobble 0.12s ease-in-out infinite alternate' : 'none',
      }}>
        <svg width="28" height="36" viewBox="0 0 32 40">
          <defs>
            <linearGradient id="mc_ng" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#F0D070" />
              <stop offset="100%" stopColor="#8B6914" />
            </linearGradient>
          </defs>
          <polygon points="16,38 2,0 30,0"   fill="url(#mc_ng)" />
          <polygon points="16,38 2,0 30,0"   fill="none" stroke="#050505" strokeWidth="1.5" />
          <circle  cx="16" cy="6" r="5"      fill="#C9A84C" />
          <circle  cx="16" cy="6" r="2"      fill="#0A0A0A" />
        </svg>
      </div>

      {/* wheel */}
      <div
        onClick={spin}
        style={{
          position: 'relative', zIndex: 5, borderRadius: '50%',
          boxShadow: spinning
            ? '0 0 80px #C9A84C66, 0 0 160px #C9A84C22, inset 0 0 40px rgba(0,0,0,0.6)'
            : '0 0 40px #C9A84C44, 0 0 80px #C9A84C18, inset 0 0 20px rgba(0,0,0,0.5)',
          animation: shaking ? 'mc_wheelShake 0.5s ease-in-out' : 'none',
          cursor: spinning || disabled ? 'not-allowed' : 'pointer',
          transition: 'box-shadow 0.4s',
        }}
      >
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          style={{ display: 'block', borderRadius: '50%' }}
        />
        <ParticleCanvas trigger={particles} color={pColor} />
      </div>

      {!spinning && !disabled && (
        <div style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 8,
          color: '#C9A84C', fontFamily: "'Space Mono', monospace",
          fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
        }}>
          <span style={{ animation: 'mc_tapBounce 1.3s ease-in-out infinite', fontSize: 16 }}>👆</span>
          Toca para girar
        </div>
      )}
      {spinning && (
        <div style={{
          marginTop: 16, color: '#C9A84C99',
          fontFamily: "'Space Mono', monospace",
          fontSize: 10, letterSpacing: 3,
          animation: 'mc_blink 0.7s step-end infinite',
        }}>
          ● GIRANDO...
        </div>
      )}
    </div>
  );
}

// ── Leads interfaces ──────────────────────────────────────────────────────────
interface RuletaLead {
  id: string;
  name: string;
  email: string;
  benefit: string | null;
  benefit_color: string | null;
  registered_at: string;
  campaign_id: string;
}
interface RuletaCampaignMeta {
  id: string;
  label: string;
  code: string;
}

// ── Main export ───────────────────────────────────────────────────────────────
export const RuletaAdmin: React.FC = () => {
  const [benefits,  setBenefits]  = useState<Benefit[]>(MOCK_BENEFITS);
  const [result,    setResult]    = useState<Benefit | null>(null);
  const [hasSpun,   setHasSpun]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newLabel,  setNewLabel]  = useState('');
  const [newProb,   setNewProb]   = useState(10);
  const [newColor,  setNewColor]  = useState('#C9A84C');

  // Leads state
  const [leads,        setLeads]        = useState<RuletaLead[]>([]);
  const [campaigns,    setCampaigns]    = useState<RuletaCampaignMeta[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  useEffect(() => {
    async function loadLeads() {
      setLeadsLoading(true);
      const { data: camps } = await supabase
        .from('campaigns')
        .select('id, label, code')
        .eq('type', 'ruleta');
      const campList = (camps ?? []) as RuletaCampaignMeta[];
      setCampaigns(campList);

      const ids = campList.map(c => c.id);
      if (ids.length > 0) {
        const { data: leadRows } = await supabase
          .from('campaign_leads')
          .select('id, name, email, benefit, benefit_color, registered_at, campaign_id')
          .in('campaign_id', ids)
          .order('registered_at', { ascending: false });
        setLeads((leadRows ?? []) as RuletaLead[]);
      }
      setLeadsLoading(false);
    }
    loadLeads();
  }, []);

  const total   = benefits.reduce((s, b) => s + b.prob, 0);
  const totalOk = Math.abs(total - 100) < 1;

  function addBenefit() {
    if (!newLabel.trim()) return;
    setBenefits(p => [...p, { id: Date.now(), label: newLabel.trim(), color: newColor, prob: newProb }]);
    setNewLabel(''); setNewProb(10); setNewColor('#C9A84C');
  }

  function handleResult(b: Benefit) { setResult(b); setHasSpun(true); }
  function resetSpin()               { setResult(null); setHasSpun(false); }

  const campMap = Object.fromEntries(campaigns.map(c => [c.id, c]));

  return (
    <>
      <style>{`
        @keyframes mc_glowPulse    { from{opacity:.5;transform:translate(-50%,-50%) scale(.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1.06)} }
        @keyframes mc_needleWobble { from{transform:rotate(-4deg)} to{transform:rotate(4deg)} }
        @keyframes mc_wheelShake   { 0%{transform:translate(0,0) rotate(0)} 20%{transform:translate(-5px,0) rotate(-1.5deg)} 40%{transform:translate(5px,0) rotate(1.5deg)} 60%{transform:translate(-3px,0) rotate(-.8deg)} 80%{transform:translate(3px,0) rotate(.8deg)} 100%{transform:translate(0,0) rotate(0)} }
        @keyframes mc_tapBounce    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes mc_blink        { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes mc_resultPop    { 0%{transform:scale(.4);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @media print {
          body > * { visibility: hidden !important; }
          #ruleta-leads-print, #ruleta-leads-print * { visibility: visible !important; }
          #ruleta-leads-print { position: fixed; inset: 0; padding: 32px; background: white; color: black; }
          #ruleta-leads-print .no-print { display: none !important; }
          #ruleta-leads-print table { width: 100%; border-collapse: collapse; font-size: 12px; }
          #ruleta-leads-print th, #ruleta-leads-print td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
          #ruleta-leads-print th { background: #f0f0f0; font-weight: bold; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        }
      `}</style>

      <div className="flex flex-col gap-10">

        {/* ── Wheel + Config row ── */}
        <div className="flex flex-col xl:flex-row gap-10 items-start">

        {/* ── Wheel column ── */}
        <div className="flex flex-col items-center flex-shrink-0">
          <WheelCanvas benefits={benefits} onResult={handleResult} disabled={hasSpun} />

          {result && (
            <div className="mt-6 w-full max-w-[400px]" style={{ animation: 'mc_resultPop .6s ease' }}>
              <div
                className="rounded-2xl p-5 text-center border"
                style={{
                  borderColor: result.color + '44',
                  background:  result.color + '0C',
                  boxShadow:  `0 0 30px ${result.color}22`,
                }}
              >
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.35em] mb-2 opacity-50"
                  style={{ color: result.color, fontFamily: "'Space Mono', monospace" }}
                >
                  Resultado
                </p>
                <p
                  className="text-2xl font-bold"
                  style={{ color: result.color, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {result.label}
                </p>
              </div>
              <button
                onClick={resetSpin}
                className="mt-3 w-full py-2.5 rounded-xl border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all text-[10px] font-bold uppercase tracking-[0.25em]"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Reiniciar giro
              </button>
            </div>
          )}
        </div>

        {/* ── Config panel ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">

            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Beneficios activos
              </p>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                  totalOk
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10    border-red-500/20    text-red-400'
                }`}
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${totalOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {total}%{!totalOk && ` — ${total < 100 ? `falta ${100 - total}%` : `excede ${total - 100}%`}`}
              </div>
            </div>

            {/* Benefit rows */}
            <div className="space-y-2 mb-4">
              {benefits.map(b => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2.5"
                >
                  <input
                    type="color"
                    value={b.color}
                    onChange={e => setBenefits(p => p.map(x => x.id === b.id ? { ...x, color: e.target.value } : x))}
                    className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent flex-shrink-0"
                    style={{ padding: 0 }}
                  />

                  {editingId === b.id ? (
                    <input
                      autoFocus
                      value={b.label}
                      onChange={e => setBenefits(p => p.map(x => x.id === b.id ? { ...x, label: e.target.value } : x))}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                      className="flex-1 bg-transparent border-b border-[#C9A84C]/40 text-white text-sm outline-none pb-0.5 min-w-0"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-white/70 cursor-text truncate hover:text-white transition-colors min-w-0"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                      onClick={() => setEditingId(b.id)}
                    >
                      {b.label}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <input
                      type="number"
                      value={b.prob}
                      min={1}
                      max={100}
                      onChange={e => setBenefits(p => p.map(x => x.id === b.id ? { ...x, prob: parseInt(e.target.value) || 1 } : x))}
                      className="w-12 bg-black/40 border border-white/10 rounded-lg text-center text-[#C9A84C] text-xs outline-none py-1 focus:border-[#C9A84C]/40"
                      style={{ fontFamily: 'monospace' }}
                    />
                    <span className="text-white/20 text-xs">%</span>
                  </div>

                  <button
                    onClick={() => setBenefits(p => p.filter(x => x.id !== b.id))}
                    className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 p-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add row */}
            <div className="flex items-center gap-3 bg-white/[0.01] border border-dashed border-white/10 rounded-xl px-3 py-2.5 mb-5">
              <input
                type="color"
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                className="w-7 h-7 rounded-lg border-0 cursor-pointer bg-transparent flex-shrink-0"
                style={{ padding: 0 }}
              />
              <input
                placeholder="Nuevo beneficio..."
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addBenefit()}
                className="flex-1 bg-transparent text-white/60 placeholder:text-white/20 text-sm outline-none min-w-0"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <input
                  type="number"
                  value={newProb}
                  min={1}
                  max={100}
                  onChange={e => setNewProb(parseInt(e.target.value) || 1)}
                  className="w-12 bg-black/40 border border-white/10 rounded-lg text-center text-[#C9A84C] text-xs outline-none py-1 focus:border-[#C9A84C]/40"
                  style={{ fontFamily: 'monospace' }}
                />
                <span className="text-white/20 text-xs">%</span>
              </div>
              <button
                onClick={addBenefit}
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                style={{ background: '#C9A84C', color: '#0A0A0A' }}
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>

            {/* Progress bar */}
            <div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(total, 100)}%`,
                    background: totalOk
                      ? 'linear-gradient(90deg, #C9A84C, #F0D070)'
                      : total > 100
                        ? '#FF4444'
                        : '#C9A84C88',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span
                  className="text-[9px] text-white/20 uppercase tracking-[0.2em]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  Probabilidad asignada
                </span>
                <span
                  className="text-[9px] uppercase tracking-[0.2em]"
                  style={{ fontFamily: "'Space Mono', monospace", color: totalOk ? '#C9A84C' : '#FF4444' }}
                >
                  {totalOk ? '✓ Completo' : `${total} / 100%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        </div>{/* end wheel+config row */}

        {/* ── Leads table ── */}
        <div id="ruleta-leads-print" className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 no-print">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Participantes Ruleta
              </p>
              <p className="text-white text-sm font-black mt-0.5" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {leads.length} registros
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              <Printer size={13} />
              Imprimir
            </button>
          </div>

          {/* Print-only header */}
          <div className="hidden" style={{ display: 'none' }} id="print-header">
            <h1 style={{ fontFamily: 'sans-serif', fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>Midnight — Participantes Ruleta</h1>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', marginBottom: 16 }}>
              Generado: {new Date().toLocaleString('es-MX')} · Total: {leads.length}
            </p>
          </div>

          {leadsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/20 text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>
                Aún no hay participantes
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Nombre', 'Email', 'Beneficio', 'Campaña', 'Fecha'].map(h => (
                      <th
                        key={h}
                        className="text-left pb-3 pr-4 text-[9px] font-bold uppercase tracking-[0.3em] text-white/25"
                        style={{ fontFamily: "'Space Mono', monospace" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => {
                    const camp = campMap[l.campaign_id];
                    return (
                      <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-4 text-white/80 font-medium" style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>
                          {l.name}
                        </td>
                        <td className="py-3 pr-4 text-white/40 text-xs" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {l.email}
                        </td>
                        <td className="py-3 pr-4">
                          {l.benefit ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                              style={{
                                background: (l.benefit_color ?? '#C9A84C') + '22',
                                color: l.benefit_color ?? '#C9A84C',
                                fontFamily: "'Space Mono', monospace",
                                fontSize: 10,
                                letterSpacing: '0.05em',
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: l.benefit_color ?? '#C9A84C' }}
                              />
                              {l.benefit}
                            </span>
                          ) : (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-white/30 text-[10px]" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {camp?.label ?? '—'}
                        </td>
                        <td className="py-3 text-white/25 text-[10px]" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {new Date(l.registered_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
};
