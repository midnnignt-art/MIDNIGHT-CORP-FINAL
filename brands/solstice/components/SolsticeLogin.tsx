import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Loader2, ChevronRight, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useStore } from '../../../context/StoreContext';

// Login de COMPRADOR Solstice — email + código OTP (mismo flujo que el checkout).
// Al verificar, el store setea currentCustomer y entramos a "Mi Semana".
// (Antes el botón "Iniciar sesión" abría por error el MagicPanel de Midnight.)

const C = { red: '#E6392F', cream: '#F9F2D7', gray: '#606060', bg: '#0a0000' };
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SolsticeLogin({ isOpen, onClose, onSuccess }: Props) {
  const { requestCustomerOtp, verifyOtpUnified } = useStore();
  const [phase, setPhase]   = useState<'email' | 'code'>('email');
  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const reset = () => { setPhase('email'); setEmail(''); setCode(''); setError(''); setLoading(false); };
  const close = () => { reset(); onClose(); };

  const sendCode = async () => {
    if (!EMAIL_RE.test(email.trim())) { setError('Email inválido'); return; }
    setLoading(true); setError('');
    const res = await requestCustomerOtp(email.trim().toLowerCase());
    setLoading(false);
    if (res.success) { setPhase('code'); setError(''); }
    else setError(res.message || 'No pudimos enviar el código. Intentá de nuevo.');
  };

  const verify = async () => {
    if (code.trim().length < 6) { setError('Ingresá el código de 6 dígitos'); return; }
    setLoading(true); setError('');
    const ok = await verifyOtpUnified(email.trim().toLowerCase(), code.trim());
    setLoading(false);
    if (ok) { reset(); onSuccess(); }
    else setError('Código incorrecto o expirado.');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', borderRadius: '14px', background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.12)', color: C.cream, padding: '15px 16px',
    fontSize: '15px', letterSpacing: '0.02em', outline: 'none',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)' }}
          onClick={close}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-md p-7 pb-9"
            style={{
              background: C.bg,
              borderRadius: '28px 28px 0 0',
              border: '0.5px solid rgba(230,57,47,0.25)',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] uppercase mb-1.5" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
                  Solstice 2026
                </p>
                <h2 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300, color: C.cream }}>
                  {phase === 'email' ? 'Iniciá sesión' : 'Verificá tu código'}
                </h2>
              </div>
              <button onClick={close} className="p-2 rounded-full flex-shrink-0" style={{ color: C.gray, background: 'rgba(255,255,255,0.05)' }}>
                <X size={18} />
              </button>
            </div>

            {phase === 'email' ? (
              <>
                <p className="text-[13px] mb-5" style={{ color: `${C.cream}bb`, lineHeight: 1.5 }}>
                  Entrá con el <strong style={{ color: C.cream }}>email con el que compraste</strong> para ver tu semana, tus QR y tus pagos.
                </p>
                <label className="text-[10px] uppercase block mb-2" style={{ letterSpacing: '0.25em', color: C.gray, fontWeight: 600 }}>Correo electrónico</label>
                <div className="relative">
                  <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.gray }} />
                  <input
                    type="email" inputMode="email" autoComplete="email" value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && sendCode()}
                    placeholder="tu@email.com"
                    style={{ ...inputStyle, paddingLeft: 42 }}
                  />
                </div>
                {error && <p className="text-xs mt-3" style={{ color: C.red, fontWeight: 500 }}>{error}</p>}
                <button
                  onClick={sendCode} disabled={loading}
                  className="w-full mt-6 py-4 flex items-center justify-center gap-2 uppercase"
                  style={{ background: C.red, color: C.cream, borderRadius: '999px', letterSpacing: '0.2em', fontWeight: 700, fontSize: '13px', opacity: loading ? 0.5 : 1 }}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <>Enviar código <ChevronRight size={16} /></>}
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] mb-5" style={{ color: `${C.cream}bb`, lineHeight: 1.5 }}>
                  Te enviamos un código de 6 dígitos a <strong style={{ color: C.cream }}>{email}</strong>. Revisá tu correo (y el spam).
                </p>
                <label className="text-[10px] uppercase block mb-2" style={{ letterSpacing: '0.25em', color: C.gray, fontWeight: 600 }}>Código de verificación</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                  onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && verify()}
                  placeholder="••••••"
                  style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.5em', fontSize: '22px', fontWeight: 600 }}
                />
                {error && <p className="text-xs mt-3" style={{ color: C.red, fontWeight: 500 }}>{error}</p>}
                <button
                  onClick={verify} disabled={loading}
                  className="w-full mt-6 py-4 flex items-center justify-center gap-2 uppercase"
                  style={{ background: C.red, color: C.cream, borderRadius: '999px', letterSpacing: '0.2em', fontWeight: 700, fontSize: '13px', opacity: loading ? 0.5 : 1 }}
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <><ShieldCheck size={16} /> Entrar</>}
                </button>
                <button
                  onClick={() => { setPhase('email'); setCode(''); setError(''); }}
                  className="w-full mt-3 py-2 flex items-center justify-center gap-1.5 text-[11px] uppercase"
                  style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}
                >
                  <ArrowLeft size={13} /> Cambiar correo
                </button>
              </>
            )}

            <p className="text-[10px] text-center mt-6" style={{ color: `${C.gray}cc`, letterSpacing: '0.05em' }}>
              ¿Todavía no compraste? Cerrá esto y tocá <strong style={{ color: C.cream }}>Reservá tu Solstice</strong>.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
