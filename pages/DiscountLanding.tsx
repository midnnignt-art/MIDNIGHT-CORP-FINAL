import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DiscountLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  const [pct,   setPct]   = useState<number | null>(null);
  const [label, setLabel] = useState('');

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('code, label, discount_pct, active, tier_id, tier_name, event_id')
      .eq('code', codigo.toUpperCase())
      .eq('type', 'discount')
      .maybeSingle()
      .then(({ data }) => {
        if (data && data.active) {
          sessionStorage.setItem('ms_dc_code',     data.code);
          sessionStorage.setItem('ms_dc_pct',      String(data.discount_pct));
          sessionStorage.setItem('ms_dc_label',    data.label);
          sessionStorage.setItem('ms_dc_event_id', data.event_id ?? '');
          if (data.tier_id)   sessionStorage.setItem('ms_dc_tier_id',   data.tier_id);
          if (data.tier_name) sessionStorage.setItem('ms_dc_tier_name', data.tier_name);
          setPct(data.discount_pct);
          setLabel(data.label);
        }
        setTimeout(() => { window.location.href = '/'; }, 1200);
      });
  }, [codigo]);

  const mono: React.CSSProperties = { fontFamily: "'Space Mono',monospace" };

  return (
    <div style={{
      minHeight: '100vh', background: '#050505',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Cormorant Garamond',Georgia,serif", color: '#F5F0E8',
      position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap');
        @keyframes dl_in  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dl_dot { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes dl_bar { from{width:0} to{width:100%} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>

      {/* Background glow */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(73,15,124,0.1), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 30%, rgba(201,168,76,0.06), transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px', animation: 'dl_in .6s ease' }}>
        {/* Logo */}
        <div style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.1em', color: '#fff', ...mono, lineHeight: 1 }}>MIDNIGHT</span>
          <span style={{ fontSize: 7, letterSpacing: '0.8em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginTop: 3, ...mono }}>Worldwide</span>
        </div>

        {pct !== null ? (
          <>
            {/* Discount badge */}
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(201,168,76,0.08)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginBottom: 20, boxShadow: '0 0 60px rgba(201,168,76,0.15)' }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#C9A84C', lineHeight: 1, ...mono }}>{pct}%</span>
              <span style={{ fontSize: 8, color: 'rgba(201,168,76,0.6)', letterSpacing: 2, ...mono, textTransform: 'uppercase' }}>OFF</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 300, margin: '0 0 6px', letterSpacing: -.3 }}>Descuento aplicado</h2>
            {label && <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, ...mono, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 24 }}>{label}</p>}
          </>
        ) : (
          <>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(201,168,76,0.3)', borderTopColor: '#C9A84C', animation: 'spin 1s linear infinite', marginBottom: 24 }} />
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, ...mono, letterSpacing: 2, textTransform: 'uppercase' }}>Aplicando descuento...</p>
          </>
        )}

        {/* Progress bar */}
        <div style={{ marginTop: 24, width: 180, height: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(to right, #490F7C, #C9A84C)', animation: 'dl_bar 1.2s ease forwards' }} />
        </div>
        <p style={{ marginTop: 10, color: 'rgba(255,255,255,0.12)', fontSize: 9, ...mono, letterSpacing: 2, textTransform: 'uppercase', animation: 'dl_dot .8s step-end infinite' }}>Redirigiendo...</p>
      </div>
    </div>
  );
};

export default DiscountLanding;
