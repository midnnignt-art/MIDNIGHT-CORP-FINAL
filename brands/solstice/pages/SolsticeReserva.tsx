import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Loader2, Shield, CreditCard, CheckCircle2,
  Ship, Zap, Calendar, Banknote, Repeat, ListChecks, Star
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { SOLSTICE_SEASON_MOCK, SOLSTICE_WEEKS_MOCK, SOLSTICE_DAYS } from '../constants';
import { SolsticeWeek } from '../types';

const C = { bg: '#000', bgS: '#0d0d0d', red: '#E6392F', org: '#FF7A00', gray: '#606060', cream: '#F9F2D7' };

type PaymentMode = 'auto_subscription' | 'manual_monthly' | 'cash_to_seller' | 'individual_days' | 'full_combo';

const MODES: { id: PaymentMode; label: string; sub: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'auto_subscription', label: 'Débito automático', sub: '$40K hoy, luego automático cada mes', icon: <Repeat size={18} />, badge: 'Más fácil' },
  { id: 'manual_monthly',    label: 'Mes a mes',          sub: '$40K hoy, te avisamos cuando toca',  icon: <Calendar size={18} /> },
  { id: 'cash_to_seller',    label: 'Efectivo',            sub: '$40K hoy, pagas al promotor',         icon: <Banknote size={18} /> },
  { id: 'individual_days',   label: 'Días sueltos',        sub: 'Elige solo los días que quieres',     icon: <ListChecks size={18} /> },
  { id: 'full_combo',        label: 'Todo de una',         sub: 'Sin cuotas, precio total',            icon: <Star size={18} />, badge: 'Mejor precio' },
];

interface SeasonData {
  id: string;
  entry_price: number;
  combo_total: number;
  installments: number;
  phase1_limit: number;
}

interface Props {
  initialWeek?: string;
  onBack: () => void;
}

function genOrderNumber() {
  return 'SOL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split('T')[0];
}

