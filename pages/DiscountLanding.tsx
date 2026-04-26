import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertTriangle, Tag, CheckCircle2 } from 'lucide-react';

interface Campaign {
  id: string;
  code: string;
  label: string;
  discount_pct: number;
  active: boolean;
  events: { title: string; venue: string | null; event_date: string } | null;
}

type ViewState = 'loading' | 'invalid' | 'inactive' | 'ready' | 'applied';

const DiscountLanding: React.FC<{ codigo: string }> = ({ codigo }) => {
  const [view,     setView]     = useState<ViewState>('loading');
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    const key = `ms_dc_${codigo}`;
    const alreadyApplied = localStorage.getItem(key) === '1';
    if (alreadyApplied) { setView('applied'); }

    supabase
      .from('campaigns')
      .select('id, code, label, discount_pct, active, events(title, venue, event_date)')
      .eq('code', codigo.toUpperCase())
      .eq('type', 'discount')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setView('invalid'); return; }
        setCampaign(data as unknown as Campaign);
        if (!data.active) { setView('inactive'); return; }
        if (alreadyApplied) { setView('applied'); return; }
        setView('ready');
      });
  }, [codigo]);

  function applyDiscount() {
    if (!campaign) return;
    localStorage.setItem('ms_dc_code',   campaign.code);
    localStorage.setItem('ms_dc_pct',    String(campaign.discount_pct));
    localStorage.setItem('ms_dc_label',  campaign.label);
    localStorage.setItem(`ms_dc_${campaign.code}`, '1');
    setView('applied');
  }

  const bg = '#070707';
  const gold = '#C9A84C';

  if (view === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ color: gold, width: 32, height: 32, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (view === 'invalid' || view === 'inactive') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <AlertTriangle style={{ color: '#ef4444', width: 64, height: 64, marginBottom: 24 }} />
        <h1 style={{ color: 'white', fontFamily: 'sans-serif', fontWeight: 900, fontSize: 24, textTransform: 'uppercase', letterSpacing: '-0.05em', marginBottom: 8 }}>
          {view === 'invalid' ? 'Código no válido' : 'Código inactivo'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12 }}>
          {view === 'invalid' ? 'Este enlace de descuento no existe.' : 'Este descuento ya no está disponible.'}
        </p>
      </div>
    );
  }

  const event = campaign?.events;

  if (view === 'applied') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ color: 'white', fontFamily: 'sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '-0.1em' }}>MIDNIGHT</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.8em', textTransform: 'uppercase', marginTop: -2 }}>Worldwide</div>
        </div>

        <CheckCircle2 style={{ color: '#4ade80', width: 80, height: 80, marginBottom: 24 }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 8 }}>
          Descuento activado
        </p>
        <h2 style={{ color: 'white', fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 28, marginBottom: 4 }}>
          {campaign?.discount_pct ?? '?'}% de descuento
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 11, marginBottom: 40 }}>
          {campaign?.label}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: 10, marginBottom: 24 }}>
          El descuento se aplica automáticamente al comprar tu entrada.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: gold, color: '#0a0a0a', border: 'none', borderRadius: 50,
            padding: '14px 40px', fontFamily: 'monospace', fontWeight: 700,
            fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          Ir al evento →
        </button>
      </div>
    );
  }

  // ready
  return (
    <div style={{ position: 'fixed', inset: 0, background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ color: 'white', fontFamily: 'sans-serif', fontWeight: 900, fontSize: 22, letterSpacing: '-0.1em' }}>MIDNIGHT</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.8em', textTransform: 'uppercase', marginTop: -2 }}>Worldwide</div>
      </div>

      {/* Discount badge */}
      <div style={{
        width: 160, height: 160, borderRadius: '50%', border: `2px solid ${gold}`,
        background: `radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)`,
        boxShadow: `0 0 60px rgba(201,168,76,0.25)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        marginBottom: 36,
      }}>
        <Tag style={{ color: gold, width: 28, height: 28, marginBottom: 8 }} />
        <span style={{ color: gold, fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 44, lineHeight: 1 }}>
          {campaign?.discount_pct}%
        </span>
        <span style={{ color: 'rgba(201,168,76,0.6)', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 4 }}>
          off
        </span>
      </div>

      {/* Campaign info */}
      <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 10 }}>
        {campaign?.label}
      </p>
      {event && (
        <h1 style={{ color: 'white', fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 28, letterSpacing: '-0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
          {event.title}
        </h1>
      )}
      {event?.venue && (
        <p style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 40 }}>
          {event.venue}
        </p>
      )}

      <button
        onClick={applyDiscount}
        style={{
          background: gold, color: '#0a0a0a', border: 'none', borderRadius: 50,
          padding: '16px 48px', fontFamily: 'monospace', fontWeight: 700,
          fontSize: 11, letterSpacing: '0.35em', textTransform: 'uppercase', cursor: 'pointer',
          boxShadow: `0 0 30px rgba(201,168,76,0.4)`,
        }}
      >
        Activar descuento
      </button>

      <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        El descuento se aplica al comprar tu entrada
      </p>
    </div>
  );
};

export default DiscountLanding;
