import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, AlertTriangle, Shield, Download,
  Loader2, CreditCard, User, Calendar, Phone, Mail, Sun,
  Ship, BedDouble, Copy, Users, MessageCircle, Check
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';
import SolsticeCuotaPayModal from '../components/SolsticeCuotaPayModal';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981', yellow: '#f59e0b' };

interface Registration {
  id: string; order_number: string; customer_name: string; customer_email: string;
  customer_phone: string; customer_university: string; payment_mode: string;
  status: string; total_amount: number; amount_paid: number;
  installments_remaining: number; created_at: string;
  week?: { university: string; start_date: string; end_date: string };
  seller?: { name: string; email: string; ref_code: string };
  schedules?: Schedule[];
  boat?: {
    name: string;
    invite_code: string;
    is_leader: boolean;
    slots_claimed: number;
    total_capacity: number;
    image_url?: string | null;
    passengers?: Array<{ id: string; name: string; is_leader: boolean }>;
  } | null;
  lodging?: { name: string; nights: number; total_amount: number; status: string; image_url?: string | null } | null;
}

interface Schedule {
  id: string; registration_id: string; installment_number: number; amount: number;
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
      const { default: html2canvas } = await import('html2canvas');
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
  const [payingCuota, setPayingCuota] = useState<Schedule | null>(null);

  useEffect(() => { load(); }, [currentCustomer]);

