import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ScanLine, MapPin, Calendar } from 'lucide-react';

// Página pública (no requiere login). Se accede via /sol/bouncer?t=TOKEN
//
// El token identifica a un solstice_bouncer_links que tiene:
//   - day_number (1..5) — el día específico que controla este puesto
//   - boat_id    (nullable) — si está seteado, solo deja pasar pasajeros
//                              de esa lancha en particular
//   - location   — etiqueta libre ("Puerta 1", "Beach Club", etc)
//   - label      — display para el bouncer
//
// El bouncer abre el link, ve la info del puesto, presiona "Escanear",
// se abre la cámara, y a partir de ahí escanea QRs en loop. Cada QR pasa
// por el RPC `solstice_bouncer_validate_qr` que valida + inserta el checkin
// en una sola operación atómica.

type LinkState = 'loading' | 'invalid' | 'ready';
type ScanStatus = 'idle' | 'success' | 'used' | 'invalid';

interface BouncerLink {
  token: string;
  day_number: number;
  boat_id: string | null;
  location: string | null;
  label: string;
  active: boolean;
}

interface BoatInfo {
  id: string;
  name: string;
}

const SolsticeBouncerScanner: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('t') ?? '';

  const [linkState, setLinkState] = useState<LinkState>('loading');
  const [link, setLink] = useState<BouncerLink | null>(null);
  const [boat, setBoat] = useState<BoatInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: ScanStatus; message: string; customer?: string; uni?: string }>({ status: 'idle', message: '' });
  const [scanCount, setScanCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  // ── Validate token on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setLinkState('invalid'); return; }
    let active = true;

    (async () => {
      const { data: linkData } = await supabase
        .from('solstice_bouncer_links')
        .select('token, day_number, boat_id, location, label, active')
        .eq('token', token)
        .eq('active', true)
        .maybeSingle();

      if (!active) return;
      if (!linkData) { setLinkState('invalid'); return; }

      // Cargar info de la lancha si aplica
      if (linkData.boat_id) {
        const { data: boatData } = await supabase
          .from('solstice_boats')
          .select('id, name')
          .eq('id', linkData.boat_id)
          .maybeSingle();
        if (active) setBoat(boatData as BoatInfo | null);
      }

      if (active) {
        setLink(linkData as BouncerLink);
        setLinkState('ready');
      }
    })();

    return () => { active = false; };
  }, [token]);

  // ── Auto-clear result ───────────────────────────────────────────────────────
  useEffect(() => {
    if (result.status === 'idle') return;
    const t = setTimeout(() => {
      setResult({ status: 'idle', message: '' });
      processingRef.current = false;
    }, 2400);
    return () => clearTimeout(t);
  }, [result.status]);

  // ── Camera lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !link) return;
    let mounted = true;

    const start = async () => {
      try {
        const qr = new Html5Qrcode('sol-bouncer-qr');
        scannerRef.current = qr;
        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decoded) => {
            if (processingRef.current) return;
            processingRef.current = true;
            const orderNumber = decoded.includes('?')
              ? decoded.split('?')[0].split('/').pop() || decoded
              : decoded.trim();

            const res = await validateScan(orderNumber);
            if (!mounted) return;
            setResult(res);
            setScanCount(c => c + 1);
            // small vibration on iOS+Android
            if ('vibrate' in navigator) {
              navigator.vibrate(res.status === 'success' ? 60 : res.status === 'used' ? 100 : [80, 40, 80]);
            }
          },
          () => { /* swallow per-frame decode errors */ },
        );
      } catch (e: any) {
        setCamError(e?.message || 'No se pudo iniciar la cámara');
        setScanning(false);
      }
    };

    start();
    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          try { scannerRef.current?.clear(); } catch { /* noop */ }
        }).catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [scanning, link]);

  // ── Validate via RPC ────────────────────────────────────────────────────────
  const validateScan = async (orderNumber: string) => {
    const { data, error } = await supabase.rpc('solstice_bouncer_validate_qr', {
      p_token: token,
      p_order_number: orderNumber,
    });
    if (error) {
      return { status: 'invalid' as ScanStatus, message: '⚠️ Error de conexión' };
    }
    return {
      status: (data?.status || 'invalid') as ScanStatus,
      message: data?.message || 'Sin respuesta',
      customer: data?.customer_name,
      uni: data?.university,
    };
  };

  // ── UI ──────────────────────────────────────────────────────────────────────

  if (linkState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-cream">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#E6392F' }} />
      </div>
    );
  }

  if (linkState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-6">
        <div className="max-w-sm text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#E6392F' }} />
          <h1 className="text-xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', color: '#F9F2D7' }}>
            Link inválido
          </h1>
          <p className="text-xs uppercase" style={{ letterSpacing: '0.18em', color: '#606060' }}>
            Pedile a un admin un link nuevo
          </p>
        </div>
      </div>
    );
  }

  // ready
  return (
    <div className="min-h-screen bg-black text-white pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(230,57,47,0.18)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ScanLine size={16} style={{ color: '#E6392F' }} />
          <p className="text-[10px] uppercase font-bold" style={{ letterSpacing: '0.3em', color: '#E6392F' }}>
            Solstice · Bouncer
          </p>
        </div>
        <h1 className="text-2xl mb-3" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.02em', fontWeight: 300, color: '#F9F2D7' }}>
          {link?.label}
        </h1>
        <div className="flex flex-wrap gap-2 text-[10px] uppercase">
          <span className="px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(230,57,47,0.12)', color: '#E6392F', letterSpacing: '0.15em' }}>
            <Calendar size={10} /> Día {link?.day_number}
          </span>
          {link?.location && (
            <span className="px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.06)', color: '#F9F2D7', letterSpacing: '0.15em' }}>
              <MapPin size={10} /> {link.location}
            </span>
          )}
          {boat && (
            <span className="px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,122,0,0.12)', color: '#FFB48C', letterSpacing: '0.15em' }}>
              ⛵ {boat.name}
            </span>
          )}
        </div>
      </div>

      {/* Scan button + cam */}
      <div className="px-5 mt-6">
        {!scanning ? (
          <button
            onClick={() => { setCamError(null); setScanning(true); }}
            className="w-full py-5 rounded-2xl text-sm uppercase font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #E6392F 0%, #B0241C 100%)',
              boxShadow: '0 10px 40px rgba(230,57,47,0.35)',
              letterSpacing: '0.25em',
              color: '#fff',
            }}
          >
            <ScanLine size={18} /> Escanear
          </button>
        ) : (
          <button
            onClick={() => setScanning(false)}
            className="w-full py-3 rounded-2xl text-xs uppercase font-medium border"
            style={{
              borderColor: 'rgba(255,255,255,0.18)',
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.25em',
            }}
          >
            Cerrar cámara
          </button>
        )}

        {camError && (
          <div className="mt-4 p-3 rounded-xl text-xs flex items-start gap-2" style={{ background: 'rgba(230,57,47,0.12)', color: '#E6392F' }}>
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{camError}</span>
          </div>
        )}

        {/* Camera viewport */}
        <div className={`mt-5 ${scanning ? 'block' : 'hidden'}`}>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(230,57,47,0.25)' }}>
            <div id="sol-bouncer-qr" />
          </div>
          <p className="mt-3 text-center text-[10px] uppercase" style={{ letterSpacing: '0.25em', color: '#606060' }}>
            Apuntá la cámara al QR del cliente
          </p>
        </div>
      </div>

      {/* Result toast inline */}
      {result.status !== 'idle' && (
        <div className="fixed inset-x-0 top-0 z-50 px-5 pt-4 pointer-events-none">
          <div
            className="rounded-2xl p-4 backdrop-blur-xl border flex items-center gap-3 shadow-2xl"
            style={{
              background:
                result.status === 'success' ? 'rgba(16,185,129,0.18)' :
                result.status === 'used'    ? 'rgba(245,158,11,0.18)' :
                                              'rgba(230,57,47,0.18)',
              borderColor:
                result.status === 'success' ? 'rgba(16,185,129,0.5)' :
                result.status === 'used'    ? 'rgba(245,158,11,0.5)' :
                                              'rgba(230,57,47,0.5)',
            }}
          >
            {result.status === 'success' && <CheckCircle2 size={22} className="shrink-0" style={{ color: '#10b981' }} />}
            {result.status === 'used'    && <AlertTriangle size={22} className="shrink-0" style={{ color: '#f59e0b' }} />}
            {result.status === 'invalid' && <XCircle        size={22} className="shrink-0" style={{ color: '#E6392F' }} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#F9F2D7' }}>
                {result.message}
              </p>
              {result.customer && (
                <p className="text-[11px] truncate" style={{ color: 'rgba(249,242,215,0.7)' }}>
                  {result.customer}
                  {result.uni ? ` · ${result.uni}` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Counter */}
      <div className="px-5 mt-8">
        <div className="flex items-center justify-between text-[10px] uppercase" style={{ letterSpacing: '0.25em', color: '#606060' }}>
          <span>Escaneos esta sesión</span>
          <span className="font-bold" style={{ color: '#F9F2D7' }}>{scanCount}</span>
        </div>
      </div>
    </div>
  );
};

export default SolsticeBouncerScanner;
