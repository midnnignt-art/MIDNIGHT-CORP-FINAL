import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Calendar, MapPin } from 'lucide-react';

interface Campaign { id: string; label: string; event_id: string; free_until: string | null; }
interface EventInfo { id: string; title: string; venue: string; event_date: string; }
type View = 'landing' | 'form' | 'confirmation';

function genCode() {
  return 'GL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function MidnightLogo() {
  return (
    <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ display: 'block', fontSize: 28, fontWeight: 900, letterSpacing: '-0.1em', color: '#fff', fontFamily: "'Space Mono',sans-serif", lineHeight: 1 }}>MIDNIGHT</span>
      <span style={{ display: 'block', fontSize: 7, fontWeight: 300, letterSpacing: '0.8em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: 3, fontFamily: "'Space Mono',monospace" }}>Worldwide</span>
    </div>
  );
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
    const orderNumber = code;
    await supabase.from('campaign_leads').insert({ campaign_id: campaign!.id, event_id: campaign!.event_id, name: name.trim(), email: email.toLowerCase().trim(), entry_code: code });
    await supabase.from('orders').insert({ order_number: orderNumber, event_id: campaign!.event_id, customer_name: name.trim(), customer_email: email.toLowerCase().trim(), total: 0, status: 'completed', payment_method: 'guest_list', used: false, commission_amount: 0, net_amount: 0 });
    setEntryCode(code);
    setSaving(false);
    setView('confirmation');
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const mono: React.CSSProperties = { fontFamily: "'Space Mono',monospace" };
  const root: React.CSSProperties = {
    minHeight: '100vh', background: '#050505',
    fontFamily: "'Cormorant Garamond',Georgia,serif",
    color: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  };
  const wrap: React.CSSProperties = {
    position: 'relative', zIndex: 2,
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    maxWidth: 500, width: '100%', padding: '40px 24px',
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
    cursor: 'pointer', letterSpacing: 2.5, ...mono,
    boxShadow: '0 0 40px rgba(201,168,76,0.25), 0 0 80px rgba(201,168,76,0.08)',
    transition: 'opacity .2s',
  };
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
    @keyframes gl_in    { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes gl_pop   { 0%{transform:scale(.5);opacity:0} 80%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
    @keyframes gl_pulse { 0%,100%{box-shadow:0 0 30px rgba(201,168,76,.2)} 50%{box-shadow:0 0 60px rgba(201,168,76,.4)} }
    @keyframes gl_dot   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
    @keyframes gl_check { 0%{transform:scale(.3) rotate(-10deg);opacity:0} 80%{transform:scale(1.1) rotate(2deg)} 100%{transform:scale(1) rotate(0deg);opacity:1} }
    input::placeholder  { color:rgba(255,255,255,0.1) }
    input:focus         { border-color:rgba(201,168,76,0.4)!important;outline:none;box-shadow:0 0 0 3px rgba(201,168,76,0.05) }
    .gl-cta:hover       { opacity:.85 }
  `;

  if (pageState === 'loading') return (
    <div style={{ ...root, flexDirection: 'column', gap: 24 }}>
      <style>{styles}</style>
      <MidnightLogo />
      <Loader2 style={{ width: 28, height: 28, color: '#C9A84C', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const errorScreen = (icon: string, title: string, sub: string) => (
    <div style={{ ...root, flexDirection: 'column', padding: 32, textAlign: 'center', gap: 0 }}>
      <style>{styles}</style>
      <MidnightLogo />
      <div style={{ fontSize: 40, marginBottom: 16, opacity: .6 }}>{icon}</div>
      <h1 style={{ color: '#fff', ...mono, fontSize: 14, fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 3 }}>{title}</h1>
      <p style={{ color: 'rgba(255,255,255,0.2)', ...mono, fontSize: 10, letterSpacing: 2 }}>{sub}</p>
    </div>
  );

  if (pageState === 'invalid') return errorScreen('✗', 'Link no válido', 'Esta guest list no existe o fue desactivada.');
  if (pageState === 'closed')  return errorScreen('🔒', 'Guest list cerrada', 'El registro para esta noche ya cerró.');

  return (
    <div style={root}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 70% 55% at 15% 90%, rgba(73,15,124,0.12), transparent 55%), radial-gradient(ellipse 60% 50% at 85% 10%, rgba(201,168,76,0.05), transparent 50%)' }} />
      <style>{styles}</style>

      {/* LANDING */}
      {view === 'landing' && (
        <div style={{ ...wrap, animation: 'gl_in .8s ease' }}>
          <MidnightLogo />

          {/* Guest list badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, background: 'rgba(73,15,124,0.15)', border: '1px solid rgba(73,15,124,0.3)', borderRadius: 50, padding: '6px 18px' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', boxShadow: '0 0 8px #C9A84C', animation: 'gl_dot 1.5s ease-in-out infinite' }} />
            <span style={{ ...mono, fontSize: 9, letterSpacing: '0.3em', color: '#C9A84C', textTransform: 'uppercase' }}>
              {campaign?.label ?? 'Guest List'} — Entrada Libre
            </span>
          </div>

          {/* Event card */}
          {ev && (
            <div style={{ marginBottom: 28, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 380, animation: 'gl_pop .5s ease .1s both' }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px', letterSpacing: -.3 }}>{ev.title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ev.event_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontSize: 11, ...mono }}>
                    <Calendar style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span>{fmtDate(ev.event_date)} · {fmtTime(ev.event_date)}</span>
                  </div>
                )}
                {ev.venue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.3)', fontSize: 11, ...mono }}>
                    <MapPin style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span>{ev.venue}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 1.7, marginBottom: 32, maxWidth: 320, fontWeight: 300 }}>
            Regístrate para acceder sin fila. Solo esta noche.
          </p>

          <button className="gl-cta" onClick={() => setView('form')} style={cta}>
            <span>Registrarme ahora</span><span style={{ fontSize: 14 }}>→</span>
          </button>

          {campaign?.free_until && (
            <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: 2, ...mono, textTransform: 'uppercase' }}>
              Entrada libre hasta las {new Date(campaign.free_until).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 300, opacity: .12 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
            <span style={{ ...mono, fontSize: 8, letterSpacing: 3, color: '#C9A84C' }}>MC</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
          </div>
        </div>
      )}

      {/* FORM */}
      {view === 'form' && (
        <div style={{ ...wrap, animation: 'gl_in .5s ease' }}>
          <button onClick={() => setView('landing')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'rgba(201,168,76,0.5)', cursor: 'pointer', fontSize: 10, ...mono, marginBottom: 32, padding: 0, letterSpacing: 2, textTransform: 'uppercase' }}>← Volver</button>
          <MidnightLogo />
          <h2 style={{ fontSize: 26, fontWeight: 300, margin: '0 0 6px', letterSpacing: -.3 }}>Confirma tu registro</h2>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginBottom: 32, ...mono, letterSpacing: 1, textTransform: 'uppercase' }}>Solo necesitamos dos datos.</p>

          <div style={{ width: '100%', maxWidth: 400, marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', ...mono, marginBottom: 8, textTransform: 'uppercase' }}>Nombre completo</label>
            <input autoFocus placeholder="Ej: Valeria Moreno" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} style={{ ...inp, borderColor: errors.name ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.08)' }} />
            {errors.name && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '6px 0 0', ...mono }}>⚠ {errors.name}</p>}
          </div>
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 28, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,255,255,0.25)', ...mono, marginBottom: 8, textTransform: 'uppercase' }}>Correo electrónico</label>
            <input type="email" placeholder="Ej: valeria@correo.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={{ ...inp, borderColor: errors.email ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,0.08)' }} />
            {errors.email && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '6px 0 0', ...mono }}>⚠ {errors.email}</p>}
          </div>

          <button className="gl-cta" onClick={handleSubmit} disabled={saving}
            style={{ ...cta, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .6 : 1 }}
          >
            {saving
              ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
              : <><span>Confirmar registro</span><span style={{ fontSize: 14 }}>→</span></>
            }
          </button>
        </div>
      )}

      {/* CONFIRMATION */}
      {view === 'confirmation' && (
        <div style={{ ...wrap, animation: 'gl_in .6s ease' }}>
          {/* Big checkmark */}
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, animation: 'gl_check .5s cubic-bezier(.34,1.56,.64,1)', boxShadow: '0 0 40px rgba(201,168,76,0.12)' }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16l8 8 12-14" stroke="#C9A84C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <div style={{ ...mono, fontSize: 8, letterSpacing: 5, color: 'rgba(201,168,76,0.3)', marginBottom: 8, textTransform: 'uppercase' }}>MIDNIGHT WORLDWIDE</div>
          <h2 style={{ fontSize: 34, fontWeight: 300, margin: '0 0 6px', letterSpacing: -.5 }}>¡Estás dentro!</h2>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginBottom: 28, ...mono, letterSpacing: 1.5, textTransform: 'uppercase' }}>Registro confirmado · {entryCode}</p>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '20px 22px', maxWidth: 380, width: '100%', textAlign: 'left', display: 'flex', gap: 14 }}>
            <div style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>📱</div>
            <p style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, margin: 0, ...mono, fontSize: 11 }}>
              Entra en <strong style={{ color: '#F5F0E8' }}>midnightcorp.click</strong> e inicia sesión con{' '}
              <strong style={{ color: '#C9A84C' }}>{email}</strong> para ver tu entrada en{' '}
              <strong style={{ color: '#F5F0E8' }}>Mis Entradas</strong>.
            </p>
          </div>

          <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 300, opacity: .1 }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #C9A84C)' }} />
            <span style={{ ...mono, fontSize: 8, letterSpacing: 3, color: '#C9A84C' }}>MC</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #C9A84C)' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestListLanding;