  // ── Realtime: cuando el webhook marca una cuota como paid, refrescamos
  // la pantalla automáticamente para que la barra de progreso suba al instante.
  // También escuchamos cambios en la lancha (invitados que se suman) y en la
  // registration (status, amount_paid).
  useEffect(() => {
    if (!reg?.id) return;
    const channel = supabase
      .channel(`solstice-mi-semana-${reg.id}`)
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'solstice_payment_schedules', filter: `registration_id=eq.${reg.id}` },
        () => load(),
      )
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'solstice_registrations', filter: `id=eq.${reg.id}` },
        () => load(),
      )
      .on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'solstice_boat_passengers', filter: `registration_id=eq.${reg.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg?.id]);

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

      // Boat reservation (via passenger entry)
      let boat = null;
      try {
        const { data: passenger } = await supabase
          .from('solstice_boat_passengers')
          .select('boat_reservation_id, is_leader')
          .eq('registration_id', r.id)
          .maybeSingle();
        if (passenger) {
          const { data: bres } = await supabase
            .from('solstice_boat_reservations')
            .select('invite_code, boat_id, slots_claimed, total_capacity')
            .eq('id', passenger.boat_reservation_id)
            .maybeSingle();
          if (bres) {
            const { data: bm } = await supabase
              .from('solstice_boats')
              .select('name, image_url')
              .eq('id', bres.boat_id)
              .maybeSingle();
            // Si el usuario es líder, traemos todos los pasajeros para mostrar la lista
            let passengers: Array<{ id: string; name: string; is_leader: boolean }> = [];
            if (passenger.is_leader) {
              const { data: pax } = await supabase
                .from('solstice_boat_passengers')
                .select('id, passenger_name, is_leader, joined_at')
                .eq('boat_reservation_id', passenger.boat_reservation_id)
                .order('is_leader', { ascending: false })
                .order('joined_at', { ascending: true });
              passengers = (pax || []).map((p: any) => ({
                id:        p.id,
                name:      p.passenger_name,
                is_leader: p.is_leader,
              }));
            }
            boat = {
              name: bm?.name || 'Lancha',
              image_url: bm?.image_url || null,
              invite_code: bres.invite_code,
              is_leader: passenger.is_leader,
              slots_claimed: bres.slots_claimed,
              total_capacity: bres.total_capacity,
              passengers,
            };
          }
        }
      } catch {}

      // Lodging reservation
      let lodging = null;
      try {
        const { data: lres } = await supabase
          .from('solstice_lodging_reservations')
          .select('nights, total_amount, status, lodging_id')
          .eq('registration_id', r.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lres) {
          const { data: lm } = await supabase
            .from('solstice_lodgings')
            .select('name, image_url')
            .eq('id', lres.lodging_id)
            .maybeSingle();
          lodging = {
            name: lm?.name || 'Hospedaje',
            image_url: lm?.image_url || null,
            nights: lres.nights,
            total_amount: lres.total_amount,
            status: lres.status,
          };
        }
      } catch {}

      setReg({ ...r, week: r.solstice_weeks, schedules: schedules || [], seller, boat, lodging });
    } catch { setNoReg(true); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  if (noReg || !reg) return <EmptyMiSemana customerEmail={currentCustomer?.email} />;

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

        {/* ── Countdown hero ── */}
        {reg.week?.start_date && <CountdownToWeek startDate={reg.week.start_date} />}

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
                onClick={() => setPayingCuota(nextDue)}
                className="w-full py-3 px-6 text-xs tracking-widest uppercase mt-4 transition-all hover:scale-[1.02]"
                style={{
                  background: hasRisk ? C.red : C.cream,
                  color: hasRisk ? C.cream : C.red,
                  borderRadius: '999px',
                  fontWeight: 500,
                  cursor: 'pointer',
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

        {/* ── Lancha ── */}
        {reg.boat && (
          <div className="space-y-3">
            <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              Tu lancha · Día 3
            </p>
            <div
              className="relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: '0.5px solid rgba(230,57,47,0.30)',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <div className="flex flex-col md:flex-row">
                {reg.boat.image_url && (
                  <img
                    src={reg.boat.image_url}
                    alt={reg.boat.name}
                    className="w-full md:w-48 h-44 md:h-auto object-cover flex-shrink-0"
                  />
                )}
                {!reg.boat.image_url && (
                  <div className="w-full md:w-48 h-44 md:h-auto flex-shrink-0 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${C.red}25, ${C.red}05)` }}>
                    <Ship size={48} style={{ color: C.red }} />
                  </div>
                )}

                <div className="p-6 flex-1 min-w-0 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Ship size={14} style={{ color: C.red }} />
                      <span className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.35em', fontWeight: 600 }}>
                        {reg.boat.is_leader ? 'Eres líder' : 'Invitado'}
                      </span>
                    </div>
                    <h3 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
                      {reg.boat.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users size={13} style={{ color: C.gray }} />
                    <span className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                      {reg.boat.slots_claimed} / {reg.boat.total_capacity} a bordo
                    </span>
                  </div>

                  {reg.boat.is_leader && (
                    <>
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.45)',
                          border: '0.5px dashed rgba(230,57,47,0.45)',
                          borderRadius: '12px',
                          padding: '14px',
                          textAlign: 'center',
                        }}
                      >
                        <p className="text-[9px] uppercase mb-2" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 600 }}>
                          Código de invitación
                        </p>
                        <p
                          className="font-mono"
                          style={{
                            fontSize: '22px',
                            color: C.cream,
                            letterSpacing: '0.4em',
                            fontWeight: 600,
                          }}
                        >
                          {reg.boat.invite_code}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/sol/i/${reg.boat!.invite_code}`;
                            const msg = `Te uniste a mi lancha Solstice 🌅 ${url}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                          }}
                          className="py-2.5 text-[10px] uppercase"
                          style={{
                            background: 'rgba(16,185,129,0.15)',
                            border: '0.5px solid rgba(16,185,129,0.45)',
                            color: '#10b981',
                            letterSpacing: '0.2em',
                            borderRadius: '999px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/sol/i/${reg.boat!.invite_code}`;
                            navigator.clipboard?.writeText(url);
                            toast.success('Link copiado');
                          }}
                          className="py-2.5 text-[10px] uppercase flex items-center justify-center gap-2"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '0.5px solid rgba(255,255,255,0.18)',
                            color: C.cream,
                            letterSpacing: '0.2em',
                            borderRadius: '999px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Copy size={11} /> Copiar
                        </button>
                      </div>

                      {/* Lista de pasajeros (solo líder) */}
                      {reg.boat.passengers && reg.boat.passengers.length > 0 && (
                        <div className="pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[9px] uppercase mb-2" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                            A bordo ({reg.boat.passengers.length}/{reg.boat.total_capacity})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {reg.boat.passengers.map(p => (
                              <span
                                key={p.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px]"
                                style={{
                                  background: p.is_leader ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.045)',
                                  border: p.is_leader ? '0.5px solid rgba(230,57,47,0.45)' : '0.5px solid rgba(255,255,255,0.10)',
                                  color: p.is_leader ? '#FFB48C' : C.cream,
                                  letterSpacing: '0.05em',
                                  fontWeight: 500,
                                  borderRadius: '999px',
                                }}
                              >
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                                  style={{
                                    background: p.is_leader ? '#E6392F' : 'rgba(255,255,255,0.10)',
                                    color: p.is_leader ? '#fff' : C.cream,
                                  }}
                                >
                                  {(p.name || '?').charAt(0).toUpperCase()}
                                </span>
                                {p.name?.split(' ')[0] || '—'}
                                {p.is_leader && <span style={{ fontSize: 9, opacity: 0.7 }}>· líder</span>}
                              </span>
                            ))}
                            {/* Plazas vacías como placeholders sutiles */}
                            {Array.from({ length: Math.max(0, reg.boat.total_capacity - reg.boat.passengers.length) }).slice(0, 6).map((_, i) => (
                              <span
                                key={`empty-${i}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px]"
                                style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  border: '0.5px dashed rgba(255,255,255,0.10)',
                                  color: `${C.gray}80`,
                                  letterSpacing: '0.05em',
                                  borderRadius: '999px',
                                }}
                              >
                                <span className="w-4 h-4 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
                                Cupo libre
                              </span>
                            ))}
                            {reg.boat.total_capacity - reg.boat.passengers.length > 6 && (
                              <span className="text-[10px] flex items-center px-1" style={{ color: `${C.gray}aa`, letterSpacing: '0.1em' }}>
                                +{reg.boat.total_capacity - reg.boat.passengers.length - 6} más
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Hospedaje ── */}
        {reg.lodging && (
          <div className="space-y-3">
            <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              Hospedaje reservado
            </p>
            <div
              className="flex flex-col md:flex-row overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(32px) saturate(180%)',
                border: '0.5px solid rgba(255,180,140,0.25)',
                borderRadius: '24px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              {reg.lodging.image_url ? (
                <img src={reg.lodging.image_url} alt={reg.lodging.name}
                  className="w-full md:w-48 h-44 md:h-auto object-cover flex-shrink-0" />
              ) : (
                <div className="w-full md:w-48 h-44 md:h-auto flex-shrink-0 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(255,180,140,0.25), rgba(255,180,140,0.05))' }}>
                  <BedDouble size={48} style={{ color: '#FFB48C' }} />
                </div>
              )}
              <div className="p-6 flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <BedDouble size={14} style={{ color: '#FFB48C' }} />
                  <span className="text-[10px] uppercase" style={{ color: '#FFB48C', letterSpacing: '0.35em', fontWeight: 600 }}>
                    {reg.lodging.status === 'confirmed' || reg.lodging.status === 'paid' ? 'Confirmado' : 'Pendiente confirmación'}
                  </span>
                </div>
                <h3 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
                  {reg.lodging.name}
                </h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Noches</p>
                    <p className="text-base" style={{ color: C.cream, fontWeight: 500 }}>{reg.lodging.nights}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Total</p>
                    <p className="text-base" style={{ color: C.cream, fontWeight: 500 }}>{fmtK(reg.lodging.total_amount)}</p>
                  </div>
                </div>
                {reg.lodging.status === 'pending' && (
                  <p className="text-[10px] uppercase" style={{ color: `${C.gray}cc`, letterSpacing: '0.15em', fontWeight: 500 }}>
                    Te contactamos por WhatsApp para confirmar disponibilidad y método de pago.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Invitar a panas — sharing viral con mensaje pre-armado ── */}
        <InviteFriendsCard reg={reg} />

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

      {/* Modal de pago de cuota */}
      <SolsticeCuotaPayModal
        schedule={payingCuota}
        customer={{ name: reg.customer_name, email: reg.customer_email, phone: reg.customer_phone }}
        onClose={() => {
          setPayingCuota(null);
          // Refrescamos schedules al cerrar — pago puede haber pasado
          load();
        }}
      />
    </div>
  );
}

// ── Countdown cinemático ───────────────────────────────────────────────────

function CountdownToWeek({ startDate }: { startDate: string }) {
  const [time, setTime] = useState(() => calcTime(startDate));
  useEffect(() => {
    const id = setInterval(() => setTime(calcTime(startDate)), 1000);
    return () => clearInterval(id);
  }, [startDate]);

  const isPast = time.total <= 0;
  const isClose = time.days <= 14 && !isPast;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(230,57,47,0.10) 0%, rgba(255,180,140,0.05) 100%)',
        border: `0.5px solid ${isClose ? 'rgba(230,57,47,0.45)' : 'rgba(255,255,255,0.10)'}`,
        borderRadius: '32px',
        padding: '40px 32px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: '-20%', top: '-30%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(230,57,47,0.25) 0%, transparent 60%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 text-center">
        <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: '#E6392F', fontWeight: 600 }}>
          {isPast ? 'Tu semana ya pasó' : 'Faltan'}
        </p>

        {!isPast && (
          <div className="flex items-center justify-center gap-3 md:gap-6 mb-4 flex-wrap">
            <CountUnit value={time.days}  label="días"  big />
            <CountSep />
            <CountUnit value={time.hours} label="horas" />
            <CountSep />
            <CountUnit value={time.mins}  label="min" />
            <CountSep />
            <CountUnit value={time.secs}  label="seg" />
          </div>
        )}

        {isPast ? (
          <p className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300, color: '#F9F2D7' }}>
            ¡Gracias por venir!
          </p>
        ) : (
          <p className="text-[10px] uppercase" style={{ letterSpacing: '0.3em', color: '#606060', fontWeight: 500 }}>
            para tu atardecer en Santa Marta
          </p>
        )}
      </div>
    </motion.div>
  );
}

function CountUnit({ value, label, big = false }: { value: number; label: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center min-w-[60px] md:min-w-[80px]">
      <span
        className="tabular-nums leading-none"
        style={{
          fontFamily: "'Poiret One', sans-serif",
          fontSize: big ? 'clamp(3rem, 8vw, 5.5rem)' : 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 300,
          color: big ? '#E6392F' : '#F9F2D7',
          letterSpacing: '-0.02em',
        }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] md:text-[10px] uppercase mt-2" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 500 }}>
        {label}
      </span>
    </div>
  );
}

function CountSep() {
  return (
    <span className="hidden md:inline" style={{ color: 'rgba(230,57,47,0.3)', fontSize: '2rem', fontWeight: 200 }}>
      ·
    </span>
  );
}

function calcTime(startDate: string) {
  const diff = new Date(startDate + 'T00:00:00').getTime() - Date.now();
  if (diff <= 0) return { total: 0, days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    total: diff,
    days:  Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins:  Math.floor((diff % 3600000) / 60000),
    secs:  Math.floor((diff % 60000) / 1000),
  };
}

// ── Invitar a panas: tarjeta de share viral en MiSemana ──────────────────
function InviteFriendsCard({ reg }: { reg: Registration }) {
  const firstName = (reg.customer_name || '').split(' ')[0] || 'tu pana';
  const uni       = reg.week?.university || reg.customer_university || 'Solstice';
  const url       = `${window.location.origin}/sol`;
  const message   = `${firstName} acá 🌅 reservé mi semana en SOLSTICE 2026 (${uni}) — 5 días en Santa Marta, atardecer en catamarán, lo más bonito del año. Si querés sumarte, asegurás tu lugar con $40K: ${url}`;
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard?.writeText(message);
    setCopied(true);
    toast.success('Mensaje copiado');
    setTimeout(() => setCopied(false), 2200);
  };

  const shareWA = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  };

  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: `Solstice 2026 · ${uni}`,
          text: message,
        });
        return;
      } catch { /* user cancelled */ }
    }
    copyLink();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
        Invitá a tus panas
      </p>
      <div
        className="relative overflow-hidden p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(230,57,47,0.12) 0%, rgba(255,180,140,0.06) 100%)',
          border: '0.5px solid rgba(230,57,47,0.30)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* Atmospheric glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: '-15%', top: '-30%',
            width: '300px', height: '300px',
            background: 'radial-gradient(circle, rgba(255,180,140,0.25) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #E6392F, #FF7A00)',
                color: '#fff',
                fontSize: 22,
                boxShadow: '0 8px 24px rgba(230,57,47,0.45)',
              }}
            >
              <Users size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase mb-1" style={{ color: '#FFB48C', letterSpacing: '0.3em', fontWeight: 600 }}>
                Llevatelos contigo
              </p>
              <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.01em', fontWeight: 300 }}>
                Solstice es mejor en grupo
              </h3>
              <p className="text-[11px] mt-2" style={{ color: C.gray, lineHeight: 1.55 }}>
                Compartí tu Solstice con tus panas. Cada invitación que aceptan se suma a la energía de la semana.
              </p>
            </div>
          </div>

          {/* Preview message */}
          <div
            className="p-3.5"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '0.5px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
            }}
          >
            <p className="text-[11px]" style={{ color: C.cream, lineHeight: 1.6, opacity: 0.85 }}>
              {message}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={shareWA}
              className="py-3 text-[10px] uppercase flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(16,185,129,0.18)',
                border: '0.5px solid rgba(16,185,129,0.50)',
                color: '#10b981',
                letterSpacing: '0.18em',
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <MessageCircle size={11} /> WhatsApp
            </button>
            <button
              onClick={shareNative}
              className="py-3 text-[10px] uppercase flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(255,180,140,0.15)',
                border: '0.5px solid rgba(255,180,140,0.45)',
                color: '#FFB48C',
                letterSpacing: '0.18em',
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sun size={11} /> Compartir
            </button>
            <button
              onClick={copyLink}
              className="py-3 text-[10px] uppercase flex items-center justify-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: C.cream,
                letterSpacing: '0.18em',
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Listo' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state cuando el usuario no tiene reserva activa ─────────────────
function EmptyMiSemana({ customerEmail }: { customerEmail?: string | null }) {
  const [weeks, setWeeks]   = useState<Array<{ id: string; university: string; start_date: string; capacity: number; reserved: number }>>([]);
  const [loading, setL]     = useState(true);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    (async () => {
      try {
        const { data: w } = await supabase
          .from('solstice_weeks')
          .select('id, university, start_date, capacity')
          .order('start_date');
        const { data: regs } = await supabase
          .from('solstice_registrations')
          .select('customer_university')
          .neq('status', 'cancelled');

        const reservedMap: Record<string, number> = {};
        for (const r of regs || []) {
          const uni = (r.customer_university || '').trim();
          if (uni) reservedMap[uni] = (reservedMap[uni] || 0) + 1;
        }
        setWeeks((w || []).map(x => ({
          ...x,
          reserved: reservedMap[x.university] || 0,
        })));
      } catch {
        setWeeks([]);
      } finally {
        setL(false);
      }
    })();
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {/* Atmosphere */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(230,57,47,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,122,0,0.06) 0%, transparent 60%),
            #000
          `,
        }}
      />

      {/* Floating particles */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.65, 0],
              y: [0, -60, -120],
              x: [0, Math.random() * 30 - 15, Math.random() * 60 - 30],
            }}
            transition={{
              duration: 7 + Math.random() * 4,
              delay: Math.random() * 4,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              bottom: '-10px',
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              borderRadius: '999px',
              background: i % 2 === 0 ? '#E6392F' : '#FFB48C',
              boxShadow: i % 2 === 0 ? '0 0 8px rgba(230,57,47,0.6)' : '0 0 8px rgba(255,180,140,0.6)',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 mx-auto mb-6"
            style={{
              borderRadius: '999px',
              border: '0.5px solid rgba(230,57,47,0.40)',
              background: 'rgba(230,57,47,0.10)',
              boxShadow: '0 0 40px rgba(230,57,47,0.25)',
            }}>
            <Sun size={26} style={{ color: C.red }} />
          </div>

          <p className="text-[10px] uppercase mb-3" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Tu Solstice te espera
          </p>
          <h1 className="uppercase mb-3"
            style={{
              fontFamily: "'Poiret One', sans-serif",
              fontSize: 'clamp(2.5rem, 8vw, 4.5rem)',
              letterSpacing: '-0.02em',
              fontWeight: 300,
              lineHeight: 1.05,
            }}
          >
            Aún no<br/>reservaste
          </h1>
          <p className="text-sm md:text-base" style={{ color: C.gray, lineHeight: 1.55, maxWidth: '380px', margin: '0 auto' }}>
            {customerEmail
              ? <>No encontramos una reserva con <strong style={{ color: C.cream }}>{customerEmail}</strong>. Empezá con $40K y armás tu combo desde ahí.</>
              : 'Empezá tu Solstice con $40K. Armás tu combo, elegís tu lancha del Día 3, y te avisamos antes de cada cobro.'}
          </p>
        </motion.div>

        {/* Weeks teaser */}
        {!loading && weeks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="space-y-2 mb-8"
          >
            <p className="text-[10px] uppercase mb-3 text-center"
              style={{ letterSpacing: '0.35em', color: C.gray, fontWeight: 600 }}>
              Semanas disponibles
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {weeks.slice(0, 4).map(w => {
                const pct = w.capacity > 0 ? (w.reserved / w.capacity) * 100 : 0;
                const isHot = pct >= 60;
                const remaining = Math.max(0, w.capacity - w.reserved);
                return (
                  <a
                    key={w.id}
                    href={`/sol`}
                    className="block p-4 transition-all hover:scale-[1.01]"
                    style={{
                      borderRadius: '18px',
                      background: 'rgba(255,255,255,0.035)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm uppercase" style={{ color: C.cream, letterSpacing: '0.08em', fontWeight: 600 }}>
                        {w.university}
                      </p>
                      {isHot && (
                        <span className="text-[8px] uppercase px-2 py-0.5"
                          style={{
                            background: 'rgba(255,180,140,0.15)',
                            color: '#FFB48C',
                            letterSpacing: '0.2em',
                            borderRadius: '999px',
                            fontWeight: 700,
                          }}>
                          🔥
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                      {new Date(w.start_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      {' · '}
                      <span style={{ color: remaining <= 20 ? C.red : C.gray }}>
                        {remaining} cupos
                      </span>
                    </p>
                    <div className="w-full mt-2 h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: isHot ? '#FFB48C' : C.red,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
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
            Empezar mi Solstice
          </a>

          <p className="text-[10px] uppercase text-center" style={{ color: `${C.gray}aa`, letterSpacing: '0.25em' }}>
            Reservás con $40K · 5 cuotas mensuales · WhatsApp 24h antes
          </p>
        </motion.div>
      </div>
    </div>
  );
}
