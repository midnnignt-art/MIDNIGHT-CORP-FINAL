import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, AlertTriangle, Shield, Download,
  Loader2, CreditCard, User, Calendar, Phone, Mail, Sun
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981', yellow: '#f59e0b' };

interface Registration {
  id: string; order_number: string; customer_name: string; customer_email: string;
  customer_phone: string; customer_university: string; payment_mode: string;
  status: string; total_amount: number; amount_paid: number;
  installments_remaining: number; created_at: string;
  week?: { university: string; start_date: string; end_date: string };
  seller?: { name: string; email: string; ref_code: string };
  schedules?: Schedule[];
}

interface Schedule {
  id: string; installment_number: number; amount: number;
  due_date: string; status: 'pending' | 'paid' | 'overdue';
}

const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

const MODE_LABEL: Record<string, string> = {
  auto_subscription: 'Débito automático',
  manual_monthly:    'Mes a mes',
  cash_to_seller:    'Efectivo',
  individual_days:   'Días sueltos',
  full_combo:        'Todo de una',
};

function DigitalTicket({ reg }: { reg: Registration }) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=0d0d0d&color=E6392F&data=${encodeURIComponent(reg.order_number)}`;

  const downloadTicket = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: '#0d0d0d',
        scale: 2,
        useCORS: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `solstice-ticket-${reg.order_number}.png`;
      a.click();
      toast.success('Ticket descargado');
    } catch {
      toast.error('Error al generar imagen');
    } finally {
      setDownloading(false);
    }
  };

  const weekStart = reg.week?.start_date
    ? new Date(reg.week.start_date + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
    : null;
  const weekEnd = reg.week?.end_date
    ? new Date(reg.week.end_date + 'T00:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase"
          style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Tu ticket digital</p>
        <button
          onClick={downloadTicket}
          disabled={downloading}
          className="flex items-center gap-2 px-6 py-3 text-[10px] uppercase tracking-widest disabled:opacity-40"
          style={{
            background: 'transparent',
            border: '0.5px solid rgba(255,255,255,0.15)',
            color: C.gray,
            borderRadius: '999px',
            fontWeight: 500,
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = C.cream;
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = C.gray;
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
          }}>
          {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          Descargar
        </button>
      </div>

      {/* Ticket card */}
      <div ref={ticketRef} className="relative overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(32px) saturate(180%)',
          border: '0.5px solid rgba(230,57,47,0.40)',
          borderRadius: '28px',
          maxWidth: 480,
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}>

        {/* Top band */}
        <div className="px-7 pt-6 pb-4 flex items-center justify-between"
          style={{ borderBottom: '0.5px solid rgba(230,57,47,0.20)' }}>
          <div className="flex items-center gap-2">
            <Sun size={16} style={{ color: C.red }} />
            <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 500 }}>
              Solstice 2026
            </span>
          </div>
          <span className="text-[8px] uppercase px-2 py-0.5"
            style={{
              background: 'rgba(230,57,47,0.20)',
              color: C.red,
              border: '0.5px solid rgba(230,57,47,0.40)',
              borderRadius: '999px',
              fontWeight: 500,
            }}>
            {reg.status === 'completed' ? 'Pagado' : reg.status === 'active' ? 'Activo' : 'Reservado'}
          </span>
        </div>

        {/* Main content */}
        <div className="px-7 py-5 flex items-start justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[8px] uppercase mb-0.5"
                style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Titular</p>
              <p className="text-2xl uppercase"
                style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
                {reg.customer_name}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] uppercase mb-0.5"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Universidad</p>
                <p className="text-xs font-medium uppercase">{reg.customer_university}</p>
              </div>
              {weekStart && weekEnd && (
                <div>
                  <p className="text-[8px] uppercase mb-0.5"
                    style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Semana</p>
                  <p className="text-xs font-medium">{weekStart} → {weekEnd}</p>
                </div>
              )}
              <div>
                <p className="text-[8px] uppercase mb-0.5"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Modalidad</p>
                <p className="text-xs font-medium uppercase">{MODE_LABEL[reg.payment_mode] || reg.payment_mode}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase mb-0.5"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Orden</p>
                <p className="text-xs font-mono">{reg.order_number}</p>
              </div>
            </div>
          </div>

          {/* QR */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <img
              src={qrUrl}
              alt="QR ticket"
              width={90} height={90}
              style={{ imageRendering: 'pixelated' }}
              crossOrigin="anonymous"
            />
            <p className="text-[7px] uppercase text-center"
              style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              Scan para check-in
            </p>
          </div>
        </div>

        {/* Bottom dashed divider */}
        <div className="mx-7" style={{ borderTop: `1px dashed rgba(96,96,96,0.20)` }} />
        <div className="px-7 py-3 flex items-center justify-between">
          <p className="text-[7px] uppercase" style={{ color: `${C.gray}60`, letterSpacing: '0.08em' }}>
            midnightcorp.click/solstice
          </p>
          <p className="text-[7px] uppercase font-mono" style={{ color: `${C.gray}40` }}>
            {reg.order_number}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SolsticeMiSemana() {
  const { currentCustomer } = useStore();
  const [reg, setReg]       = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [noReg, setNoReg]   = useState(false);

  useEffect(() => { load(); }, [currentCustomer]);

  const load = async () => {
    if (!currentCustomer) { setLoading(false); setNoReg(true); return; }
    setLoading(true);
    try {
      // Find registration by user email
      const { data: regs } = await supabase
        .from('solstice_registrations')
        .select('*, solstice_weeks(university, start_date, end_date)')
        .eq('customer_email', currentCustomer.email)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!regs?.length) { setNoReg(true); setLoading(false); return; }

      const r = regs[0] as any;

      // Load schedules
      const { data: schedules } = await supabase
        .from('solstice_payment_schedules')
        .select('*')
        .eq('registration_id', r.id)
        .order('installment_number');

      // Load seller info
      let seller = null;
      if (r.seller_id) {
        const { data: sl } = await supabase
          .from('solstice_sellers').select('ref_code, user_id').eq('user_id', r.seller_id).maybeSingle();
        if (sl) {
          const { data: profile } = await supabase
            .from('promoters').select('name, email').eq('user_id', sl.user_id).maybeSingle();
          seller = { name: profile?.name, email: profile?.email, ref_code: sl.ref_code };
        }
      }

      setReg({ ...r, week: r.solstice_weeks, schedules: schedules || [], seller });
    } catch { setNoReg(true); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  if (noReg || !reg) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4" style={{ background: C.bg }}>
      <div className="w-16 h-16 flex items-center justify-center"
        style={{
          borderRadius: '999px',
          border: '0.5px solid rgba(230,57,47,0.40)',
          background: 'rgba(230,57,47,0.08)',
        }}>
        <Calendar size={24} style={{ color: `${C.red}60` }} />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
          Sin reserva activa
        </h2>
        <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
          No encontramos una reserva para esta cuenta
        </p>
      </div>
    </div>
  );

  const paid        = reg.schedules?.filter(s => s.status === 'paid') || [];
  const pending     = reg.schedules?.filter(s => s.status === 'pending') || [];
  const overdue     = reg.schedules?.filter(s => s.status === 'overdue') || [];
  const nextDue     = reg.schedules?.find(s => s.status === 'pending' || s.status === 'overdue');
  const paidPct     = reg.total_amount > 0 ? (reg.amount_paid / reg.total_amount) * 100 : 0;
  const hasRisk     = overdue.length > 0;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
        <p className="text-[9px] uppercase mb-1"
          style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 500 }}>Mi reserva</p>
        <h1 className="text-3xl uppercase"
          style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
          {reg.week?.university ? `Semana ${reg.week.university}` : 'Mi Semana'}
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
          {reg.week?.start_date
            ? `${new Date(reg.week.start_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })} — ${new Date(reg.week.end_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : 'SOLSTICE 2026'}
        </p>
      </div>

      <div className="px-8 py-8 max-w-4xl space-y-8">

        {/* ── Digital ticket ── */}
        <DigitalTicket reg={reg} />

        {/* ── Risk alert ── */}
        {hasRisk && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-4 px-5 py-4"
            style={{
              background: 'rgba(230,57,47,0.10)',
              border: '0.5px solid rgba(230,57,47,0.40)',
              borderRadius: '24px',
            }}>
            <AlertTriangle size={18} style={{ color: C.red }} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium uppercase mb-1" style={{ color: C.red, letterSpacing: '0.08em' }}>
                Cuota{overdue.length > 1 ? 's' : ''} vencida{overdue.length > 1 ? 's' : ''}
              </p>
              <p className="text-[10px] uppercase leading-relaxed" style={{ color: `${C.red}cc`, letterSpacing: '0.08em' }}>
                Tienes {overdue.length} cuota{overdue.length > 1 ? 's' : ''} sin pagar.
                Si no regularizas antes del evento puedes perder acceso al Catamarán (Día 3).
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Status card ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 p-8 relative overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}>
            <Shield size={100} className="absolute top-4 right-4 opacity-5" style={{ color: C.red }} />
            <div className="relative z-10 space-y-6">
              <div>
                <span className="text-[10px] font-medium uppercase px-3 py-1 inline-block mb-3"
                  style={{
                    border: '0.5px solid rgba(230,57,47,0.40)',
                    color: C.red,
                    letterSpacing: '0.08em',
                    borderRadius: '999px',
                    background: 'rgba(230,57,47,0.12)',
                  }}>
                  {reg.status === 'active' ? 'Reserva Confirmada' : reg.status === 'reserved' ? 'Pago Inicial Recibido' : reg.status.toUpperCase()}
                </span>
                <h2 className="text-3xl uppercase mb-1"
                  style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
                  {reg.customer_name}
                </h2>
                <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                  {reg.customer_university}
                </p>
              </div>
              <div className="flex flex-wrap gap-8">
                <div>
                  <p className="text-[8px] uppercase mb-1"
                    style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Modalidad</p>
                  <p className="text-sm font-medium uppercase">{MODE_LABEL[reg.payment_mode] || reg.payment_mode}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase mb-1"
                    style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Pagos completados</p>
                  <p className="text-sm font-medium">{paid.length} / {(reg.schedules?.length || 0) + 1} <span style={{ color: C.gray, fontSize: '10px' }}>(incl. reserva)</span></p>
                </div>
                <div>
                  <p className="text-[8px] uppercase mb-1"
                    style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Orden</p>
                  <p className="text-sm font-mono">{reg.order_number}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[9px] uppercase mb-1"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                  <span>Avance de pago</span>
                  <span style={{ color: C.red }}>{paidPct.toFixed(0)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden" style={{ background: 'rgba(96,96,96,0.20)', borderRadius: '999px' }}>
                  <motion.div className="h-full"
                    initial={{ width: 0 }} animate={{ width: `${paidPct}%` }}
                    transition={{ duration: 1 }}
                    style={{ background: C.red, borderRadius: '999px' }} />
                </div>
                <div className="flex justify-between text-[9px] uppercase mt-1"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                  <span>Pagado: {fmtK(reg.amount_paid)}</span>
                  <span>Total: {fmtK(reg.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Next payment card */}
          {nextDue ? (
            <div className="p-8 flex flex-col justify-between"
              style={{
                background: hasRisk ? 'rgba(230,57,47,0.15)' : C.red,
                border: hasRisk ? '0.5px solid rgba(230,57,47,0.40)' : 'none',
                borderRadius: '28px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
              <div>
                <h3 className="text-xs font-medium uppercase mb-3"
                  style={{ color: hasRisk ? C.red : C.cream, letterSpacing: '0.08em' }}>
                  {hasRisk ? '⚠ Cuota vencida' : 'Próximo pago'}
                </h3>
                <p className="text-5xl font-medium mb-2"
                  style={{ color: hasRisk ? C.red : C.cream, fontStretch: '125%' }}>
                  {fmtK(nextDue.amount)}
                </p>
                <p className="text-[10px] uppercase"
                  style={{ color: hasRisk ? `${C.red}90` : `${C.cream}cc`, letterSpacing: '0.08em', fontWeight: 500 }}>
                  {hasRisk ? 'Venció: ' : 'Vence: '}
                  {new Date(nextDue.due_date).toLocaleDateString('es-CO', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button
                className="w-full py-3 px-6 text-xs tracking-widest uppercase mt-4 transition-all hover:scale-[1.02]"
                style={{
                  background: hasRisk ? C.red : C.cream,
                  color: hasRisk ? C.cream : C.red,
                  borderRadius: '999px',
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                }}>
                <div className="flex items-center justify-center gap-2">
                  <CreditCard size={14} /> Pagar ahora
                </div>
              </button>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center gap-4"
              style={{
                background: 'rgba(16,185,129,0.10)',
                border: '0.5px solid rgba(16,185,129,0.30)',
                borderRadius: '28px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}>
              <CheckCircle2 size={40} style={{ color: C.green }} />
              <div className="text-center">
                <p className="text-sm font-medium uppercase mb-1" style={{ color: C.green }}>¡Al día!</p>
                <p className="text-[9px] uppercase"
                  style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>No tienes cuotas pendientes</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Plan de pagos ── */}
        {reg.schedules && reg.schedules.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs uppercase"
              style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Plan de pagos — La Vaca</p>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}>
              {reg.schedules.map((sc, idx) => (
                <div key={sc.id}
                  className="flex items-center justify-between px-6 py-4"
                  style={{
                    borderBottom: idx < reg.schedules!.length - 1 ? '0.5px solid rgba(255,255,255,0.08)' : 'none',
                    opacity: sc.status === 'paid' ? 0.5 : 1,
                    transition: 'all 0.3s ease',
                  }}>
                  <div className="flex items-center gap-5">
                    <div className="w-9 h-9 flex items-center justify-center shrink-0"
                      style={{
                        borderRadius: '14px',
                        ...(sc.status === 'paid'
                          ? { background: C.green, border: '0.5px solid rgba(16,185,129,0.30)' }
                          : sc.status === 'overdue'
                          ? { background: 'rgba(230,57,47,0.20)', border: '0.5px solid rgba(230,57,47,0.40)' }
                          : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }),
                      }}>
                      {sc.status === 'paid'
                        ? <CheckCircle2 size={16} style={{ color: C.cream }} />
                        : sc.status === 'overdue'
                        ? <AlertTriangle size={16} style={{ color: C.red }} />
                        : <Clock size={16} style={{ color: C.gray }} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{fmt(sc.amount)} COP</p>
                      <p className="text-[10px] uppercase"
                        style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                        Cuota {sc.installment_number} · {new Date(sc.due_date).toLocaleDateString('es-CO', { month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium uppercase px-3 py-1"
                    style={{
                      color: sc.status === 'paid' ? C.green : sc.status === 'overdue' ? C.red : C.gray,
                      background: sc.status === 'paid'
                        ? 'rgba(16,185,129,0.12)'
                        : sc.status === 'overdue'
                        ? 'rgba(230,57,47,0.12)'
                        : 'rgba(255,255,255,0.04)',
                      border: sc.status === 'paid'
                        ? '0.5px solid rgba(16,185,129,0.30)'
                        : sc.status === 'overdue'
                        ? '0.5px solid rgba(230,57,47,0.40)'
                        : '0.5px solid rgba(255,255,255,0.10)',
                      borderRadius: '999px',
                      letterSpacing: '0.08em',
                    }}>
                    {sc.status === 'paid' ? 'Pagado ✓' : sc.status === 'overdue' ? 'Vencida ⚠' : 'Pendiente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Promotor asignado ── */}
        {reg.seller && (
          <div className="p-6 flex items-center gap-6"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}>
            <div className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(230,57,47,0.20)',
                border: '0.5px solid rgba(230,57,47,0.40)',
                borderRadius: '14px',
              }}>
              <User size={20} style={{ color: C.red }} />
            </div>
            <div className="flex-1">
              <p className="text-[8px] uppercase mb-1"
                style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Tu promotor asignado</p>
              <p className="text-sm font-medium uppercase" style={{ letterSpacing: '0.08em' }}>{reg.seller.name || '—'}</p>
              {reg.seller.email && (
                <p className="text-[10px] flex items-center gap-1.5 mt-1" style={{ color: C.gray }}>
                  <Mail size={10} /> {reg.seller.email}
                </p>
              )}
            </div>
            <code className="text-[9px] px-3 py-1"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: C.gray,
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '999px',
              }}>
              {reg.seller.ref_code}
            </code>
          </div>
        )}

        {/* ── Info personal ── */}
        <div className="p-6 space-y-3"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          }}>
          <p className="text-[9px] uppercase mb-4"
            style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>Mis datos de registro</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: <User size={12} />, label: 'Nombre', value: reg.customer_name },
              { icon: <Mail size={12} />, label: 'Email',  value: reg.customer_email },
              { icon: <Phone size={12} />, label: 'Teléfono', value: reg.customer_phone || '—' },
              { icon: <Calendar size={12} />, label: 'Fecha de reserva', value: new Date(reg.created_at).toLocaleDateString('es-CO', { dateStyle: 'long' }) },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <span style={{ color: C.gray }}>{icon}</span>
                <div>
                  <p className="text-[8px] uppercase"
                    style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>{label}</p>
                  <p className="text-xs">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
