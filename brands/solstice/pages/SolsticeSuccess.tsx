import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Ship, BedDouble, AlertCircle, Sun, ChevronRight } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981' };

interface SchedulePaid {
  installment_number: number;
  amount: number;
  paid_at: string | null;
  status: string;
  registration_id: string;
}

interface RegPaid {
  customer_name: string;
  customer_email: string;
  customer_university: string;
  order_number: string;
  amount_paid: number;
  total_amount: number;
  installments_remaining: number;
}

type FetchState = 'loading' | 'ready' | 'pending' | 'error';

export default function SolsticeSuccess() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const scheduleId = params.get('schedule');
  const registrationParam = params.get('registration');
  // Wompi vuelve con ?id=<wompi_tx>&reference=SOL-XXX&status=APPROVED|DECLINED|...
  const wompiRef    = params.get('reference');
  const wompiStatus = (params.get('status') || '').toUpperCase();

  const [state, setState]       = useState<FetchState>('loading');
  const [schedule, setSchedule] = useState<SchedulePaid | null>(null);
  const [reg, setReg]           = useState<RegPaid | null>(null);
  const [polls, setPolls]       = useState(0);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    document.title = 'Pago confirmado · Solstice';
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pollCount = 0;

    async function fetchOnce() {
      try {
        if (scheduleId) {
          const { data: s } = await supabase
            .from('solstice_payment_schedules')
            .select('installment_number, amount, paid_at, status, registration_id')
            .eq('id', scheduleId)
            .maybeSingle();

          if (!s) {
            if (!cancelled) setState('error');
            return;
          }

          if (s.status !== 'paid') {
            // Webhook puede tardar — polling cada 3s hasta 6 intentos (~18s)
            if (pollCount >= 6) {
              if (!cancelled) {
                setSchedule(s as any);
                setState('pending');
              }
              return;
            }
            pollCount++;
            if (!cancelled) setPolls(pollCount);
            setTimeout(fetchOnce, 3000);
            return;
          }

          // Cuota confirmada — cargamos también el reg
          const { data: r } = await supabase
            .from('solstice_registrations')
            .select('customer_name, customer_email, customer_university, order_number, amount_paid, total_amount, installments_remaining')
            .eq('id', s.registration_id)
            .maybeSingle();

          if (!cancelled) {
            setSchedule(s as any);
            setReg(r as any);
            setState('ready');
          }
        } else if (registrationParam) {
          const { data: r } = await supabase
            .from('solstice_registrations')
            .select('customer_name, customer_email, customer_university, order_number, amount_paid, total_amount, installments_remaining, status')
            .eq('id', registrationParam)
            .maybeSingle();
          if (!r) {
            if (!cancelled) setState('error');
            return;
          }
          if (r.status !== 'active' && pollCount < 6) {
            pollCount++;
            if (!cancelled) setPolls(pollCount);
            setTimeout(fetchOnce, 3000);
            return;
          }
          if (!cancelled) {
            setReg(r as any);
            setState(r.status === 'active' ? 'ready' : 'pending');
          }
        } else if (wompiRef) {
          // Llegamos desde Wompi Web Checkout → lookup por bold_order_id (legacy)
          if (wompiStatus === 'DECLINED' || wompiStatus === 'VOIDED' || wompiStatus === 'ERROR') {
            if (!cancelled) setState('error');
            return;
          }
          const { data: r } = await supabase
            .from('solstice_registrations')
            .select('customer_name, customer_email, customer_university, order_number, amount_paid, total_amount, installments_remaining, status')
            .eq('bold_order_id', wompiRef)
            .maybeSingle();
          if (!r) {
            if (!cancelled) setState('error');
            return;
          }
          if (r.status !== 'active' && pollCount < 6) {
            pollCount++;
            if (!cancelled) setPolls(pollCount);
            setTimeout(fetchOnce, 3000);
            return;
          }
          if (!cancelled) {
            setReg(r as any);
            setState(r.status === 'active' ? 'ready' : 'pending');
          }
        } else {
          if (!cancelled) setState('ready');
        }
      } catch (err: any) {
        if (!cancelled) setState('error');
      }
    }

    fetchOnce();
    return () => { cancelled = true; };
  }, [scheduleId, registrationParam, wompiRef, wompiStatus]);

  const firstName = (reg?.customer_name || '').split(' ')[0] || '¡Listo!';
  const amtK = schedule ? Math.round(schedule.amount / 1000) : 0;
  const remaining = reg?.installments_remaining ?? 0;
  const paidK = reg ? Math.round(reg.amount_paid / 1000) : 0;
  const totalK = reg ? Math.round(reg.total_amount / 1000) : 0;
  const progressPct = reg && reg.total_amount > 0 ? Math.min(100, (reg.amount_paid / reg.total_amount) * 100) : 0;

  // ─── Loading ───────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}
        className="flex flex-col items-center justify-center px-6 gap-4">
        <Loader2 className="animate-spin" size={32} style={{ color: C.red }} />
        <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.25em' }}>
          Confirmando tu pago{polls > 0 ? `... reintento ${polls}/6` : '...'}
        </p>
      </div>
    );
  }

  // ─── Pending (webhook tardó más de 18s) ─────────────────────────────────
  if (state === 'pending') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}
        className="flex flex-col items-center justify-center px-6 gap-5 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,180,140,0.15)', border: '0.5px solid rgba(255,180,140,0.45)' }}>
          <AlertCircle size={26} style={{ color: '#FFB48C' }} />
        </div>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
          Procesando pago
        </h1>
        <p className="text-sm max-w-sm" style={{ color: C.gray, lineHeight: 1.55 }}>
          Bold ya recibió el pago. Estamos esperando la confirmación final — usualmente toma menos de 1 minuto. Refrescá esta página o revisá tu email.
        </p>
        <a href="/sol" className="mt-4 text-xs uppercase"
          style={{ color: C.red, letterSpacing: '0.25em', textDecoration: 'underline', fontWeight: 600 }}>
          Volver a Solstice →
        </a>
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}
        className="flex flex-col items-center justify-center px-6 gap-4 text-center">
        <AlertCircle size={28} style={{ color: C.red }} />
        <h1 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>
          No pudimos confirmar
        </h1>
        <p className="text-xs uppercase max-w-sm" style={{ color: C.gray, letterSpacing: '0.15em' }}>
          Revisá tu inbox o entrá a Mi semana — si el pago pasó, verás tu cuota actualizada.
        </p>
        <a href="/sol" className="mt-2 text-xs uppercase"
          style={{ color: C.red, letterSpacing: '0.25em', textDecoration: 'underline', fontWeight: 600 }}>
          Volver a Solstice
        </a>
      </div>
    );
  }

  // ─── Ready ──────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Sunset gradient atmosphere */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(230,57,47,0.20) 0%, transparent 70%),
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,122,0,0.08) 0%, transparent 60%),
            #000
          `,
        }}
      />

      {/* Confetti partículas */}
      <ConfettiBurst />

      <div className="relative z-10 max-w-md mx-auto px-6 py-14 md:py-20">
        {/* Check animado */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 14 }}
          className="relative w-24 h-24 mx-auto mb-8"
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(230,57,47,0.5) 0%, rgba(230,57,47,0.15) 50%, transparent 80%)',
              filter: 'blur(20px)',
              animation: 'pulse 2.5s ease-in-out infinite',
            }}
          />
          <div
            className="relative w-full h-full rounded-full flex items-center justify-center"
            style={{
              background: C.red,
              boxShadow: '0 0 50px rgba(230,57,47,0.6), inset 0 -10px 20px rgba(0,0,0,0.2)',
            }}
          >
            <CheckCircle2 size={42} style={{ color: C.cream }} strokeWidth={2} />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8"
        >
          <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            {schedule ? `Cuota ${schedule.installment_number} pagada` : 'Pago confirmado'}
          </p>
          <h1 className="uppercase mb-3"
            style={{
              fontFamily: "'Poiret One', sans-serif",
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              letterSpacing: '-0.01em',
              fontWeight: 300,
              lineHeight: 1.05,
            }}
          >
            ¡Gracias,<br/>{firstName}!
          </h1>
          {schedule && (
            <p className="text-base" style={{ color: C.gray, fontFamily: "'Archivo', sans-serif" }}>
              Recibimos <strong style={{ color: C.cream }}>${amtK}K</strong> de tu cuota mensual.
            </p>
          )}
        </motion.div>

        {/* Progress card */}
        {reg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(28px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              padding: '22px',
              marginBottom: '24px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.40)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                Tu progreso
              </span>
              <span className="text-[10px] uppercase tabular-nums" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                ${paidK}K / ${totalK}K
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                className="h-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ delay: 1.0, duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: progressPct >= 100 ? C.green : C.red,
                  borderRadius: '999px',
                  boxShadow: progressPct >= 100 ? '0 0 12px rgba(16,185,129,0.5)' : '0 0 8px rgba(230,57,47,0.4)',
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl tabular-nums" style={{ fontFamily: "'Poiret One', sans-serif", color: C.cream, fontWeight: 300 }}>
                {progressPct.toFixed(0)}%
              </span>
              <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 600 }}>
                {remaining > 0
                  ? `${remaining} cuota${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`
                  : '✓ Combo completo'}
              </span>
            </div>
          </motion.div>
        )}

        {/* Next steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="space-y-2.5 mb-6"
        >
          <NextStep icon={<Sun size={14} />} title="Email enviado" desc="Acabamos de mandarte el recibo a tu inbox" />
          {remaining > 0 && (
            <NextStep icon={<CheckCircle2 size={14} />} title={`Próxima cuota`} desc={`Te avisaremos 24h antes del próximo cobro`} />
          )}
          {remaining === 0 && reg && (
            <NextStep icon={<Ship size={14} />} title="Lo lograste" desc="Tu combo Solstice está 100% pagado · llevamos cuenta de tu pase" />
          )}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="space-y-3"
        >
          <a
            href="/sol"
            className="w-full flex items-center justify-center gap-3 py-4 text-sm uppercase"
            style={{
              background: C.red,
              color: '#fff',
              letterSpacing: '0.2em',
              borderRadius: '999px',
              fontWeight: 600,
              boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
              textDecoration: 'none',
            }}
          >
            <Sun size={16} />
            Volver a Solstice
            <ChevronRight size={16} />
          </a>
        </motion.div>

        <p className="text-[9px] uppercase text-center mt-8" style={{ color: `${C.gray}aa`, letterSpacing: '0.25em' }}>
          Orden: <span className="font-mono">{reg?.order_number || '—'}</span>
        </p>
      </div>
    </div>
  );
}

function NextStep({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '0.5px solid rgba(255,255,255,0.06)',
        borderRadius: '14px',
      }}>
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: `${C.red}20`, color: C.red }}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] uppercase mb-0.5" style={{ color: C.cream, letterSpacing: '0.12em', fontWeight: 600 }}>
          {title}
        </p>
        <p className="text-[10px]" style={{ color: C.gray, lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const PIECES = 28;
  const items = Array.from({ length: PIECES }, (_, i) => i);
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {items.map(i => {
        const angle = (Math.random() - 0.5) * 180;
        const distance = 120 + Math.random() * 280;
        const size = 4 + Math.random() * 7;
        const colors = ['#E6392F', '#F9F2D7', '#FFB48C', '#FF7A00'];
        const color = colors[i % colors.length];
        const delay = Math.random() * 0.3;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * distance,
              y: Math.sin((angle * Math.PI) / 180) * distance * 0.6 + 200,
              rotate: 360 + Math.random() * 360,
              scale: 0.3,
            }}
            transition={{ duration: 1.8 + Math.random() * 0.8, delay, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '18%',
              left: '50%',
              width: `${size}px`,
              height: `${size * 0.4}px`,
              background: color,
              borderRadius: '2px',
            }}
          />
        );
      })}
    </div>
  );
}
