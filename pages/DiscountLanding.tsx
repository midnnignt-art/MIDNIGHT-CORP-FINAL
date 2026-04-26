import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertTriangle, Tag, CheckCircle2, Calendar, MapPin } from 'lucide-react';

interface Campaign {
  id: string;
  code: string;
  label: string;
  discount_pct: number;
  active: boolean;
  tier_id: string | null;
  tier_name: string | null;
  event_id: string;
  events: { title: string; venue: string | null; event_date: string } | null;
}

type PageState = 'loading' | 'invalid' | 'inactive' | 'ready' | 'applied';

const DiscountLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [campaign, setCampaign]   = useState<Campaign | null>(null);

  const key = `ms_dc_${codigo.toUpperCase()}`;

  useEffect(() => {
    const alreadyApplied = localStorage.getItem(key) === '1';

    supabase
      .from('campaigns')
      .select('id, code, label, discount_pct, active, tier_id, tier_name, event_id, events(title, venue, event_date)')
      .eq('code', codigo.toUpperCase())
      .eq('type', 'discount')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setPageState('invalid'); return; }
        setCampaign(data as unknown as Campaign);
        if (!data.active) { setPageState('inactive'); return; }
        if (alreadyApplied) { setPageState('applied'); return; }
        setPageState('ready');
      });
  }, [codigo]);

  function applyDiscount() {
    if (!campaign) return;
    localStorage.setItem('ms_dc_code',    campaign.code);
    localStorage.setItem('ms_dc_pct',     String(campaign.discount_pct));
    localStorage.setItem('ms_dc_label',   campaign.label);
    if (campaign.tier_id)   localStorage.setItem('ms_dc_tier_id',   campaign.tier_id);
    if (campaign.tier_name) localStorage.setItem('ms_dc_tier_name', campaign.tier_name);
    localStorage.setItem(key, '1');
    setPageState('applied');
  }

  const ev = campaign?.events;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const root: React.CSSProperties = { minHeight: '100vh', background: '#070707', fontFamily: "'Cormorant Garamond',Georgia,serif", color: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' };
  const wrap: React.CSSProperties = { position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 500, width: '100%', padding: '32px 24px' };
  const mono: React.CSSProperties = { fontFamily: "'Space Mono',monospace" };
  const gold = '#C9A84C';

  if (pageState === 'loading') {
    return (
      <div style={{ ...root }}>
        <Loader2 style={{ width: 32, height: 32, color: gold, animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (pageState === 'invalid' || pageState === 'inactive') {
    return (
      <div style={{ ...root, flexDirection: 'column', padding: 32, textAlign: 'center' }}>
        <AlertTriangle style={{ width: 52, height: 52, color: '#FF4444', marginBottom: 20 }} />
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 900, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: -1 }}>
          {pageState === 'invalid' ? 'Código no válido' : 'Descuento inactivo'}
        </h1>
        <p style={{ color: '#444', ...mono, fontSize: 11, letterSpacing: 2 }}>
          {pageState === 'invalid' ? 'Este enlace de descuento no existe.' : 'Este descuento ya no está disponible.'}
        </p>
      </div>
    );
  }

  return (
    <div style={root}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 110% 65% at 50% 0%,#0D0814 0%,#070707 55%)' }} />
      <div style={{ position: 'fixed', top: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(circle,#C9A84C05 0%,transparent 65%)' }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes dc_in     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dc_pop    { 0%{transform:scale(.5);opacity:0} 80%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        @keyframes dc_glow   { 0%,100%{box-shadow:0 0 30px #C9A84C33} 50%{box-shadow:0 0 60px #C9A84C66} }
      `}</style>

      {/* APPLIED STATE */}
      {pageState === 'applied' && (
        <div style={{ ...wrap, animation: 'dc_in .6s ease' }}>
          <div style={{ marginBottom: 28 }}>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 900, letterSpacing: '-.1em', color: '#fff' }}>MIDNIGHT</span>
            <span style={{ display: 'block', fontSize: 8, fontWeight: 300, letterSpacing: '.8em', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginTop: 2 }}>Worldwide</span>
          </div>

          <CheckCircle2 style={{ width: 64, height: 64, color: '#4ade80', marginBottom: 16, animation: 'dc_pop .6s ease' }} />
          <div style={{ letterSpacing: 8, fontSize: 9, color: '#C9A84C88', ...mono, marginBottom: 10 }}>DESCUENTO ACTIVADO</div>
          <h2 style={{ fontSize: 32, fontWeight: 400, margin: '0 0 4px' }}>
            {campaign?.discount_pct}% de descuento
          </h2>
          {campaign?.tier_name && (
            <p style={{ color: '#AAA098', fontSize: 13, marginBottom: 8, ...mono }}>
              Válido para: <strong style={{ color: '#F5F0E8' }}>{campaign.tier_name}</strong>
            </p>
          )}
          <p style={{ color: '#555', fontSize: 11, marginBottom: 32, ...mono }}>{campaign?.label}</p>

          <div style={{ background: '#0D1A0D', border: '1px solid #2D5A27', borderRadius: 8, padding: '14px 18px', maxWidth: 360, textAlign: 'left', display: 'flex', gap: 12, marginBottom: 28 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
            <p style={{ color: '#AAA098', fontSize: 11, lineHeight: 1.7, margin: 0, ...mono }}>
              El descuento se aplica automáticamente al comprar tu entrada.
              {campaign?.tier_name && <span style={{ display: 'block', marginTop: 4, color: '#555' }}>Solo válido para la boleta <strong style={{ color: '#F5F0E8' }}>{campaign.tier_name}</strong>.</span>}
            </p>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            style={{ background: 'linear-gradient(135deg,#C9A84C 0%,#A07820 50%,#C9A84C 100%)', color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '15px 40px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1.5, ...mono, boxShadow: '0 0 40px #C9A84C44' }}
          >
            Comprar entrada →
          </button>
        </div>
      )}

      {/* READY STATE */}
      {pageState === 'ready' && (
        <div style={{ ...wrap, animation: 'dc_in .8s ease' }}>
          {/* Logo */}
          <div style={{ marginBottom: 24 }}>
            <span style={{ display: 'block', fontSize: 22, fontWeight: 900, letterSpacing: '-.1em', color: '#fff' }}>MIDNIGHT</span>
            <span style={{ display: 'block', fontSize: 8, fontWeight: 300, letterSpacing: '.8em', color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginTop: 2 }}>Worldwide</span>
          </div>

          {/* Discount badge */}
          <div style={{
            width: 150, height: 150, borderRadius: '50%',
            border: `2px solid ${gold}`,
            background: `radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)`,
            boxShadow: `0 0 60px rgba(201,168,76,0.25)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
            animation: 'dc_glow 2s ease-in-out infinite',
          }}>
            <Tag style={{ color: gold, width: 22, height: 22, marginBottom: 6 }} />
            <span style={{ color: gold, fontFamily: 'Georgia,serif', fontWeight: 900, fontSize: 48, lineHeight: 1 }}>
              {campaign?.discount_pct}%
            </span>
            <span style={{ color: 'rgba(201,168,76,0.6)', ...mono, fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 4 }}>
              off
            </span>
          </div>

          {/* Tier badge */}
          {campaign?.tier_name && (
            <div style={{ background: '#C9A84C15', border: '1px solid #C9A84C30', borderRadius: 6, padding: '8px 16px', marginBottom: 20 }}>
              <p style={{ color: gold, ...mono, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
                🎟 Válido para: {campaign.tier_name}
              </p>
            </div>
          )}

          {/* Event info */}
          {ev && (
            <div style={{ marginBottom: 28, background: '#0C0C0C', border: '1px solid #1A1A1A', borderRadius: 12, padding: '18px 24px', width: '100%', maxWidth: 380 }}>
              <p style={{ color: '#555', ...mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, margin: '0 0 10px' }}>
                {campaign?.label}
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', letterSpacing: -.3 }}>{ev.title}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ev.event_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: gold, fontSize: 12, ...mono }}>
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

          <button
            onClick={applyDiscount}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,#C9A84C 0%,#A07820 50%,#C9A84C 100%)', backgroundSize: '200% 100%', color: '#0A0A0A', border: 'none', borderRadius: 4, padding: '15px 36px', fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1.5, ...mono, boxShadow: '0 0 40px #C9A84C44' }}
          >
            <span>Activar descuento</span><span style={{ fontSize: 16 }}>→</span>
          </button>

          <p style={{ marginTop: 14, color: '#333', fontSize: 10, letterSpacing: 1.5, ...mono }}>
            El descuento se aplica al comprar tu entrada
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscountLanding;