export default function SolsticeReserva({ initialWeek, onBack }: Props) {
  const { requestCustomerOtp, verifyOtpUnified, currentCustomer, currentUser } = useStore();

  // ── Real data from DB (falls back to mock if not yet migrated) ──
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [weeks, setWeeks]   = useState<SolsticeWeek[]>(SOLSTICE_WEEKS_MOCK);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: seasonRow } = await supabase
          .from('solstice_seasons')
          .select('id,entry_price,combo_total,installments,phase1_limit')
          .eq('status', 'open')
          .single();
        if (seasonRow) setSeason(seasonRow as SeasonData);

        const { data: weekRows } = await supabase
          .from('solstice_weeks')
          .select('*')
          .order('start_date');
        if (weekRows && weekRows.length > 0) setWeeks(weekRows as SolsticeWeek[]);
      } catch {
        // DB not yet migrated — mock data stays
      }
    }
    loadData();
  }, []);

  // ── State ──
  const [step, setStep]       = useState<number>(initialWeek ? 1 : 0);
  const [selWeek, setSelWeek] = useState<SolsticeWeek | null>(
    initialWeek ? SOLSTICE_WEEKS_MOCK.find(w => w.university === initialWeek) || null : null
  );
  const [mode, setMode]           = useState<PaymentMode | null>(null);
  const [selDays, setSelDays]     = useState<number[]>([]);
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [uni, setUni]             = useState('');
  const [otp, setOtp]             = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError]     = useState('');
  const [processing, setProcessing]   = useState(false);
  const [pendingOrderNum, setPendingOrderNum] = useState<string | null>(null);
  const [pendingRegId, setPendingRegId]       = useState<string | null>(null);
  const [payStatus, setPayStatus] = useState<'pending' | 'paid'>('pending');
  const [simulating, setSimulating] = useState(false);

  // When real weeks load, update the pre-selected week if we had an initialWeek
  useEffect(() => {
    if (initialWeek && weeks !== SOLSTICE_WEEKS_MOCK) {
      const found = weeks.find(w => w.university === initialWeek);
      if (found) setSelWeek(found);
    }
  }, [weeks]);

  const s       = season ?? SOLSTICE_SEASON_MOCK;
  const dayTotal  = selDays.reduce((a, d) => a + (SOLSTICE_DAYS.find(x => x.day === d)?.price || 0), 0);
  const chargeNow = mode === 'full_combo' ? s.combo_total : mode === 'individual_days' ? dayTotal : s.entry_price;
  const chargeK   = Math.round(chargeNow / 1000);

  // Prefill auth if customer is already logged in (not staff — staff skips OTP in handleRequestOtp)
  useEffect(() => {
    if (currentCustomer && !currentUser) {
      setEmail(currentCustomer.email || '');
      const meta = currentCustomer.user_metadata || {};
      if (meta.full_name) setName(meta.full_name);
      if (meta.phone)     setPhone(meta.phone);
      if (step === 2)     setStep(3);
    }
  }, [currentCustomer]);

  const handleRequestOtp = async () => {
    if (!email.includes('@')) return setAuthError('Email inválido');
    if (!name.trim()) return setAuthError('Ingresa tu nombre');

    // Staff testing: skip OTP so it doesn't wipe the admin session
    if (currentUser) {
      setStep(3);
      return;
    }

    setAuthLoading(true); setAuthError('');
    const res = await requestCustomerOtp(email, { full_name: name, phone });
    setAuthLoading(false);
    if (res.success) setStep(2.5 as any);
    else setAuthError(res.message || 'Error enviando código.');
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return setAuthError('Código de 6 dígitos');
    setAuthLoading(true); setAuthError('');
    const ok = await verifyOtpUnified(email, otp);
    setAuthLoading(false);
    if (ok) setStep(3);
    else setAuthError('Código incorrecto o expirado.');
  };

  const handleCreateRegistration = async () => {
    setProcessing(true);
    try {
      const orderNum = genOrderNumber();
      const today = new Date();

      const { data: seasonData } = await supabase
        .from('solstice_seasons').select('id').eq('status', 'open').single();
      const { data: weekData } = await supabase
        .from('solstice_weeks').select('id').eq('university', selWeek?.university || '').single();

      const refCode = sessionStorage.getItem('ms_ref_code');
      let sellerId: string | null = null;
      if (refCode) {
        const { data: promoterRow } = await supabase
          .from('promoters').select('user_id').ilike('code', refCode).maybeSingle();
        sellerId = promoterRow?.user_id || null;
        await supabase.from('solstice_referral_clicks').insert({ ref_code: refCode, converted: true }).then(() => {});
      }

      const regPayload: any = {
        order_number:            orderNum,
        season_id:               seasonData?.id || null,
        week_id:                 weekData?.id || null,
        user_id:                 currentCustomer?.id || null,
        customer_name:           name,
        customer_email:          email,
        customer_phone:          phone,
        customer_university:     uni || selWeek?.university,
        payment_mode:            mode,
        status:                  'reserved',
        total_amount:            mode === 'full_combo' ? s.combo_total : mode === 'individual_days' ? dayTotal : s.combo_total,
        amount_paid:             0,
        installments_remaining:  mode === 'full_combo' || mode === 'individual_days' ? 0 : s.installments,
        days_purchased:          mode === 'individual_days' ? selDays : null,
        bold_order_id:           orderNum,
        ref_code:                refCode || null,
        seller_id:               sellerId,
      };

      const { data: reg, error } = await supabase
        .from('solstice_registrations').insert(regPayload).select().single();

      if (error) throw new Error(error.message);

      if (mode !== 'full_combo' && mode !== 'individual_days') {
        const cuota = Math.round(s.combo_total / s.installments);
        const schedules = Array.from({ length: s.installments }, (_, i) => ({
          registration_id:    reg.id,
          installment_number: i + 1,
          amount:             cuota,
          due_date:           addMonths(today, i + 1),
          status:             'pending',
        }));
        await supabase.from('solstice_payment_schedules').insert(schedules);
      }

      setPendingOrderNum(orderNum);
      setPendingRegId(reg.id);
      setStep(4);
    } catch (err: any) {
      // DB not yet migrated — skip DB and go straight to test payment step
      const fallback = genOrderNumber();
      setPendingOrderNum(fallback);
      setStep(4);
      console.warn('Solstice DB fallback — mock order:', fallback, err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleTestPayment = async () => {
    setSimulating(true);
    try {
      if (pendingRegId) {
        await supabase
          .from('solstice_registrations')
          .update({ status: 'active', amount_paid: chargeNow })
          .eq('id', pendingRegId);
      }
      setPayStatus('paid');
      setTimeout(() => setStep(5), 1000);
    } catch (err: any) {
      console.warn('Test payment error:', err.message);
      setStep(5);
    } finally {
      setSimulating(false);
    }
  };

  const goBack = () => {
    if      (step === 5)            onBack();
    else if (step === 4)            setStep(3);
    else if (step === 3)            setStep(currentCustomer ? 2 : (2.5 as any));
    else if (step === (2.5 as any)) setStep(2);
    else if (step === 2)            setStep(mode === 'individual_days' ? (1.5 as any) : 1);
    else if (step === (1.5 as any)) setStep(1);
    else if (step === 1)            setStep(0);
    else                            onBack();
  };

  const stepLabel = ['Semana', 'Modalidad', 'Tus datos', '', 'Pago', '✓'][Math.min(Math.floor(step), 5)];
  const stepNum   = Math.min(Math.floor(step), 5);

  // Shared style helpers
  const inputStyle: React.CSSProperties = {
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '0.5px solid rgba(255,255,255,0.10)',
    color: C.cream,
    padding: '16px 18px',
    letterSpacing: '0.15em',
    width: '100%',
    outline: 'none',
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    transition: 'border-color 0.2s ease',
  };

  const primaryBtnStyle: React.CSSProperties = {
    borderRadius: '999px',
    background: 'rgba(230,57,47,0.22)',
    border: '0.5px solid rgba(230,57,47,0.45)',
    color: C.cream,
    letterSpacing: '0.2em',
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    textTransform: 'uppercase' as const,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Progress header */}
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center gap-4" style={{ background: C.bg, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        {step > 0 && step < 5 && (
          <button onClick={goBack} className="p-2 rounded-full transition-colors" style={{ color: C.gray }}
            onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <p className="text-[9px] uppercase" style={{ color: C.red, letterSpacing: '0.4em', fontWeight: 500 }}>
            Reserva SOLSTICE 2026
          </p>
          <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>{stepLabel}</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ background: i <= stepNum ? C.red : `${C.gray}40` }} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 pb-24">
        <AnimatePresence mode="wait">

          {/* STEP 0 — Selección de semana */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Cuál semana?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Selecciona tu universidad</p>
              </div>
              <div className="space-y-4">
                {weeks.map(week => {
                  const pct  = (week.reserved / week.capacity) * 100;
                  const left = week.capacity - week.reserved;
                  return (
                    <button key={week.id} onClick={() => { setSelWeek(week); setStep(1); }}
                      className="w-full p-6 text-left"
                      style={{
                        borderRadius: '24px',
                        background: 'rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(32px) saturate(180%)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        transition: 'all 0.35s cubic-bezier(0.25,0.46,0.45,0.94)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                        (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(230,57,47,0.30)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(255,255,255,0.10)';
                      }}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>{week.university}</h3>
                        <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>{week.reserved}/{week.capacity}</span>
                      </div>
                      <p className="text-xs uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                        {new Date(week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      </p>
                      {/* Urgency / progress bar */}
                      <div className="w-full mb-1" style={{ height: '2px', background: `${C.gray}20`, borderRadius: '999px' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.red, borderRadius: '999px', transition: 'width 0.8s' }} />
                      </div>
                      <p className="text-[9px] uppercase" style={{ color: left <= 20 ? C.red : C.gray, letterSpacing: '0.1em', fontWeight: 500 }}>
                        {left <= 20 ? `¡Solo ${left} cupos!` : `${left} cupos disponibles`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 1 — Modalidad de pago */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Cómo pagas?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Semana {selWeek?.university}</p>
              </div>
              <div className="space-y-3">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => {
                    setMode(m.id);
                    setStep(m.id === 'individual_days' ? (1.5 as any) : 2);
                  }}
                    className="w-full p-5 text-left flex items-center gap-4 relative"
                    style={{
                      borderRadius: '20px',
                      background: mode === m.id ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(32px) saturate(180%)',
                      border: mode === m.id ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.border = '0.5px solid rgba(230,57,47,0.25)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.border = mode === m.id
                        ? '0.5px solid rgba(230,57,47,0.50)'
                        : '0.5px solid rgba(255,255,255,0.10)';
                    }}
                  >
                    {m.badge && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 text-[8px] uppercase"
                        style={{ background: C.red, color: C.cream, letterSpacing: '0.15em', borderRadius: '999px', fontWeight: 500 }}>
                        {m.badge}
                      </div>
                    )}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${C.red}15`, color: C.red }}>
                      {m.icon}
                    </div>
                    <div>
                      <p className="text-sm uppercase" style={{ letterSpacing: '0.1em', fontWeight: 500 }}>{m.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: C.gray }}>{m.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 1.5 — Días sueltos */}
          {step === (1.5 as any) && (
            <motion.div key="s1.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>¿Qué días?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Selecciona uno o más</p>
              </div>
              <div className="space-y-3">
                {SOLSTICE_DAYS.map(day => {
                  const selected = selDays.includes(day.day);
                  return (
                    <button key={day.day}
                      onClick={() => setSelDays(prev => selected ? prev.filter(d => d !== day.day) : [...prev, day.day])}
                      className="w-full p-5 flex items-center gap-4"
                      style={{
                        borderRadius: '20px',
                        background: selected ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.04)',
                        backdropFilter: 'blur(32px) saturate(180%)',
                        border: selected ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                        style={selected ? { background: C.red, borderColor: C.red } : { borderColor: `${C.gray}50` }}>
                        {day.highlight
                          ? <Ship size={16} style={{ color: selected ? C.cream : C.gray }} />
                          : <span className="text-xs" style={{ color: selected ? C.cream : C.gray }}>{day.day}</span>}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm uppercase" style={{ color: day.highlight ? C.red : C.cream, letterSpacing: '0.1em', fontWeight: 500 }}>{day.title}</p>
                        <p className="text-[10px]" style={{ color: C.gray }}>{day.subtitle}</p>
                      </div>
                      <p className="text-sm" style={{ color: selected ? C.red : C.gray, fontWeight: 500 }}>
                        ${Math.round(day.price / 1000)}K
                      </p>
                    </button>
                  );
                })}
              </div>
              {selDays.length > 0 && (
                <div className="p-5" style={{
                  borderRadius: '28px',
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(230,57,47,0.50)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                }}>
                  <div className="flex justify-between text-xs uppercase mb-1" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    <span>Tu selección ({selDays.length} días)</span><span>${Math.round(dayTotal/1000)}K</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    <span>Combo completo</span><span>${Math.round(s.combo_total/1000)}K</span>
                  </div>
                  {dayTotal > s.combo_total && (
                    <p className="text-[9px] mt-2 uppercase text-center" style={{ color: C.red }}>
                      El combo sale más barato — considera cambiarlo
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => setStep(2)}
                disabled={selDays.length === 0}
                style={{
                  ...primaryBtnStyle,
                  opacity: selDays.length === 0 ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (selDays.length > 0) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                Continuar
              </button>
            </motion.div>
          )}

          {/* STEP 2 — Datos personales */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>Tus datos</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Para el registro y confirmación</p>
              </div>
              <div className="space-y-3">
                {[
                  { placeholder: 'NOMBRE COMPLETO',     value: name,  set: setName,  type: 'text'  },
                  { placeholder: 'CORREO ELECTRÓNICO',  value: email, set: setEmail, type: 'email' },
                  { placeholder: 'TELÉFONO / CELULAR',  value: phone, set: setPhone, type: 'tel'   },
                  { placeholder: 'UNIVERSIDAD',         value: uni,   set: setUni,   type: 'text'  },
                ].map(f => (
                  <input key={f.placeholder} type={f.type} placeholder={f.placeholder} value={f.value}
                    onChange={e => f.set(f.type === 'email' ? e.target.value.toLowerCase() : e.target.value)}
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.60)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                ))}
                {authError && (
                  <p className="text-xs uppercase text-center py-2" style={{ color: C.red, letterSpacing: '0.15em', fontWeight: 500 }}>
                    {authError}
                  </p>
                )}
              </div>
              <button onClick={handleRequestOtp} disabled={!email || !name || authLoading}
                style={{
                  ...primaryBtnStyle,
                  opacity: (!email || !name || authLoading) ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (email && name && !authLoading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {authLoading ? <Loader2 className="animate-spin" /> : 'Continuar →'}
              </button>
            </motion.div>
          )}

          {/* STEP 2.5 — OTP */}
          {step === (2.5 as any) && (
            <motion.div key="s2.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>Verifica tu email</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Código enviado a {email}</p>
              </div>
              <input autoFocus placeholder="000000" value={otp} maxLength={6}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                style={{
                  ...inputStyle,
                  padding: '24px 18px',
                  textAlign: 'center',
                  fontSize: '36px',
                  fontWeight: 500,
                  letterSpacing: '0.5em',
                  textTransform: 'none' as const,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.60)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              {authError && <p className="text-xs uppercase" style={{ color: C.red, fontWeight: 500 }}>{authError}</p>}
              <button onClick={handleVerifyOtp} disabled={otp.length < 6 || authLoading}
                style={{
                  ...primaryBtnStyle,
                  opacity: (otp.length < 6 || authLoading) ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (otp.length >= 6 && !authLoading) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {authLoading ? <Loader2 className="animate-spin" /> : 'Verificar'}
              </button>
            </motion.div>
          )}

          {/* STEP 3 — Resumen + confirmar */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>Resumen</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Confirma antes de pagar</p>
              </div>
              <div className="space-y-3 p-6" style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
                {([
                  ['Semana',    selWeek?.university],
                  ['Modalidad', MODES.find(m => m.id === mode)?.label],
                  ['Nombre',    name],
                  ['Email',     email],
                  mode === 'individual_days' ? ['Días', selDays.map(d => `Día ${d}`).join(', ')] : null,
                ] as ([string, string | undefined] | null)[])
                  .filter((x): x is [string, string | undefined] => Boolean(x))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.12em', fontWeight: 500 }}>
                      <span style={{ color: C.gray }}>{k}</span>
                      <span style={{ color: C.cream }}>{v}</span>
                    </div>
                  ))}
                <div className="pt-4 mt-2 flex justify-between items-center" style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
                  <span className="text-sm uppercase" style={{ color: C.gray, fontWeight: 500 }}>Pago hoy</span>
                  <span className="text-3xl" style={{ color: C.red, fontWeight: 300 }}>${chargeK}K</span>
                </div>
                {mode !== 'full_combo' && mode !== 'individual_days' && (
                  <p className="text-[9px] uppercase text-center" style={{ color: C.gray, fontWeight: 500 }}>
                    + {s.installments} cuotas de ${Math.round(s.combo_total / s.installments / 1000)}K/mes
                  </p>
                )}
              </div>
              <button onClick={handleCreateRegistration} disabled={processing}
                style={{
                  ...primaryBtnStyle,
                  padding: '20px 16px',
                  opacity: processing ? 0.35 : 1,
                }}
                onMouseEnter={e => {
                  if (!processing) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {processing ? <Loader2 className="animate-spin" /> : <><Shield size={16} /> Ir a pagar ${chargeK}K</>}
              </button>
            </motion.div>
          )}

          {/* STEP 4 — TEST: Simular pago */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
              <div className="p-8 space-y-8" style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: payStatus === 'paid' ? '0.5px solid rgba(16,185,129,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
                {/* Test mode badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1"
                  style={{ background: '#FF7A0018', border: '0.5px solid #FF7A0040', borderRadius: '999px' }}>
                  <Zap size={10} style={{ color: '#FF7A00' }} />
                  <span className="text-[9px] uppercase" style={{ color: '#FF7A00', letterSpacing: '0.3em', fontWeight: 500 }}>
                    Modo prueba
                  </span>
                </div>

                <div>
                  <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>Total a pagar</p>
                  <p className="text-5xl" style={{ color: C.cream, fontWeight: 300 }}>${chargeK}K</p>
                  <p className="text-[10px] uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                    {MODES.find(m => m.id === mode)?.label}
                  </p>
                  {pendingOrderNum && (
                    <p className="text-[9px] mt-3 font-mono" style={{ color: `${C.gray}70` }}>{pendingOrderNum}</p>
                  )}
                </div>

                {payStatus === 'paid' ? (
                  <div className="space-y-3">
                    <CheckCircle2 size={36} className="mx-auto" style={{ color: '#10b981' }} />
                    <p className="text-[10px] uppercase animate-pulse" style={{ color: '#10b981', letterSpacing: '0.2em', fontWeight: 500 }}>
                      ¡Pago registrado! Preparando confirmación...
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleTestPayment}
                    disabled={simulating}
                    style={{
                      ...primaryBtnStyle,
                      padding: '20px 16px',
                      opacity: simulating ? 0.35 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!simulating) {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.20)';
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                    }}
                  >
                    {simulating
                      ? <Loader2 className="animate-spin" size={18} />
                      : <><CreditCard size={16} /> Simular pago ${chargeK}K ✓</>}
                  </button>
                )}
              </div>

              <p className="text-[9px] uppercase" style={{ color: `${C.gray}50`, letterSpacing: '0.2em', fontWeight: 500 }}>
                Cualquier método cuenta como pago exitoso en modo prueba
              </p>
            </motion.div>
          )}

          {/* STEP 5 — Confirmación */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center py-12">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{ background: `${C.red}20`, border: `0.5px solid rgba(230,57,47,0.40)` }}>
                <CheckCircle2 size={36} style={{ color: C.red }} />
              </div>
              <div>
                <h2 className="text-4xl uppercase mb-3" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em', fontWeight: 300 }}>
                  ¡Tu semana está reservada!
                </h2>
                <p className="text-sm mb-1" style={{ color: C.gray }}>Semana <strong style={{ color: C.cream }}>{selWeek?.university}</strong></p>
                <p className="text-sm" style={{ color: C.gray }}>
                  Confirmación enviada a <strong style={{ color: C.cream }}>{email}</strong>
                </p>
              </div>
              <div className="p-6 space-y-3 text-xs uppercase" style={{
                borderRadius: '28px',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
                <div className="flex justify-between" style={{ letterSpacing: '0.12em', fontWeight: 500 }}>
                  <span style={{ color: C.gray }}>Modalidad</span>
                  <span>{MODES.find(m => m.id === mode)?.label}</span>
                </div>
                {mode !== 'full_combo' && mode !== 'individual_days' && (
                  <div className="flex justify-between" style={{ letterSpacing: '0.12em', fontWeight: 500 }}>
                    <span style={{ color: C.gray }}>Próxima cuota</span>
                    <span style={{ color: C.red }}>${Math.round(s.combo_total / s.installments / 1000)}K / mes</span>
                  </div>
                )}
                <div className="flex justify-between pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', letterSpacing: '0.12em', fontWeight: 500 }}>
                  <span style={{ color: C.gray }}>Orden</span>
                  <span className="font-mono">{pendingOrderNum}</span>
                </div>
              </div>
              <button onClick={onBack}
                style={{
                  borderRadius: '999px',
                  background: 'transparent',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  color: C.gray,
                  letterSpacing: '0.2em',
                  width: '100%',
                  padding: '16px',
                  fontSize: '14px',
                  textTransform: 'uppercase' as const,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = C.cream;
                  (e.currentTarget as HTMLButtonElement).style.color = C.cream;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)';
                  (e.currentTarget as HTMLButtonElement).style.color = C.gray;
                }}>
                Volver al inicio
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
