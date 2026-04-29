import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Calendar, MapPin } from 'lucide-react';

interface Campaign { id: string; label: string; event_id: string; free_until: string | null; }
interface EventInfo { id: string; title: string; venue: string; event_date: string; }
type View = 'landing' | 'form' | 'confirmation';

function genCode() {
  return 'GL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

const GuestListLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  const [pageState, setPageState] = useState<'loading' | 'invalid' | 'closed' | 'ready'>('loading');
  const [campaign,  setCampaign]  = useState<Campaign | null>(null);
  const [ev,        setEv]        = useState<EventInfo | null>(null);
  const [view,      setView]      = useState<View>('landing');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [errors,    setErrors]    = useState<{ name?: string; email?: string }>({});
  const [saving,    setSaving]    = useState(false);
  const [entryCode, setEntryCode] = useState('');

  useEffect(() => {
    supabase.from('campaigns')
      .select('id,label,event_id,free_until')
      .eq('code', codigo).eq('type', 'guest_list').eq('active', true)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setPageState('invalid'); return; }
        if (data.free_until && new Date(data.free_until) < new Date()) { setPageState('closed'); return; }
        setCampaign(data as Campaign);
        const { data: e } = await supabase.from('events').select('id,title,venue,event_date').eq('id', data.event_id).maybeSingle();
        setEv(e as EventInfo);
        setPageState('ready');
      });
  }, [codigo]);

  function alreadyRegistered(e: string) {
    const obj = JSON.parse(localStorage.getItem(`gl_${codigo}`) || '{}');
    return !!obj[e.toLowerCase().trim()];
  }

  function validate() {
    const e: { name?: string; email?: string } = {};
    if (name.trim().split(/\s+/).filter(Boolean).length < 2) e.name = 'Ingresa nombre y apellido completos';
    if (!email.trim().includes('@')) e.email = 'Email inválido';
    else if (alreadyRegistered(email)) e.email = 'Este correo ya está registrado en esta guest list';
    setErrors(e); return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    const code = genCode();
    const obj = JSON.parse(localStorage.getItem(`gl_${codigo}`) || '{}');
    obj[email.toLowerCase().trim()] = { code, ts: Date.now() };
    localStorage.setItem(`gl_${codigo}`, JSON.stringify(obj));
    await supabase.from('campaign_leads').insert({ campaign_id: campaign!.id, event_id: campaign!.event_id, name: name.trim(), email: email.toLowerCase().trim(), entry_code: code });
    await supabase.from('orders').insert({ order_number: code, event_id: campaign!.event_id, customer_name: name.trim(), customer_email: email.toLowerCase().trim(), total: 0, status: 'completed', payment_method: 'guest_list', used: false, commission_amount: 0, net_amount: 0 });
    setEntryCode(code);
    setSaving(false);
    setView('confirmation');
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    @keyframes gl_in    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes gl_pop   { 0%{transform:scale(.5) rotate(-5deg);opacity:0} 80%{transform:scale(1.06) rotate(1deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes gl_dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.7)} }
    @keyframes gl_orb   { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.12) translate(-8px,8px);opacity:1} }
    @keyframes gl_check { 0%{stroke-dashoffset:60} 100%{stroke-dashoffset:0} }
    input::placeholder  { color:rgba(255,255,255,0.12) }
    input:focus         { border-color:rgba(201,168,76,0.45)!important;outline:none;box-shadow:0 0 0 3px rgba(201,168,76,0.06) }
    .gl-btn:hover       { opacity:.88;transform:translateY(-1px) }
    .gl-btn:active      { transform:translateY(0) }
  `;

  const root: React.CSSProperties = {
    minHeight: '100vh', background: '#050505',
    fontFamily: 'Inter, sans-serif', color: '#F2F2F2',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  };

  const Logo = () => (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.1em', color: '#fff', lineHeight: 1, textAlign: 'center' }}>MIDNIGHT</div>
      <div style={{ fontSize: 7, fontWeight: 300, letterSpacing: '0.8em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 4, textAlign: 'center', marginLeft: 4 }}>Worldwide</div>
    </div>
  );

  const ctaStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '15px 36px', borderRadius: 50,
    background: 'linear-gradient(135deg, #C9A84C, #A07820, #C9A84C)', backgroundSize: '200%',
    color: '#0A0A0A', border: 'none', fontSize: 11, fontWeight: 700,
    letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 0 40px rgba(201,168,76,0.25), 0 4px 20px rgba(0,0,0,0.4)',
    transition: 'opacity .2s, transform .15s',
  };

  const staticStates: Record<string, React.ReactNode> = {
    loading: (
      <div style={root}>
        <style>{CSS}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <Logo />
          <Loader2 style={{ width: 22, height: 22, color: '#C9A84C', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    ),
    invalid: (
      <div style={{ ...root, flexDirection: 'column', padding: 40, textAlign: 'center', gap: 14 }}>
        <style>{CSS}</style>
        <Logo />
        <div style={{ fontSize: 32, opacity: .3, marginTop: 20 }}>✕</div>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Link no válido</p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: 1.5 }}>Esta guest list no existe o fue desactivada.</p>
      </div>
    ),
    closed: (
      <div style={{ ...root, flexDirection: 'column', padding: 40, textAlign: 'center', gap: 14 }}>
        <style>{CSS}</style>
        <Logo />
        <div style={{ fontSize: 36, opacity: .4, marginTop: 20 }}>🔒</div>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Guest list cerrada</p>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: 1.5 }}>El registro para esta noche ya cerró.</p>
      </div>
    ),
  };
  if (staticStates[pageState]) return staticStates[pageState] as React.ReactElement;

  return (
    <div style={root}>
      <style>{CSS}</style>

      {/* ── Atmospheric orbs ── */}
      <div style={{ position: 'fixed', top: '-15%', right: '-10%', width: '55vw', height: '55vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(73,15,124,0.15) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0, animation: 'gl_orb 9s ease-in-out infinite' }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-15%', width: '60vw', height: '60vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0, animation: 'gl_orb 12s ease-in-out infinite reverse' }} />
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(5,5,5,0) 50%, rgba(5,5,5,0.85) 100%)', pointerEvents: 'none', zIndex: 1 }} />

      {/* ── LANDING ── */}
      {view === 'landing' && (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 480, width: '100%', padding: '48px 24px', animation: 'gl_in .7s ease' }}>

          <Logo />

          {/* Guest list badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 50, background: 'rgba(73,15,124,0.2)', border: '1px solid rgba(73,15,124,0.4)', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C', display: 'inline-block', animation: 'gl_dot 1.6s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#C9A84C' }}>
              {campaign?.label ?? 'Guest List'} — Entrada Libre
            </span>
          </div>

          {/* Event info card */}
          {ev && (
            <div style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 22px', marginBottom: 28, animation: 'gl_in .5s ease .1s both' }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, marginBottom: 12, letterSpacing: -.3, color: '#F2F2F2', lineHeight: 1.2 }}>{ev.title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ev.event_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontSize: 11, fontWeight: 600 }}>
                    <Calendar style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{ letterSpacing: .5 }}>{fmtDate(ev.event_date)} · {fmtTime(ev.event_date)}</span>
                  </div>
                )}
                {ev.venue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                    <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span>{ev.venue}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, marginBottom: 32, maxWidth: 320, fontWeight: 300, fontStyle: 'italic' }}>
            Regístrate para acceder sin fila. Solo esta noche.
          </p>

          <button className="gl-btn" onClick={() => setView('form')} style={ctaStyle}>
            Registrarme ahora →
          </button>

          {campaign?.free_until && (
            <p style={{ marginTop: 14, fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>
              Entrada libre hasta las {new Date(campaign.free_until).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 48, width: '100%', maxWidth: 280, opacity: .1 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
            <span style={{ fontSize: 8, letterSpacing: 4, color: '#C9A84C', fontWeight: 700 }}>MC</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
          </div>
        </div>
      )}

      {/* ── FORM ── */}
      {view === 'form' && (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 440, width: '100%', padding: '48px 24px', animation: 'gl_in .5s ease' }}>
          <button onClick={() => setView('landing')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(201,168,76,0.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', padding: 0, marginBottom: 36 }}>← Volver</button>

          <Logo />

          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, marginBottom: 6, letterSpacing: -.3 }}>Confirma tu registro</h2>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 32, fontWeight: 600 }}>Solo necesitamos dos datos.</p>

          <div style={{ width: '100%', marginBottom: 14, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>Nombre completo</label>
            <input autoFocus placeholder="Ej: Valeria Moreno" value={name}
              onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.name ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '13px 16px', color: '#F2F2F2', fontSize: 15, fontFamily: "'Cormorant Garamond', serif", display: 'block' }} />
            {errors.name && <p style={{ color: '#FF6B6B', fontSize: 10, marginTop: 6, fontWeight: 600 }}>⚠ {errors.name}</p>}
          </div>

          <div style={{ width: '100%', marginBottom: 28, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>Correo electrónico</label>
            <input type="email" placeholder="Ej: valeria@correo.com" value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.email ? 'rgba(255,80,80,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '13px 16px', color: '#F2F2F2', fontSize: 15, fontFamily: "'Cormorant Garamond', serif", display: 'block' }} />
            {errors.email && <p style={{ color: '#FF6B6B', fontSize: 10, marginTop: 6, fontWeight: 600 }}>⚠ {errors.email}</p>}
          </div>

          <button className="gl-btn" onClick={handleSubmit} disabled={saving}
            style={{ ...ctaStyle, opacity: saving ? .6 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving
              ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Confirmando...</>
              : <>Confirmar registro →</>
            }
          </button>
        </div>
      )}

      {/* ── CONFIRMATION ── */}
      {view === 'confirmation' && (
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 480, width: '100%', padding: '48px 24px', animation: 'gl_in .6s ease' }}>

          {/* Animated checkmark circle */}
          <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 24 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(201,168,76,0.06)', border: '1.5px solid rgba(201,168,76,0.2)', boxShadow: '0 0 40px rgba(201,168,76,0.12)', animation: 'gl_pop .5s cubic-bezier(.34,1.56,.64,1)' }} />
            <svg viewBox="0 0 80 80" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <path d="M22 40l12 12 24-22" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
                strokeDasharray="60" style={{ animation: 'gl_check .5s ease .2s forwards', strokeDashoffset: 60 }} />
            </svg>
          </div>

          <div style={{ fontSize: 9, letterSpacing: 6, color: 'rgba(201,168,76,0.3)', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase' }}>MIDNIGHT WORLDWIDE</div>

          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 300, marginBottom: 6, letterSpacing: -.5 }}>¡Estás dentro!</h2>

          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: 3, marginBottom: 32, fontWeight: 700, textTransform: 'uppercase' }}>
            Código de acceso · {entryCode}
          </p>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 22px', maxWidth: 380, width: '100%', display: 'flex', gap: 14, alignItems: 'flex-start', textAlign: 'left' }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>📱</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, fontFamily: "'Cormorant Garamond', serif", fontSize: 14 }}>
              Entra en <strong style={{ color: '#F2F2F2' }}>midnightcorp.click</strong> e inicia sesión con{' '}
              <strong style={{ color: '#C9A84C' }}>{email}</strong> para ver tu entrada en{' '}
              <strong style={{ color: '#F2F2F2' }}>Mis Entradas</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 40, width: '100%', maxWidth: 280, opacity: .1 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
            <span style={{ fontSize: 8, letterSpacing: 4, color: '#C9A84C', fontWeight: 700 }}>MC</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestListLanding;
