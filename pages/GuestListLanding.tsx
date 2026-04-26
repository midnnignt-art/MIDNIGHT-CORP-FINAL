import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertTriangle, CheckCircle2, Calendar, MapPin } from 'lucide-react';

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

    const orderNumber = code;
    await supabase.from('campaign_leads').insert({ campaign_id: campaign!.id, event_id: campaign!.event_id, name: name.trim(), email: email.toLowerCase().trim(), entry_code: code });
    await supabase.from('orders').insert({ order_number: orderNumber, event_id: campaign!.event_id, customer_name: name.trim(), customer_email: email.toLowerCase().trim(), total: 0, status: 'completed', payment_method: 'guest_list', used: false, commission_amount: 0, net_amount: 0 });

    setEntryCode(code);
    setSaving(false);
    setView('confirmation');
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const root: React.CSSProperties = { minHeight: '100vh', background: '#070707', fontFamily: "'Cormorant Garamond',Georgia,serif", color: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' };
  const wrap: React.CSSProperties = { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 500, width: '100%', padding: '32px 24px' };
  const inp: React.CSSProperties = { width: '100%', background: '#0C0C0C', border: '1px solid #222', borderRadius: 3, padding: '13px 16px', color: '#F5F0E8', fontSize: 16, fontFamily: "'Cormorant Garamond',serif", display: 'block', boxSizing: 'border-box' };
  const mono: React.CSSProperties = { fontFamily: "'Space Mono',monospace" };

  if (pageState === 'loading') return <div style={{ ...root }}><Loader2 style={{ width: 32, height: 32, color: '#C9A84C', animation: 'spin 1s linear infinite' }} /></div>;

  if (pageState === 'invalid') return (
    <div style={{ ...root, flexDirection: 'column', padding: 32, textAlign: 'center' }}>
      <AlertTriangle style={{ width: 52, height: 52, color: '#FF4444', marginBottom: 20 }} />
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: -1 }}>Link no válido</h1>
      <p style={{ color: '#444', ...mono, fontSize: 11, letterSpacing: 2 }}>Esta guest list no existe o fue desactivada.</p>
    </div>
  );

  if (pageState === 'closed') return (
    <div style={{ ...root, flexDirection: 'column', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 20 }}>🔒</div>
      <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: -1 }}>Guest list cerrada</h1>
      <p style={{ color: '#444', ...mono, fontSize: 11, letterSpacing: 2 }}>El registro para esta noche ya cerró.</p>
    </div>
  );

  return (
    <div style={root}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 110% 65% at 50% 0%,#0D0814 0%,#070707 55%)' }} />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(circle,#C9A84C05 0%,transparent 65%)' }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes gl_in    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gl_pop   { 0%{transform:scale(.5);opacity:0} 80%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        @keyframes gl_pulse { 0%,100%{box-shadow:0 0 30px #C9A84C33} 50%{box-shadow:0 0 60px #C9A84C66} }
        input::placeholder  { color:#2A2A2A }
        input:focus         { border-color:#C9A84C88!important;outline:none;box-shadow:0 0 0 3px #C9A84C0F }
      `}</style>

      {/* LANDING */}
      {view === 'landing' && (
        <div style={{ ...wrap, animation: 'gl_in .8s ease' }}>
          <div style={{ marginBottom: 24 }}>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 900, letterSpacing: '-.1em', color: '#fff' }}>MIDNIGHT</span>
            <span style={{ display: 'block', fontSize: 8, fontWeight: 300, letterSpacing: '.8em', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginTop: 2 }}>Worldwide</span>
          </div>

          {ev && (
            <div style={{ marginBottom: 28, background: '#0C0C0C', border: '1px solid #1A1A1A', borderRadius: 12, padding: '18px 24px', width: '100%', maxWidth: 380 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: -.3 }}>{ev.title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ev.event_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#C9A84C', fontSize: 12, ...mono }}>
                    <Calendar style={{ width: 13, height: 13, flexShrink: 0 }} />
                    <span>{fmtDate(ev.event_date)} · {fmtTime(ev.event_date)}</span>
                  </div>
                )}
                {ev.venue && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', fontSize: 12, ...mono }}>
                    <MapPin style={{ width: 13, height: 13, flexShrink: 0 }} />
                    <span>{ev.venue}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: '#C9A84C12', border: '1px solid #C9A84C22', borderRadius: 8, padding: '10px 18px', marginBottom: 28 }}>
            <p style={{ color: '#C9A84C', ...mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
              ✦ {campaign?.label ?? 'Guest List'} — Entrada libre
            </p>
          </div>

          <p style={{ color: '#AAA098', fontSize: 15, lineHeight: 1.65, marginBottom: 32, maxWidth: 340 }}>Regístrate para acceder sin fila. Solo esta noche.</p>

          <button
            onClick={() => setView('form')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#C9A84C 0%,#A07820 50%,#C9A84C 100%)', backgroundSize: '200% 100%', color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '15px 32px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1.5, ...mono, boxShadow: '0 0 40px #C9A84C44' }}
          >
            <span>Registrarme ahora</span><span style={{ fontSize: 16 }}>→</span>
          </button>

          {campaign?.free_until && (
            <p style={{ marginTop: 14, color: '#333', fontSize: 10, letterSpacing: 1.5, ...mono }}>
              Entrada libre hasta las {new Date(campaign.free_until).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}

      {/* FORM */}
      {view === 'form' && (
        <div style={{ ...wrap, animation: 'gl_in .5s ease' }}>
          <button onClick={() => setView('landing')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#C9A84C88', cursor: 'pointer', fontSize: 11, ...mono, marginBottom: 24, padding: 0, letterSpacing: 1 }}>← Volver</button>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#C9A84C,#7A5C1A)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#0A0A0A', boxShadow: '0 0 24px #C9A84C55', marginBottom: 16 }}>M</div>
          <h2 style={{ fontSize: 24, fontWeight: 400, margin: '0 0 4px' }}>Confirma tu registro</h2>
          <p style={{ color: '#666', fontSize: 11, marginBottom: 28, ...mono, letterSpacing: .5 }}>Solo necesitamos dos datos.</p>

          <div style={{ width: '100%', maxWidth: 400, marginBottom: 16, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: '#555', ...mono, marginBottom: 7, textTransform: 'uppercase' }}>Nombre completo</label>
            <input autoFocus placeholder="Ej: Valeria Moreno" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} style={{ ...inp, borderColor: errors.name ? '#FF6B6B55' : '#222' }} />
            {errors.name && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '5px 0 0', ...mono }}>⚠ {errors.name}</p>}
          </div>
          <div style={{ width: '100%', maxWidth: 400, marginBottom: 24, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 9, letterSpacing: 2.5, color: '#555', ...mono, marginBottom: 7, textTransform: 'uppercase' }}>Correo electrónico</label>
            <input type="email" placeholder="Ej: valeria@correo.com" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={{ ...inp, borderColor: errors.email ? '#FF6B6B55' : '#222' }} />
            {errors.email && <p style={{ color: '#FF6B6B', fontSize: 10, margin: '5px 0 0', ...mono }}>⚠ {errors.email}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#C9A84C,#A07820,#C9A84C)', backgroundSize: '200% 100%', color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '15px 32px', fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', letterSpacing: 1.5, ...mono, opacity: saving ? .7 : 1 }}
          >
            {saving ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <><span>Confirmar registro</span><span style={{ fontSize: 16 }}>→</span></>}
          </button>
        </div>
      )}

      {/* CONFIRMATION */}
      {view === 'confirmation' && (
        <div style={{ ...wrap, animation: 'gl_in .6s ease' }}>
          <CheckCircle2 style={{ width: 56, height: 56, color: '#C9A84C', marginBottom: 16, animation: 'gl_pop .6s ease' }} />
          <div style={{ letterSpacing: 8, fontSize: 9, color: '#C9A84C88', ...mono, marginBottom: 10 }}>MIDNIGHT</div>
          <h2 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 4px' }}>¡Estás dentro!</h2>
          <p style={{ color: '#666', fontSize: 12, marginBottom: 28, ...mono }}>Tu lugar está confirmado.</p>

          <div style={{ background: '#0C0C0C', border: '2px solid #C9A84C33', borderRadius: 16, padding: '24px', width: '100%', maxWidth: 360, marginBottom: 20, animation: 'gl_pulse 2s ease-in-out infinite' }}>
            <p style={{ color: '#555', fontSize: 9, letterSpacing: 3, ...mono, textTransform: 'uppercase', marginBottom: 6 }}>Tu código de acceso</p>
            <p style={{ color: '#C9A84C', fontSize: 28, fontWeight: 900, letterSpacing: 6, ...mono, margin: '0 0 12px' }}>{entryCode}</p>
            <div style={{ height: 1, background: '#1A1A1A', marginBottom: 12 }} />
            <p style={{ color: '#AAA098', fontSize: 13, margin: 0 }}>{name}</p>
            <p style={{ color: '#444', fontSize: 11, margin: '4px 0 0', ...mono }}>{email}</p>
            {ev && <p style={{ color: '#555', fontSize: 10, margin: '8px 0 0', ...mono }}>{ev.title}</p>}
          </div>

          <div style={{ background: '#0C0C0C', border: '1px solid #1A1A1A', borderRadius: 8, padding: '14px 18px', maxWidth: 360, textAlign: 'left', display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📋</span>
            <p style={{ color: '#AAA098', fontSize: 11, lineHeight: 1.7, margin: 0, ...mono }}>
              Presenta este código o tu nombre <strong style={{ color: '#F5F0E8' }}>{name.split(' ')[0]}</strong> en la entrada.
              {campaign?.free_until && <span style={{ display: 'block', marginTop: 4, color: '#555' }}>Entrada libre hasta las {new Date(campaign.free_until).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}.</span>}
            </p>
          </div>

          <div style={{ background: '#0D1820', border: '1px solid #1A3A5C', borderRadius: 8, padding: '14px 18px', maxWidth: 360, textAlign: 'left', display: 'flex', gap: 12, marginTop: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>📱</span>
            <p style={{ color: '#AAA098', fontSize: 11, lineHeight: 1.7, margin: 0, ...mono }}>
              Entra en <strong style={{ color: '#F5F0E8' }}>midnightcorp.click</strong> e inicia sesión con{' '}
              <strong style={{ color: '#C9A84C' }}>{email}</strong> para ver tu entrada en{' '}
              <strong style={{ color: '#F5F0E8' }}>Mis Entradas</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestListLanding;
