import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Shield, MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const C = { red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981' };

interface Schedule {
  id: string;
  registration_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
}

interface Customer {
  name?: string;
  email?: string;
  phone?: string;
}

interface Props {
  schedule: Schedule | null;
  customer: Customer;
  whatsappNumber?: string;
  onClose: () => void;
}

type Status = 'idle' | 'creating' | 'ready' | 'error';

const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;
const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

export default function SolsticeCuotaPayModal({ schedule, customer, whatsappNumber, onClose }: Props) {
  const [status, setStatus]   = useState<Status>('idle');
  const [errorMsg, setError]  = useState<string | null>(null);

  useEffect(() => {
    if (!schedule) return;
    setStatus('creating');
    setError(null);
    initiateBold(schedule, customer).catch(err => {
      console.error('Bold init error:', err);
      setError(err.message || 'No se pudo conectar con Bold');
      setStatus('error');
    }).then(success => {
      if (success === true) setStatus('ready');
    });

    return () => {
      // Cleanup script al cerrar
      const existing = document.querySelector('script[data-solstice-cuota-bold]');
      if (existing) existing.remove();
      const container = document.getElementById('solstice-cuota-bold-container');
      if (container) container.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule?.id]);

  async function initiateBold(sched: Schedule, cust: Customer): Promise<boolean> {
    // Generamos el orderId: SOL-CUOTA-{first8Chars} para mantener compatibilidad
    // con la regex del create-bold-payment ([A-Z0-9-]{4,64})
    const shortId = sched.id.replace(/-/g, '').substring(0, 12).toUpperCase();
    const orderId = `SOL-CUOTA-${shortId}`;

    // Persistimos bold_order_ref en la BD ANTES de mandar a Bold,
    // para que el webhook pueda mapear ref → schedule.
    const { error: refErr } = await supabase
      .from('solstice_payment_schedules')
      .update({ bold_order_ref: orderId })
      .eq('id', sched.id);
    if (refErr) throw new Error('No se pudo registrar la referencia: ' + refErr.message);

    // Pedimos la firma de integridad
    const { data, error: sigErr } = await supabase.functions.invoke('bold-signature', {
      body: { orderId, amount: sched.amount, currency: 'COP' },
    });
    if (sigErr) throw new Error(sigErr.message || 'Error al firmar la transacción');

    const signature = data?.signature || data?.integritySignature;
    if (!signature) throw new Error('Firma vacía del servidor');

    // Inyectar el script del botón Bold
    const container = document.getElementById('solstice-cuota-bold-container');
    if (!container) throw new Error('Contenedor Bold no encontrado');
    container.innerHTML = '';

    const existing = document.querySelector('script[data-solstice-cuota-bold]');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.setAttribute('data-solstice-cuota-bold', '');
    script.setAttribute('data-bold-button', 'dark-L');
    script.setAttribute('data-api-key', 'HXR9FR8wKFLJmIXK29TyR74ey1l32zVvLvkV4QDyaVY');
    script.setAttribute('data-order-id', orderId);
    script.setAttribute('data-currency', 'COP');
    script.setAttribute('data-amount', String(Math.round(sched.amount)));
    script.setAttribute('data-integrity-signature', signature);
    script.setAttribute('data-redirection-url', `${window.location.origin}/gracias?solstice=1&schedule=${sched.id}`);
    script.setAttribute('data-render-mode', 'embedded');
    if (cust.email || cust.name) {
      script.setAttribute('data-customer-data', JSON.stringify({
        email:    cust.email,
        fullName: cust.name,
        phone:    cust.phone,
        dialCode: '+57',
      }));
    }
    script.src = 'https://checkout.bold.co/library/boldPaymentButton.js';
    container.appendChild(script);

    // El script tarda en cargar — esperamos onload
    return new Promise<boolean>((resolve, reject) => {
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('No se pudo cargar el botón Bold'));
      // Timeout defensivo de 8s
      setTimeout(() => resolve(true), 8000);
    });
  }

  const handleWhatsapp = () => {
    if (!schedule) return;
    const phone = (whatsappNumber || '').replace(/[^0-9+]/g, '') || '573000000000';
    const msg = `Hola, quiero pagar mi cuota #${schedule.installment_number} de Solstice por ${fmt(schedule.amount)}. Mi nombre es ${customer.name || '—'}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <AnimatePresence>
      {schedule && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md"
            style={{
              background: '#0a0a0a',
              border: '0.5px solid rgba(230,57,47,0.40)',
              borderRadius: '28px',
              padding: '32px 24px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.65)',
              fontFamily: "'Archivo', sans-serif",
              color: C.cream,
            }}
          >
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                color: C.gray,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
              onMouseLeave={e => (e.currentTarget.style.color = C.gray)}
            >
              <X size={16} />
            </button>

            <div className="text-center mb-6">
              <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                Cuota {schedule.installment_number}
              </p>
              <h2 className="text-3xl mb-2" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '-0.02em' }}>
                {fmtK(schedule.amount)}
              </h2>
              <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.25em' }}>
                {schedule.status === 'overdue' ? '⚠️ Vencida · ' : 'Vence '}
                {new Date(schedule.due_date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' })}
              </p>
            </div>

            <div className="space-y-4">
              {/* Bold checkout */}
              <div>
                <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 600 }}>
                  Pago seguro
                </p>
                {status === 'creating' && (
                  <div className="py-6 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin" size={20} style={{ color: C.red }} />
                    <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                      Conectando con Bold...
                    </p>
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-start gap-3 p-4"
                    style={{
                      background: 'rgba(230,57,47,0.10)',
                      border: '0.5px solid rgba(230,57,47,0.35)',
                      borderRadius: '14px',
                    }}>
                    <AlertCircle size={14} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} />
                    <p className="text-[11px]" style={{ color: C.red, lineHeight: 1.5 }}>
                      {errorMsg || 'Error al cargar el pago online. Probá WhatsApp abajo.'}
                    </p>
                  </div>
                )}
                <div
                  id="solstice-cuota-bold-container"
                  className="flex justify-center min-h-[60px]"
                  style={{ display: status === 'ready' ? 'flex' : 'none' }}
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-[0.5px]" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <span className="text-[9px] uppercase" style={{ color: `${C.gray}aa`, letterSpacing: '0.25em', fontWeight: 500 }}>O</span>
                <div className="flex-1 h-[0.5px]" style={{ background: 'rgba(255,255,255,0.08)' }} />
              </div>

              {/* WhatsApp fallback */}
              <button
                onClick={handleWhatsapp}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 text-xs uppercase"
                style={{
                  background: 'rgba(16,185,129,0.10)',
                  border: '0.5px solid rgba(16,185,129,0.45)',
                  color: '#10b981',
                  letterSpacing: '0.2em',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.18)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,0.10)';
                }}
              >
                <MessageCircle size={14} />
                Avisar por WhatsApp
              </button>

              {/* Trust strip */}
              <div className="flex items-center justify-center gap-2 pt-2">
                <Shield size={10} style={{ color: `${C.gray}80` }} />
                <span className="text-[9px] uppercase" style={{ color: `${C.gray}aa`, letterSpacing: '0.2em', fontWeight: 500 }}>
                  Transacción cifrada · Bold
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
