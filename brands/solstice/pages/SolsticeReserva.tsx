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

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Progress header */}
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center gap-4" style={{ background: C.bg, borderBottom: `1px solid ${C.gray}15` }}>
        {step > 0 && step < 5 && (
          <button onClick={goBack} className="p-2 rounded-full transition-colors" style={{ color: C.gray }}
            onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <p className="text-[9px] uppercase font-bold" style={{ color: C.red, letterSpacing: '0.4em' }}>
            Reserva SOLSTICE 2026
          </p>
          <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>{stepLabel}</p>
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
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>¿Cuál semana?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Selecciona tu universidad</p>
              </div>
              <div className="space-y-4">
                {weeks.map(week => {
                  const pct  = (week.reserved / week.capacity) * 100;
                  const left = week.capacity - week.reserved;
                  return (
                    <button key={week.id} onClick={() => { setSelWeek(week); setStep(1); }}
                      className="w-full p-6 text-left transition-all"
                      style={{ background: C.bgS, border: `1px solid ${C.gray}25` }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = `${C.gray}25`)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif" }}>{week.university}</h3>
                        <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>{week.reserved}/{week.capacity}</span>
                      </div>
                      <p className="text-xs uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                        {new Date(week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — {new Date(week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      </p>
                      <div className="h-[2px] w-full mb-1" style={{ background: `${C.gray}20` }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: C.red, transition: 'width 0.8s' }} />
                      </div>
                      <p className="text-[9px] uppercase" style={{ color: left <= 20 ? C.red : C.gray, letterSpacing: '0.1em' }}>
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
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>¿Cómo pagas?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Semana {selWeek?.university}</p>
              </div>
              <div className="space-y-3">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => {
                    setMode(m.id);
                    setStep(m.id === 'individual_days' ? (1.5 as any) : 2);
                  }}
                    className="w-full p-5 text-left flex items-center gap-4 transition-all relative"
                    style={{ background: C.bgS, border: `1px solid ${mode === m.id ? C.red : C.gray + '25'}` }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = mode === m.id ? C.red : `${C.gray}25`)}
                  >
                    {m.badge && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 text-[8px] uppercase font-black rounded-sm"
                        style={{ background: C.red, color: C.cream, letterSpacing: '0.15em' }}>
                        {m.badge}
                      </div>
                    )}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: `${C.red}15`, color: C.red }}>
                      {m.icon}
                    </div>
                    <div>
                      <p className="text-sm uppercase font-bold" style={{ letterSpacing: '0.1em' }}>{m.label}</p>
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
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>¿Qué días?</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Selecciona uno o más</p>
              </div>
              <div className="space-y-3">
                {SOLSTICE_DAYS.map(day => {
                  const selected = selDays.includes(day.day);
                  return (
                    <button key={day.day}
                      onClick={() => setSelDays(prev => selected ? prev.filter(d => d !== day.day) : [...prev, day.day])}
                      className="w-full p-5 flex items-center gap-4 transition-all"
                      style={{ background: C.bgS, border: `1px solid ${selected ? C.red : C.gray + '25'}` }}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0"
                        style={selected ? { background: C.red, borderColor: C.red } : { borderColor: `${C.gray}50` }}>
                        {day.highlight
                          ? <Ship size={16} style={{ color: selected ? C.cream : C.gray }} />
                          : <span className="text-xs" style={{ color: selected ? C.cream : C.gray }}>{day.day}</span>}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm uppercase font-bold" style={{ color: day.highlight ? C.red : C.cream, letterSpacing: '0.1em' }}>{day.title}</p>
                        <p className="text-[10px]" style={{ color: C.gray }}>{day.subtitle}</p>
                      </div>
                      <p className="text-sm font-black" style={{ color: selected ? C.red : C.gray }}>
                        ${Math.round(day.price / 1000)}K
                      </p>
                    </button>
                  );
                })}
              </div>
              {selDays.length > 0 && (
                <div className="p-5" style={{ background: C.bgS, border: `1px solid ${C.red}30` }}>
                  <div className="flex justify-between text-xs uppercase mb-1" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                    <span>Tu selección ({selDays.length} días)</span><span>${Math.round(dayTotal/1000)}K</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
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
                className="w-full py-4 uppercase font-black text-sm transition-all disabled:opacity-30"
                style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}
              >
                Continuar
              </button>
            </motion.div>
          )}

          {/* STEP 2 — Datos personales */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>Tus datos</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Para el registro y confirmación</p>
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
                    className="w-full px-4 py-4 text-xs uppercase outline-none transition-colors"
                    style={{ background: C.bgS, border: `1px solid ${C.gray}30`, color: C.cream, letterSpacing: '0.15em' }}
                    onFocus={e => (e.currentTarget.style.borderColor = C.red)}
                    onBlur={e => (e.currentTarget.style.borderColor = `${C.gray}30`)}
                  />
                ))}
                {authError && (
                  <p className="text-xs uppercase font-bold text-center py-2" style={{ color: C.red, letterSpacing: '0.15em' }}>
                    {authError}
                  </p>
                )}
              </div>
              <button onClick={handleRequestOtp} disabled={!email || !name || authLoading}
                className="w-full py-4 uppercase font-black text-sm transition-all disabled:opacity-30"
                style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}>
                {authLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Continuar →'}
              </button>
            </motion.div>
          )}

          {/* STEP 2.5 — OTP */}
          {step === (2.5 as any) && (
            <motion.div key="s2.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8 text-center">
              <div>
                <h2 className="text-3xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>Verifica tu email</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Código enviado a {email}</p>
              </div>
              <input autoFocus placeholder="000000" value={otp} maxLength={6}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                className="w-full py-6 text-center text-4xl font-black outline-none tracking-[0.5em]"
                style={{ background: C.bgS, border: `1px solid ${C.gray}30`, color: C.cream }}
                onFocus={e => (e.currentTarget.style.borderColor = C.red)}
                onBlur={e => (e.currentTarget.style.borderColor = `${C.gray}30`)}
              />
              {authError && <p className="text-xs uppercase font-bold" style={{ color: C.red }}>{authError}</p>}
              <button onClick={handleVerifyOtp} disabled={otp.length < 6 || authLoading}
                className="w-full py-4 uppercase font-black text-sm transition-all disabled:opacity-30"
                style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}>
                {authLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Verificar'}
              </button>
            </motion.div>
          )}

          {/* STEP 3 — Resumen + confirmar */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div>
                <h2 className="text-3xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>Resumen</h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Confirma antes de pagar</p>
              </div>
              <div className="space-y-3 p-6" style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
                {([
                  ['Semana',    selWeek?.university],
                  ['Modalidad', MODES.find(m => m.id === mode)?.label],
                  ['Nombre',    name],
                  ['Email',     email],
                  mode === 'individual_days' ? ['Días', selDays.map(d => `Día ${d}`).join(', ')] : null,
                ] as ([string, string | undefined] | null)[])
                  .filter((x): x is [string, string | undefined] => Boolean(x))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.12em' }}>
                      <span style={{ color: C.gray }}>{k}</span>
                      <span style={{ color: C.cream }}>{v}</span>
                    </div>
                  ))}
                <div className="pt-4 mt-2 flex justify-between items-center" style={{ borderTop: `1px solid ${C.gray}20` }}>
                  <span className="text-sm uppercase font-bold" style={{ color: C.gray }}>Pago hoy</span>
                  <span className="text-3xl font-black" style={{ color: C.red }}>${chargeK}K</span>
                </div>
                {mode !== 'full_combo' && mode !== 'individual_days' && (
                  <p className="text-[9px] uppercase text-center" style={{ color: C.gray }}>
                    + {s.installments} cuotas de ${Math.round(s.combo_total / s.installments / 1000)}K/mes
                  </p>
                )}
              </div>
              <button onClick={handleCreateRegistration} disabled={processing}
                className="w-full py-5 uppercase font-black text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}>
                {processing ? <Loader2 className="animate-spin" /> : <><Shield size={16} /> Ir a pagar ${chargeK}K</>}
              </button>
            </motion.div>
          )}

          {/* STEP 4 — TEST: Simular pago */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 text-center">
              <div className="p-8 space-y-8" style={{
                background: C.bgS,
                border: `1px solid ${payStatus === 'paid' ? '#10b981' : C.gray + '20'}`,
              }}>
                {/* Test mode badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
                  style={{ background: '#FF7A0018', border: '1px solid #FF7A0040' }}>
                  <Zap size={10} style={{ color: '#FF7A00' }} />
                  <span className="text-[9px] uppercase font-black" style={{ color: '#FF7A00', letterSpacing: '0.3em' }}>
                    Modo prueba
                  </span>
                </div>

                <div>
                  <p className="text-[10px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.3em' }}>Total a pagar</p>
                  <p className="text-5xl font-black" style={{ color: C.cream }}>${chargeK}K</p>
                  <p className="text-[10px] uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                    {MODES.find(m => m.id === mode)?.label}
                  </p>
                  {pendingOrderNum && (
                    <p className="text-[9px] mt-3 font-mono" style={{ color: `${C.gray}70` }}>{pendingOrderNum}</p>
                  )}
                </div>

                {payStatus === 'paid' ? (
                  <div className="space-y-3">
                    <CheckCircle2 size={36} className="mx-auto" style={{ color: '#10b981' }} />
                    <p className="text-[10px] uppercase font-black animate-pulse" style={{ color: '#10b981', letterSpacing: '0.2em' }}>
                      ¡Pago registrado! Preparando confirmación...
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={handleTestPayment}
                    disabled={simulating}
                    className="w-full py-5 uppercase font-black text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                    style={{ background: C.red, color: C.cream, letterSpacing: '0.2em' }}
                  >
                    {simulating
                      ? <Loader2 className="animate-spin" size={18} />
                      : <><CreditCard size={16} /> Simular pago ${chargeK}K ✓</>}
                  </button>
                )}
              </div>

              <p className="text-[9px] uppercase" style={{ color: `${C.gray}50`, letterSpacing: '0.2em' }}>
                Cualquier método cuenta como pago exitoso en modo prueba
              </p>
            </motion.div>
          )}

          {/* STEP 5 — Confirmación */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 text-center py-12">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                style={{ background: `${C.red}20`, border: `2px solid ${C.red}40` }}>
                <CheckCircle2 size={36} style={{ color: C.red }} />
              </div>
              <div>
                <h2 className="text-4xl uppercase mb-3" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.08em' }}>
                  ¡Tu semana está reservada!
                </h2>
                <p className="text-sm mb-1" style={{ color: C.gray }}>Semana <strong style={{ color: C.cream }}>{selWeek?.university}</strong></p>
                <p className="text-sm" style={{ color: C.gray }}>
                  Confirmación enviada a <strong style={{ color: C.cream }}>{email}</strong>
                </p>
              </div>
              <div className="p-6 space-y-3 text-xs uppercase" style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
                <div className="flex justify-between" style={{ letterSpacing: '0.12em' }}>
                  <span style={{ color: C.gray }}>Modalidad</span>
                  <span>{MODES.find(m => m.id === mode)?.label}</span>
                </div>
                {mode !== 'full_combo' && mode !== 'individual_days' && (
                  <div className="flex justify-between" style={{ letterSpacing: '0.12em' }}>
                    <span style={{ color: C.gray }}>Próxima cuota</span>
                    <span style={{ color: C.red }}>${Math.round(s.combo_total / s.installments / 1000)}K / mes</span>
                  </div>
                )}
                <div className="flex justify-between pt-3" style={{ borderTop: `1px solid ${C.gray}15`, letterSpacing: '0.12em' }}>
                  <span style={{ color: C.gray }}>Orden</span>
                  <span className="font-mono">{pendingOrderNum}</span>
                </div>
              </div>
              <button onClick={onBack} className="w-full py-4 uppercase font-black text-sm transition-all"
                style={{ border: `1px solid ${C.gray}30`, color: C.gray, letterSpacing: '0.2em' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.cream; (e.currentTarget as HTMLButtonElement).style.color = C.cream; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.gray}30`; (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}>
                Volver al inicio
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
