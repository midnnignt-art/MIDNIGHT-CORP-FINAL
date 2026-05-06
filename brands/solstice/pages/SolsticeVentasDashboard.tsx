import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Share2, Check, TrendingUp, Users, DollarSign,
  ChevronDown, ChevronUp, AlertTriangle, Banknote, Download,
  Loader2, CheckCircle2, Clock, X, Globe, Smartphone, Link2,
  BarChart2, UserCheck
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';
import { UserRole } from '../../../types';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981', yellow: '#f59e0b' };

// ── Types ──────────────────────────────────────────────────────────────────────

interface Season {
  id: string; name: string; entry_price: number; combo_total: number;
  installments: number; commission_pct: number; manager_commission_pct: number;
}

interface Schedule {
  id: string; registration_id: string; installment_number: number;
  amount: number; due_date: string; status: 'pending' | 'paid' | 'overdue';
}

interface Registration {
  id: string; order_number: string; customer_name: string; customer_email: string;
  customer_phone: string; customer_university: string; payment_mode: string;
  status: string; total_amount: number; amount_paid: number;
  installments_remaining: number; ref_code: string | null; seller_id: string | null;
  created_at: string;
  schedules?: Schedule[];
  seller_name?: string;
}

interface SolsticeSeller {
  id: string; user_id: string; university: string;
  role: 'seller' | 'manager'; ref_code: string; status: string;
  sales_team_id?: string; super_squad_id?: string;
  name?: string; team_name?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    reserved:  { color: C.yellow, label: 'Reservado'  },
    active:    { color: C.green,  label: 'Activo'     },
    completed: { color: C.green,  label: 'Completado' },
    cancelled: { color: C.red,    label: 'Cancelado'  },
    suspended: { color: C.red,    label: 'Suspendido' },
  };
  const s = map[status] || { color: C.gray, label: status };
  return (
    <span className="text-[8px] uppercase font-black px-2 py-0.5 rounded-sm"
      style={{ background: `${s.color}20`, color: s.color, letterSpacing: '0.15em' }}>
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color = C.cream }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-5" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
      <p className="text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: C.gray }}>{label}</p>
      <p className="text-2xl font-black" style={{ color, fontFamily: "'Archivo', sans-serif", fontStretch: '125%' }}>{value}</p>
      {sub && <p className="text-[9px] mt-1 uppercase" style={{ color: C.gray }}>{sub}</p>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { role: 'seller' | 'manager' | 'admin' }

export default function SolsticeVentasDashboard({ role }: Props) {
  const { currentUser, promoters, teams, superSquads } = useStore();

  const [season, setSeason]           = useState<Season | null>(null);
  const [mySeller, setMySeller]       = useState<SolsticeSeller | null>(null);
  const [registrations, setRegs]      = useState<Registration[]>([]);
  const [teamSellers, setTeamSellers] = useState<SolsticeSeller[]>([]);
  const [loading, setLoading]         = useState(true);
  const [linkCopied, setLinkCopied]   = useState(false);
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState<string>('all');

  // Cash modal state
  const [cashModal, setCashModal]     = useState<Registration | null>(null);
  const [cashSchedule, setCashSchedule] = useState<Schedule | null>(null);
  const [cashLoading, setCashLoading] = useState(false);

  const isSeller  = role === 'seller';
  const isManager = role === 'manager' || role === 'admin';

  // ── Load data ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // Season
      const { data: s } = await supabase.from('solstice_seasons').select('*').eq('status', 'open').single();
      if (s) setSeason(s as Season);

      // My seller profile
      const { data: me } = await supabase.from('solstice_sellers')
        .select('*').eq('user_id', currentUser.user_id).maybeSingle();

      if (me) {
        const team = teams.find(t => t.id === me.sales_team_id);
        setMySeller({ ...me, name: currentUser.name, team_name: team?.name } as SolsticeSeller);
      }

      // Registrations scope
      let regsQuery = supabase.from('solstice_registrations').select('*').order('created_at', { ascending: false });

      if (isSeller && currentUser) {
        regsQuery = regsQuery.eq('seller_id', currentUser.user_id);
      } else if (isManager && me) {
        // Manager sees all sellers in same university
        const { data: univSellers } = await supabase.from('solstice_sellers')
          .select('*').eq('university', me.university);
        if (univSellers?.length) {
          const sellerIds = univSellers.map((s: any) => s.user_id);
          regsQuery = regsQuery.in('seller_id', sellerIds);

          // Enrich team sellers
          const enriched = univSellers.map((sl: any) => {
            const p = promoters.find(p => p.user_id === sl.user_id);
            const t = teams.find(t => t.id === sl.sales_team_id);
            return { ...sl, name: p?.name, team_name: t?.name };
          });
          setTeamSellers(enriched as SolsticeSeller[]);
        }
      }

      const { data: regs } = await regsQuery;
      if (!regs?.length) { setRegs([]); setLoading(false); return; }

      // Load schedules for all registrations
      const regIds = regs.map((r: any) => r.id);
      const { data: schedules } = await supabase
        .from('solstice_payment_schedules').select('*')
        .in('registration_id', regIds).order('installment_number');

      // Enrich registrations
      const enriched = regs.map((r: any) => {
        const s = (schedules || []).filter((sc: any) => sc.registration_id === r.id);
        const seller = [...teamSellers, mySeller].find(sl => sl?.user_id === r.seller_id);
        return { ...r, schedules: s, seller_name: seller?.name || promoters.find(p => p.user_id === r.seller_id)?.name };
      });

      setRegs(enriched as Registration[]);
    } catch { /* DB not migrated yet */ }
    finally { setLoading(false); }
  }, [currentUser, isSeller, isManager, promoters, teams]);

  useEffect(() => { load(); }, [load]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const filtered = sellerFilter === 'all' ? registrations
      : registrations.filter(r => r.seller_id === sellerFilter);

    const total      = filtered.length;
    const digital    = filtered.filter(r => r.ref_code).length;
    const cash       = filtered.filter(r => r.payment_mode === 'cash_to_seller').length;
    const paid       = filtered.reduce((a, r) => a + r.amount_paid, 0);
    const pending    = filtered.reduce((a, r) => a + (r.total_amount - r.amount_paid), 0);
    const comPct     = (season?.commission_pct || 10) / 100;
    const comEarned  = paid * comPct;
    const comPending = pending * comPct;
    const inMora     = filtered.filter(r => r.schedules?.some(s => s.status === 'overdue')).length;

    return { total, digital, cash, paid, pending, comEarned, comPending, inMora };
  }, [registrations, sellerFilter, season]);

  // ── Link handling ──────────────────────────────────────────────────────────
  const referralLink = mySeller ? `https://midnightcorp.click/solstice?ref=${mySeller.ref_code}` : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Link copiado');
  };

  const shareWhatsApp = () => {
    const text = `¡Hola! Reserva tu semana SOLSTICE 2026 aquí: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ── Mark cash installment ──────────────────────────────────────────────────
  const openCashModal = (reg: Registration) => {
    const nextDue = reg.schedules?.find(s => s.status === 'pending' || s.status === 'overdue');
    setCashSchedule(nextDue || null);
    setCashModal(reg);
  };

  const confirmCashPayment = async () => {
    if (!cashModal || !cashSchedule || !currentUser) return;
    setCashLoading(true);
    try {
      // 1. Insert payment record
      const { data: payment, error: pe } = await supabase.from('solstice_payments').insert({
        registration_id: cashModal.id,
        amount: cashSchedule.amount,
        method: 'cash',
        status: 'completed',
        confirmed_by: currentUser.user_id,
        paid_at: new Date().toISOString(),
      }).select().single();
      if (pe) throw new Error(pe.message);

      // 2. Update schedule status
      await supabase.from('solstice_payment_schedules')
        .update({ status: 'paid', payment_id: payment.id })
        .eq('id', cashSchedule.id);

      // 3. Update registration amount_paid
      const newPaid = cashModal.amount_paid + cashSchedule.amount;
      const remaining = cashModal.installments_remaining - 1;
      await supabase.from('solstice_registrations').update({
        amount_paid: newPaid,
        installments_remaining: Math.max(remaining, 0),
        status: remaining <= 0 ? 'completed' : 'active',
      }).eq('id', cashModal.id);

      toast.success(`Cuota ${cashSchedule.installment_number} marcada como recibida`);
      setCashModal(null);
      setCashSchedule(null);
      load();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setCashLoading(false);
    }
  };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const rows = registrations.map(r => [
      r.order_number, r.customer_name, r.customer_email, r.customer_university,
      r.payment_mode, r.status, r.total_amount, r.amount_paid, r.total_amount - r.amount_paid,
      r.seller_name || '', r.ref_code || '',
    ]);
    const header = ['Orden','Nombre','Email','Universidad','Modalidad','Estado','Total','Pagado','Pendiente','Vendedor','Ref'];
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `solstice-ventas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success('CSV exportado');
  };

  const filteredRegs = sellerFilter === 'all' ? registrations
    : registrations.filter(r => r.seller_id === sellerFilter);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>
          {isSeller ? 'Mi Dashboard' : 'Dashboard — ' + (mySeller?.university || 'Gerente')}
        </p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          {isSeller ? 'Mis Ventas' : 'Vista Gerente'}
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {season?.name || 'SOLSTICE 2026'} · {mySeller?.university}
          {mySeller?.team_name && ` · ${mySeller.team_name}`}
        </p>
      </div>

      <div className="px-8 py-8 space-y-10 max-w-7xl">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Reservas totales"  value={String(kpis.total)}    sub={`${kpis.digital} digital · ${kpis.cash} efectivo`} />
          <KpiCard label="Ingresos recibidos" value={fmtK(kpis.paid)}       sub="acumulado" color={C.red} />
          <KpiCard label="Comisión ganada"    value={fmtK(kpis.comEarned)}  sub={`${season?.commission_pct || 10}% · pagado`} color={C.green} />
          <KpiCard label="Comisión pendiente" value={fmtK(kpis.comPending)} sub="sobre cuotas futuras" />
        </div>
        {kpis.inMora > 0 && (
          <div className="flex items-center gap-3 px-5 py-3" style={{ background: `${C.red}12`, border: `1px solid ${C.red}30` }}>
            <AlertTriangle size={16} style={{ color: C.red }} />
            <p className="text-xs uppercase font-bold" style={{ color: C.red, letterSpacing: '0.15em' }}>
              {kpis.inMora} comprador{kpis.inMora > 1 ? 'es' : ''} con cuota vencida
            </p>
          </div>
        )}

        {/* ── Link personal ── */}
        {mySeller && (
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: C.gray }}>Tu link de referidos</p>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3" style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
                <Link2 size={14} style={{ color: C.red }} />
                <span className="text-xs flex-1 truncate font-mono" style={{ color: C.cream }}>{referralLink}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={copyLink}
                  className="flex items-center gap-2 px-5 py-3 text-xs uppercase font-black tracking-widest transition-all"
                  style={{ background: linkCopied ? C.green : C.red, color: C.cream }}>
                  {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={shareWhatsApp}
                  className="flex items-center gap-2 px-5 py-3 text-xs uppercase font-black tracking-widest transition-all"
                  style={{ background: C.bgS, border: `1px solid ${C.gray}20`, color: C.cream }}>
                  <Share2 size={13} /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Manager: tabla de vendedores en mi universidad ── */}
        {isManager && teamSellers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>
                Vendedores · {mySeller?.university}
              </p>
              <button onClick={exportCsv}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all px-4 py-2"
                style={{ border: `1px solid ${C.gray}20`, color: C.gray }}
                onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                <Download size={12} /> Exportar CSV
              </button>
            </div>
            <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                <div className="col-span-3">Vendedor</div>
                <div className="col-span-2">Equipo</div>
                <div className="col-span-2 text-right">Reservas</div>
                <div className="col-span-2 text-right">Ingresado</div>
                <div className="col-span-2 text-right">Comisión</div>
                <div className="col-span-1" />
              </div>
              {teamSellers.map(sl => {
                const slRegs = registrations.filter(r => r.seller_id === sl.user_id);
                const slPaid = slRegs.reduce((a, r) => a + r.amount_paid, 0);
                const slCom  = slPaid * ((season?.commission_pct || 10) / 100);
                return (
                  <button key={sl.id}
                    onClick={() => setSellerFilter(v => v === sl.user_id ? 'all' : sl.user_id)}
                    className="w-full grid grid-cols-12 px-5 py-3 items-center text-left hover:bg-white/3 transition-colors"
                    style={{ borderBottom: `1px solid ${C.gray}08`, background: sellerFilter === sl.user_id ? `${C.red}08` : 'transparent' }}>
                    <div className="col-span-3">
                      <p className="text-xs font-bold uppercase truncate" style={{ color: sellerFilter === sl.user_id ? C.red : C.cream }}>{sl.name || '—'}</p>
                      <p className="text-[9px]" style={{ color: C.gray }}>{sl.ref_code}</p>
                    </div>
                    <div className="col-span-2 text-xs" style={{ color: C.gray }}>{sl.team_name || '—'}</div>
                    <div className="col-span-2 text-right text-xs font-bold">{slRegs.length}</div>
                    <div className="col-span-2 text-right text-xs">{fmtK(slPaid)}</div>
                    <div className="col-span-2 text-right text-xs" style={{ color: C.green }}>{fmtK(slCom)}</div>
                    <div className="col-span-1 flex justify-end">
                      {sellerFilter === sl.user_id ? <ChevronUp size={13} style={{ color: C.red }} /> : <ChevronDown size={13} style={{ color: C.gray }} />}
                    </div>
                  </button>
                );
              })}
            </div>
            {sellerFilter !== 'all' && (
              <button onClick={() => setSellerFilter('all')}
                className="text-[10px] uppercase tracking-widest" style={{ color: C.gray }}>
                ← Ver todos
              </button>
            )}
          </div>
        )}

        {/* ── Tabla de compradores ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>
              {sellerFilter === 'all' ? 'Todos los compradores' : `Compradores de ${teamSellers.find(s => s.user_id === sellerFilter)?.name}`}
              <span className="ml-2" style={{ color: C.red }}>({filteredRegs.length})</span>
            </p>
            {!isManager && (
              <button onClick={exportCsv}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest px-4 py-2 transition-all"
                style={{ border: `1px solid ${C.gray}20`, color: C.gray }}
                onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                <Download size={12} /> CSV
              </button>
            )}
          </div>

          {filteredRegs.length === 0 ? (
            <div className="py-16 text-center" style={{ color: C.gray }}>
              <UserCheck size={32} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs uppercase tracking-widest">Sin compradores aún</p>
            </div>
          ) : (
            <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
              {/* Header */}
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest hidden md:grid"
                style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                <div className="col-span-3">Comprador</div>
                <div className="col-span-2">Modalidad</div>
                <div className="col-span-2">Estado</div>
                <div className="col-span-2 text-right">Pagado</div>
                <div className="col-span-2 text-right">Próxima cuota</div>
                <div className="col-span-1" />
              </div>

              {filteredRegs.map(reg => {
                const nextSchedule = reg.schedules?.find(s => s.status === 'pending' || s.status === 'overdue');
                const hasOverdue   = reg.schedules?.some(s => s.status === 'overdue');
                const isExpanded   = expanded === reg.id;
                const canMarkCash  = reg.payment_mode === 'cash_to_seller' && nextSchedule;

                return (
                  <div key={reg.id} style={{ borderBottom: `1px solid ${C.gray}08` }}>
                    {/* Row */}
                    <div className="grid grid-cols-12 px-5 py-4 items-center cursor-pointer hover:bg-white/3 transition-colors"
                      onClick={() => setExpanded(v => v === reg.id ? null : reg.id)}>
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          {hasOverdue && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.red }} />}
                          <div>
                            <p className="text-xs font-bold uppercase truncate" style={{ letterSpacing: '0.08em' }}>{reg.customer_name}</p>
                            <p className="text-[9px] truncate" style={{ color: C.gray }}>{reg.customer_university}</p>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1.5">
                          {reg.ref_code
                            ? <Globe size={10} style={{ color: C.green }} />
                            : <Banknote size={10} style={{ color: C.yellow }} />}
                          <span className="text-[9px] uppercase" style={{ color: C.gray }}>
                            {reg.payment_mode === 'cash_to_seller' ? 'Efectivo' :
                             reg.payment_mode === 'full_combo' ? 'Combo' :
                             reg.payment_mode === 'auto_subscription' ? 'Auto' :
                             reg.payment_mode === 'individual_days' ? 'Días' : 'Mensual'}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2"><StatusBadge status={reg.status} /></div>
                      <div className="col-span-2 text-right">
                        <p className="text-xs font-bold">{fmtK(reg.amount_paid)}</p>
                        <p className="text-[9px]" style={{ color: C.gray }}>de {fmtK(reg.total_amount)}</p>
                      </div>
                      <div className="col-span-2 text-right">
                        {nextSchedule ? (
                          <div>
                            <p className="text-xs font-bold" style={{ color: hasOverdue ? C.red : C.cream }}>{fmtK(nextSchedule.amount)}</p>
                            <p className="text-[9px]" style={{ color: hasOverdue ? C.red : C.gray }}>
                              {hasOverdue ? '⚠ Vencida' : new Date(nextSchedule.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[9px]" style={{ color: C.green }}>Al día ✓</span>
                        )}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {isExpanded ? <ChevronUp size={13} style={{ color: C.red }} /> : <ChevronDown size={13} style={{ color: C.gray }} />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="px-5 pb-5 pt-2 space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, background: `${C.bgT}` }}>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              {[
                                ['Email', reg.customer_email],
                                ['Teléfono', reg.customer_phone || '—'],
                                ['Orden', reg.order_number],
                                ['Ref. código', reg.ref_code || '—'],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <p className="text-[9px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.2em' }}>{k}</p>
                                  <p className="font-mono text-[10px]" style={{ color: C.cream }}>{v}</p>
                                </div>
                              ))}
                            </div>

                            {/* Payment schedule */}
                            {reg.schedules && reg.schedules.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: C.gray }}>Plan de cuotas</p>
                                <div className="flex flex-wrap gap-2">
                                  {reg.schedules.map(sc => (
                                    <div key={sc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px]"
                                      style={{
                                        background: sc.status === 'paid' ? `${C.green}15` : sc.status === 'overdue' ? `${C.red}15` : `${C.gray}10`,
                                        border: `1px solid ${sc.status === 'paid' ? C.green + '30' : sc.status === 'overdue' ? C.red + '30' : C.gray + '20'}`,
                                      }}>
                                      {sc.status === 'paid'
                                        ? <CheckCircle2 size={10} style={{ color: C.green }} />
                                        : sc.status === 'overdue'
                                        ? <AlertTriangle size={10} style={{ color: C.red }} />
                                        : <Clock size={10} style={{ color: C.gray }} />}
                                      <span style={{ color: sc.status === 'paid' ? C.green : sc.status === 'overdue' ? C.red : C.gray }}>
                                        C{sc.installment_number} · {fmtK(sc.amount)} · {new Date(sc.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Cash action */}
                            {canMarkCash && (
                              <button onClick={() => openCashModal(reg)}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-black tracking-widest transition-all"
                                style={{ background: C.bgS, border: `1px solid ${C.yellow}40`, color: C.yellow }}>
                                <Banknote size={13} />
                                Marcar cuota {nextSchedule.installment_number} como recibida · {fmtK(nextSchedule.amount)}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Canal de ventas (Digital vs Efectivo) ── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 space-y-3" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
            <div className="flex items-center gap-2">
              <Globe size={14} style={{ color: C.green }} />
              <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Canal digital</p>
            </div>
            <p className="text-3xl font-black" style={{ color: C.green }}>{kpis.digital}</p>
            <p className="text-[9px] uppercase" style={{ color: C.gray }}>via link ?ref=</p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: `${C.gray}20` }}>
              <div className="h-full rounded-full" style={{ width: kpis.total ? `${(kpis.digital / kpis.total) * 100}%` : '0%', background: C.green }} />
            </div>
          </div>
          <div className="p-5 space-y-3" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
            <div className="flex items-center gap-2">
              <Banknote size={14} style={{ color: C.yellow }} />
              <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Canal efectivo</p>
            </div>
            <p className="text-3xl font-black" style={{ color: C.yellow }}>{kpis.cash}</p>
            <p className="text-[9px] uppercase" style={{ color: C.gray }}>cobro directo al promotor</p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: `${C.gray}20` }}>
              <div className="h-full rounded-full" style={{ width: kpis.total ? `${(kpis.cash / kpis.total) * 100}%` : '0%', background: C.yellow }} />
            </div>
          </div>
        </div>

      </div>

      {/* ── Cash confirmation modal ── */}
      <AnimatePresence>
        {cashModal && cashSchedule && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
              onClick={() => setCashModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
              style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
                  Confirmar pago en efectivo
                </h3>
                <button onClick={() => setCashModal(null)} style={{ color: C.gray }}><X size={18} /></button>
              </div>
              <div className="space-y-2 p-4" style={{ background: C.bgT, border: `1px solid ${C.gray}15` }}>
                {[
                  ['Comprador', cashModal.customer_name],
                  ['Cuota N°', String(cashSchedule.installment_number)],
                  ['Monto', fmt(cashSchedule.amount)],
                  ['Vencimiento', new Date(cashSchedule.due_date).toLocaleDateString('es-CO', { dateStyle: 'long' })],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em' }}>
                    <span style={{ color: C.gray }}>{k}</span>
                    <span style={{ color: C.cream }}>{v}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] uppercase leading-relaxed" style={{ color: C.gray }}>
                Al confirmar declaras haber recibido físicamente {fmt(cashSchedule.amount)} COP del comprador.
              </p>
              <button onClick={confirmCashPayment} disabled={cashLoading}
                className="w-full py-4 text-sm uppercase font-black tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: C.yellow, color: '#000' }}>
                {cashLoading ? <Loader2 size={14} className="animate-spin" /> : <><Banknote size={14} /> Confirmar recibo</>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
