import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ScanLine } from 'lucide-react';

type LinkState = 'loading' | 'invalid' | 'ready';
type ScanStatus = 'idle' | 'success' | 'used' | 'invalid';

interface BouncerLink {
  token: string;
  event_id: string;
  label: string;
  active: boolean;
}

interface EventInfo {
  id: string;
  title: string;
  venue: string;
  event_date: string;
}

const BouncerScanner: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('t') ?? '';

  const [linkState, setLinkState]   = useState<LinkState>('loading');
  const [link,      setLink]        = useState<BouncerLink | null>(null);
  const [event,     setEvent]       = useState<EventInfo | null>(null);
  const [scanning,  setScanning]    = useState(false);
  const [camReady,  setCamReady]    = useState(false);
  const [camError,  setCamError]    = useState<string | null>(null);
  const [result,    setResult]      = useState<{ status: ScanStatus; message: string }>({ status: 'idle', message: '' });

  const scannerRef   = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  // ── Validate token on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setLinkState('invalid'); return; }

    supabase
      .from('bouncer_links')
      .select('token, event_id, label, active')
      .eq('token', token)
      .eq('active', true)
      .maybeSingle()
      .then(async ({ data: linkData }) => {
        if (!linkData) { setLinkState('invalid'); return; }

        const { data: eventData } = await supabase
          .from('events')
          .select('id, title, venue, event_date')
          .eq('id', linkData.event_id)
          .maybeSingle();

        if (!eventData) { setLinkState('invalid'); return; }

        setLink(linkData as BouncerLink);
        setEvent(eventData as EventInfo);
        setLinkState('ready');
      });
  }, [token]);

  // ── Auto-clear result after 2.5 s ────────────────────────────────────────────
  useEffect(() => {
    if (result.status === 'idle') return;
    const t = setTimeout(() => {
      setResult({ status: 'idle', message: '' });
      processingRef.current = false;
    }, 2500);
    return () => clearTimeout(t);
  }, [result.status]);

  // ── Start / stop camera ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !link) return;
    let mounted = true;

    const start = async () => {
      try {
        if (scannerRef.current) {
          try { if (scannerRef.current.isScanning) await scannerRef.current.stop(); } catch {}
          scannerRef.current = null;
        }
        const qr = new Html5Qrcode('bouncer-qr');
        scannerRef.current = qr;

        await qr.start(
          { facingMode: 'environment' },
          { fps: 15, qrbox: { width: 240, height: 240 } } as any,
          async (decoded) => {
            if (processingRef.current) return;
            processingRef.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            const res = await validateTicket(decoded.trim().toUpperCase(), link.event_id);
            if (mounted) setResult(res);
          },
          () => {}
        );
        if (mounted) setCamReady(true);
      } catch (err: any) {
        if (mounted) setCamError(err.message || 'No se pudo acceder a la cámara');
      }
    };

    start();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        if (s.isScanning) s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [scanning, link]);

  // ── Ticket validation (direct Supabase, no StoreContext) ────────────────────
  async function validateTicket(orderNumber: string, eventId: string) {
    try {
      const { data, error } = await supabase.rpc('validate_and_burn_ticket', {
        p_order_number: orderNumber,
        p_event_id: eventId,
      });

      if (!error && data) {
        const r = data as { status: string; message: string };
        return {
          status: r.status as ScanStatus,
          message: r.message,
        };
      }

      // Fallback: manual query
      const { data: order } = await supabase
        .from('orders')
        .select('id, used, used_at, event_id, status, customer_name')
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (!order)                     return { status: 'invalid' as ScanStatus, message: '⚠️ Boleto no encontrado' };
      if (order.status !== 'completed') return { status: 'invalid' as ScanStatus, message: '⚠️ Pago no confirmado' };
      if (order.event_id !== eventId) return { status: 'invalid' as ScanStatus, message: '⚠️ Boleto para otro evento' };
      if (order.used)                 return { status: 'used'    as ScanStatus, message: '🚫 Boleto ya utilizado' };

      await supabase.from('orders').update({ used: true, used_at: new Date().toISOString() }).eq('id', order.id);
      return { status: 'success' as ScanStatus, message: `✅ ${order.customer_name || 'Acceso Permitido'}` };
    } catch {
      return { status: 'invalid' as ScanStatus, message: '⚠️ Error de conexión' };
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (linkState === 'loading') {
    return (
      <div className="fixed inset-0 bg-[#070707] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    );
  }

  if (linkState === 'invalid') {
    return (
      <div className="fixed inset-0 bg-[#070707] flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Link inválido</h1>
        <p className="text-white/30 text-sm" style={{ fontFamily: "'Space Mono', monospace" }}>
          Este enlace no existe o fue desactivado.
        </p>
      </div>
    );
  }

  if (!scanning) {
    // ── Landing ──────────────────────────────────────────────────────────────
    return (
      <div className="fixed inset-0 bg-[#070707] flex flex-col items-center justify-center p-8 text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-black tracking-[-0.1em] text-white">MIDNIGHT</span>
            <span className="text-[8px] font-light tracking-[0.8em] text-white/40 uppercase -mt-1 ml-1">Worldwide</span>
          </div>
        </div>

        {/* Event info */}
        <div className="mb-10">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#C9A84C]/60 mb-3"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {link?.label}
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">
            {event?.title}
          </h1>
          {event?.venue && (
            <p className="text-white/30 text-sm font-light tracking-widest uppercase">
              {event.venue}
            </p>
          )}
        </div>

        {/* Scan button */}
        <button
          onClick={() => setScanning(true)}
          className="flex flex-col items-center gap-4 group"
        >
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all duration-300 group-active:scale-95"
            style={{
              borderColor: '#C9A84C',
              background: 'radial-gradient(circle, rgba(201,168,76,0.15) 0%, transparent 70%)',
              boxShadow: '0 0 40px rgba(201,168,76,0.25)',
            }}
          >
            <ScanLine className="w-12 h-12 text-[#C9A84C]" />
          </div>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.4em] text-[#C9A84C]"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            Escanear
          </span>
        </button>

        <p
          className="mt-12 text-[9px] text-white/15 uppercase tracking-[0.25em]"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          Midnight Access Protocol
        </p>
      </div>
    );
  }

  // ── Scanner view ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#070707] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#C9A84C]/60"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {link?.label}
          </p>
          <h2 className="text-base font-black text-white uppercase tracking-tighter">{event?.title}</h2>
        </div>
        <button
          onClick={() => { setScanning(false); setCamReady(false); setCamError(null); }}
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 hover:text-white/60 transition-colors px-3 py-2 border border-white/10 rounded-lg"
          style={{ fontFamily: "'Space Mono', monospace" }}
        >
          Salir
        </button>
      </div>

      {/* Camera area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm aspect-square bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden relative">
          <div id="bouncer-qr" className="w-full h-full" />

          {!camReady && !camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070707]/90 z-10">
              <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin mb-3" />
              <p
                className="text-[10px] uppercase tracking-[0.3em] text-white/30"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Iniciando cámara...
              </p>
            </div>
          )}

          {camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070707]/95 z-10 p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-white text-sm font-black uppercase mb-2">Error de cámara</p>
              <p className="text-white/30 text-xs mb-5">{camError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-full"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Viewfinder overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="w-[240px] h-[240px]"
              style={{ boxShadow: '0 0 0 9999px rgba(7,7,7,0.55)' }}
            />
          </div>
        </div>

        {camReady && result.status === 'idle' && (
          <div className="mt-8 flex items-center gap-2 opacity-30">
            <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
            <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
            <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
        )}

        {/* Result overlay */}
        {result.status !== 'idle' && (
          <div
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center transition-all duration-300 ${
              result.status === 'success' ? 'bg-emerald-900' :
              result.status === 'used'    ? 'bg-red-950'    : 'bg-amber-950'
            }`}
          >
            {result.status === 'success' && <CheckCircle2  size={100} className="text-white mb-6" />}
            {result.status === 'used'    && <XCircle       size={100} className="text-white mb-6" />}
            {result.status === 'invalid' && <AlertTriangle size={100} className="text-white mb-6" />}
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{result.message}</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default BouncerScanner;
