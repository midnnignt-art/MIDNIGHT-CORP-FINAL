import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart2, DollarSign, Users, TrendingUp, AlertTriangle,
  Download, Loader2, X, CheckCircle2, Banknote, Globe,
  Percent, Calendar, ArrowUpRight, ArrowDownRight, Send
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981', yellow: '#f59e0b', blue: '#3b82f6' };

// ── Types ─────────────────────────────────────────────────────────────────────

interface Season {
  id: string; name: string; entry_price: number; combo_total: number;
  installments: number; commission_pct: number; manager_commission_pct: number;
}
interface Registration {
  id: string; order_number: string; customer_name: string; customer_university: string;
  payment_mode: string; status: string; total_amount: number; amount_paid: number;
  ref_code: string | null; seller_id: string | null; created_at: string;
  week_id: string | null;
}
interface Schedule {
  id: string; registration_id: string; installment_number: number;
  amount: number; due_date: string; status: 'pending' | 'paid' | 'overdue';
}
interface Week { id: string; university: string; capacity: number; start_date: string; end_date: string; }
interface Seller {
  id: string; user_id: string; university: string; role: string;
  ref_code: string; name?: string; team_name?: string;
}
interface CommissionPayout {
  id: string; seller_user_id: string; amount: number; method: string; paid_at: string;
}

type Tab = 'resumen' | 'vendedores' | 'cashflow' | 'comisiones' | 'exportar';

const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;
const fmtM = (n: number) => n >= 1_000_000 ? `$${(n/1_000_000).toFixed(1)}M` : fmtK(n);

const MODE_SHORT: Record<string, string> = {
  auto_subscription: 'Auto', manual_monthly: 'Mensual',
  cash_to_seller: 'Efectivo', individual_days: 'Días', full_combo: 'Combo',
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = C.cream, icon }: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="p-5 space-y-2" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>{label}</p>
        {icon && <span style={{ color: `${color}60` }}>{icon}</span>}
      </div>
      <p className="text-2xl font-black" style={{ color, fontStretch: '125%', fontFamily: "'Archivo', sans-serif" }}>{value}</p>
      {sub && <p className="text-[9px] uppercase" style={{ color: C.gray }}>{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SolsticeAdminFinance() {
  const { currentUser, promoters, teams } = useStore();
  const [tab, setTab]               = useState<Tab>('resumen');
  const [season, setSeason]         = useState<Season | null>(null);
  const [regs, setRegs]             = useState<Registration[]>([]);
  const [schedules, setSchedules]   = useState<Schedule[]>([]);
  const [weeks, setWeeks]           = useState<Week[]>([]);
  const [sellers, setSellers]       = useState<Seller[]>([]);
  const [payouts, setPayouts]       = useState<CommissionPayout[]>([]);
  const [loading, setLoading]       = useState(true);

  // Commission modal
  const [comModal, setComModal]     = useState<Seller | null>(null);
  const [comAmount, setComAmount]   = useState('');
  const [comMethod, setComMethod]   = useState('transfer');
  const [comNotes, setComNotes]     = useState('');
  const [comLoading, setComLoading] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [
        { data: s }, { data: r }, { data: sc }, { data: w },
        { data: sl }, { data: po }
      ] = await Promise.all([
        supabase.from('solstice_seasons').select('*').eq('status', 'open').single(),
        supabase.from('solstice_registrations').select('*').order('created_at', { ascending: false }),
        supabase.from('solstice_payment_schedules').select('*').order('due_date'),
        supabase.from('solstice_weeks').select('*'),
        supabase.from('solstice_sellers').select('*'),
        supabase.from('solstice_commission_payouts').select('*').order('paid_at', { ascending: false }),
      ]);

      if (s) setSeason(s as Season);
      setRegs((r || []) as Registration[]);
      setSchedules((sc || []) as Schedule[]);
      setWeeks((w || []) as Week[]);
      setPayouts((po || []) as CommissionPayout[]);

      // Enrich sellers
      const enriched = (sl || []).map((sel: any) => {
        const p = promoters.find(p => p.user_id === sel.user_id);
        const t = teams.find(t => t.id === sel.sales_team_id);
        return { ...sel, name: p?.name || sel.user_id.slice(0,8), team_name: t?.name };
      });
      setSellers(enriched as Seller[]);
    } catch { /* DB not ready */ }
    finally { setLoading(false); }
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalReceived  = regs.reduce((a, r) => a + r.amount_paid, 0);
    const totalPending   = schedules.filter(s => s.status !== 'paid').reduce((a, s) => a + s.amount, 0);
    const totalRegs      = regs.length;
    const overdue        = schedules.filter(s => s.status === 'overdue').length;
    const moraPct        = schedules.length ? ((overdue / schedules.length) * 100).toFixed(1) : '0';
    const comPct         = (season?.commission_pct || 10) / 100;
    const comTotal       = totalReceived * comPct;
    const comPaid        = payouts.reduce((a, p) => a + p.amount, 0);
    const comPending2    = comTotal - comPaid;
    const cuposVendidos  = totalRegs;
    const cuposTotal     = weeks.reduce((a, w) => a + w.capacity, 0);
    return { totalReceived, totalPending, totalRegs, moraPct, comTotal, comPaid, comPendingCom: comPending2, cuposVendidos, cuposTotal };
  }, [regs, schedules, payouts, season, weeks]);

  // ── Por universidad ────────────────────────────────────────────────────────
  const byUniversity = useMemo(() => {
    return weeks.map(w => {
      const wRegs = regs.filter(r => r.week_id === w.id);
      const paid  = wRegs.reduce((a, r) => a + r.amount_paid, 0);
      const pend  = wRegs.reduce((a, r) => a + (r.total_amount - r.amount_paid), 0);
      const wSch  = schedules.filter(s => wRegs.some(r => r.id === s.registration_id));
      const mora  = wSch.filter(s => s.status === 'overdue').length;
      const topSeller = sellers.filter(s => s.university === w.university)
        .map(s => ({ ...s, count: wRegs.filter(r => r.seller_id === s.user_id).length }))
        .sort((a, b) => b.count - a.count)[0];
      return { week: w, regs: wRegs.length, pct: w.capacity ? (wRegs.length / w.capacity * 100) : 0, paid, pend, mora, topSeller };
    });
  }, [regs, weeks, schedules, sellers]);

  // ── Por modalidad ──────────────────────────────────────────────────────────
  const byMode = useMemo(() => {
    const modes = ['auto_subscription','manual_monthly','cash_to_seller','individual_days','full_combo'];
    return modes.map(mode => {
      const mRegs = regs.filter(r => r.payment_mode === mode);
      const paid  = mRegs.reduce((a, r) => a + r.amount_paid, 0);
      const mSch  = schedules.filter(s => mRegs.some(r => r.id === s.registration_id));
      const mora  = mSch.filter(s => s.status === 'overdue').length;
      return { mode, label: MODE_SHORT[mode], count: mRegs.length, paid, mora };
    }).filter(m => m.count > 0);
  }, [regs, schedules]);

  // ── Cash flow chart data ───────────────────────────────────────────────────
  const cashFlowData = useMemo(() => {
    const map: Record<string, { mes: string; recibido: number; proyectado: number }> = {};
    schedules.forEach(s => {
      const key = s.due_date.slice(0, 7); // YYYY-MM
      if (!map[key]) map[key] = { mes: key, recibido: 0, proyectado: 0 };
      if (s.status === 'paid') map[key].recibido += s.amount;
      else map[key].proyectado += s.amount;
    });
    // Entry payments (amount_paid on registration, approximate to created_at month)
    regs.forEach(r => {
      if (r.amount_paid > 0) {
        const key = r.created_at.slice(0, 7);
        if (!map[key]) map[key] = { mes: key, recibido: 0, proyectado: 0 };
        map[key].recibido += r.amount_paid;
      }
    });
    return Object.values(map)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(d => ({ ...d, mes: new Date(d.mes + '-01').toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }) }));
  }, [schedules, regs]);

  // ── Commission per seller ──────────────────────────────────────────────────
  const sellerCommissions = useMemo(() => {
    const comPct = (season?.commission_pct || 10) / 100;
    return sellers.map(sl => {
      const slRegs  = regs.filter(r => r.seller_id === sl.user_id);
      const earned  = slRegs.reduce((a, r) => a + r.amount_paid * comPct, 0);
      const paid    = payouts.filter(p => p.seller_user_id === sl.user_id).reduce((a, p) => a + p.amount, 0);
      const balance = earned - paid;
      return { ...sl, earned, paid, balance, regsCount: slRegs.length };
    }).filter(s => s.earned > 0 || s.regsCount > 0);
  }, [sellers, regs, payouts, season]);

  // ── Pay commission ─────────────────────────────────────────────────────────
  const payCommission = async () => {
    if (!comModal || !comAmount || !currentUser) return;
    setComLoading(true);
    const { error } = await supabase.from('solstice_commission_payouts').insert({
      season_id: season?.id,
      seller_user_id: comModal.user_id,
      amount: Number(comAmount),
      method: comMethod,
      notes: comNotes || null,
      paid_by: currentUser.user_id,
    });
    setComLoading(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(`Comisión de ${fmt(Number(comAmount))} registrada para ${comModal.name}`);
    setComModal(null); setComAmount(''); setComNotes('');
    load();
  };

  // ── CSV exports ────────────────────────────────────────────────────────────
  const exportCsv = (rows: any[][], filename: string) => {
    const csv = rows.map(r => r.join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = filename; a.click();
    toast.success('Exportado');
  };

  const exportTransactions = () => exportCsv(
    [['Orden','Nombre','Universidad','Modalidad','Estado','Total','Pagado','Pendiente','Ref','Vendedor'],
     ...regs.map(r => [r.order_number, r.customer_name, r.customer_university, r.payment_mode, r.status,
       r.total_amount, r.amount_paid, r.total_amount - r.amount_paid, r.ref_code||'', sellers.find(s=>s.user_id===r.seller_id)?.name||''])],
    `solstice-transacciones-${new Date().toISOString().slice(0,10)}.csv`
  );

  const exportMorosos = () => {
    const overdueRegs = regs.filter(r => schedules.some(s => s.registration_id === r.id && s.status === 'overdue'));
    exportCsv(
      [['Nombre','Email','Universidad','Modalidad','Cuotas vencidas','Saldo pendiente'],
       ...overdueRegs.map(r => {
         const ov = schedules.filter(s => s.registration_id === r.id && s.status === 'overdue');
         return [r.customer_name, r.customer_university, r.payment_mode, ov.length, r.total_amount - r.amount_paid];
       })],
      `solstice-morosos-${new Date().toISOString().slice(0,10)}.csv`
    );
  };

  const exportCommissions = () => exportCsv(
    [['Vendedor','Universidad','Equipo','Reservas','Comisión ganada','Comisión pagada','Saldo'],
     ...sellerCommissions.map(s => [s.name||'', s.university, s.team_name||'', s.regsCount, Math.round(s.earned), Math.round(s.paid), Math.round(s.balance)])],
    `solstice-comisiones-${new Date().toISOString().slice(0,10)}.csv`
  );

  const exportSchedules = () => {
    const pending = schedules.filter(s => s.status !== 'paid');
    exportCsv(
      [['Registro','Cuota','Monto','Vencimiento','Estado'],
       ...pending.map(s => {
         const r = regs.find(r => r.id === s.registration_id);
         return [r?.customer_name||'', s.installment_number, s.amount, s.due_date, s.status];
       })],
      `solstice-cuotas-pendientes-${new Date().toISOString().slice(0,10)}.csv`
    );
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'resumen',    label: 'Resumen',      icon: <BarChart2 size={13} /> },
    { id: 'vendedores', label: 'Vendedores',   icon: <Users size={13} /> },
    { id: 'cashflow',   label: 'Flujo de caja',icon: <TrendingUp size={13} /> },
    { id: 'comisiones', label: 'Comisiones',   icon: <Percent size={13} /> },
    { id: 'exportar',   label: 'Exportar',     icon: <Download size={13} /> },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>Admin</p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          Finanzas Solstice
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {season?.name || 'SOLSTICE 2026'} · Aislado de Midnight
        </p>
      </div>

      {/* KPI Cards */}
      <div className="px-8 pt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Ingresos recibidos" value={fmtM(kpis.totalReceived)} color={C.green} icon={<ArrowUpRight size={16}/>} />
        <KpiCard label="Ingresos proyectados" value={fmtM(kpis.totalPending)} color={C.gray} icon={<Calendar size={16}/>} sub="cuotas futuras" />
        <KpiCard label="Reservas totales" value={String(kpis.totalRegs)} sub={`${kpis.cuposVendidos}/${kpis.cuposTotal} cupos`} />
        <KpiCard label="Tasa de mora" value={`${kpis.moraPct}%`} color={Number(kpis.moraPct) > 10 ? C.red : C.cream} icon={<AlertTriangle size={16}/>} />
        <KpiCard label="Comisión ganada" value={fmtM(kpis.comTotal)} color={C.yellow} sub={`${season?.commission_pct || 10}% sobre cobrado`} />
        <KpiCard label="Comisión por pagar" value={fmtM(kpis.comPendingCom)} color={kpis.comPendingCom > 0 ? C.red : C.green} sub="saldo pendiente" />
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto px-8 pt-6 gap-1" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-5 py-3 text-[10px] uppercase tracking-widest whitespace-nowrap transition-all"
            style={{ color: tab === t.id ? C.cream : C.gray, borderBottom: tab === t.id ? `2px solid ${C.red}` : '2px solid transparent' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="px-8 py-8 max-w-7xl">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── RESUMEN ── */}
            {tab === 'resumen' && (
              <div className="space-y-10">

                {/* Por universidad */}
                <div className="space-y-3">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Por universidad</h2>
                  <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                      style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                      <div className="col-span-2">Universidad</div>
                      <div className="col-span-2 text-right">Reservas</div>
                      <div className="col-span-2 text-right">% vendido</div>
                      <div className="col-span-2 text-right">Ingresado</div>
                      <div className="col-span-2 text-right">Pendiente</div>
                      <div className="col-span-2 text-right">Vendedor top</div>
                    </div>
                    {byUniversity.map(({ week, regs: cnt, pct, paid, pend, mora, topSeller }) => (
                      <div key={week.id} className="grid grid-cols-12 px-5 py-4 items-center"
                        style={{ borderBottom: `1px solid ${C.gray}08` }}>
                        <div className="col-span-2">
                          <p className="text-xs font-bold uppercase">{week.university}</p>
                          <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full" style={{ background: `${C.gray}20` }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.red }} />
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className="text-sm font-bold">{cnt}</p>
                          {mora > 0 && <p className="text-[9px]" style={{ color: C.red }}>⚠ {mora} mora</p>}
                        </div>
                        <div className="col-span-2 text-right text-sm font-bold" style={{ color: pct >= 80 ? C.red : C.cream }}>
                          {pct.toFixed(0)}%
                        </div>
                        <div className="col-span-2 text-right text-xs" style={{ color: C.green }}>{fmtK(paid)}</div>
                        <div className="col-span-2 text-right text-xs" style={{ color: C.gray }}>{fmtK(pend)}</div>
                        <div className="col-span-2 text-right text-[10px]" style={{ color: C.gray }}>
                          {topSeller?.name || '—'}{topSeller?.count ? ` (${topSeller.count})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Por modalidad */}
                <div className="space-y-3">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Por modalidad de pago</h2>
                  <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                      style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                      <div className="col-span-4">Modalidad</div>
                      <div className="col-span-2 text-right">Compradores</div>
                      <div className="col-span-3 text-right">Ingresado</div>
                      <div className="col-span-3 text-right">Mora (cuotas)</div>
                    </div>
                    {byMode.map(m => (
                      <div key={m.mode} className="grid grid-cols-12 px-5 py-3 items-center"
                        style={{ borderBottom: `1px solid ${C.gray}08` }}>
                        <div className="col-span-4 flex items-center gap-2">
                          {m.mode === 'cash_to_seller'
                            ? <Banknote size={13} style={{ color: C.yellow }} />
                            : <Globe size={13} style={{ color: C.green }} />}
                          <span className="text-xs uppercase" style={{ letterSpacing: '0.1em' }}>{m.label}</span>
                        </div>
                        <div className="col-span-2 text-right text-sm font-bold">{m.count}</div>
                        <div className="col-span-3 text-right text-xs" style={{ color: C.green }}>{fmtK(m.paid)}</div>
                        <div className="col-span-3 text-right text-xs" style={{ color: m.mora > 0 ? C.red : C.gray }}>
                          {m.mora > 0 ? `⚠ ${m.mora}` : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── VENDEDORES (tabla maestra) ── */}
            {tab === 'vendedores' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>
                    Tabla maestra de vendedores
                  </h2>
                </div>
                <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                  <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                    style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                    <div className="col-span-3">Vendedor</div>
                    <div className="col-span-2">Uni · Equipo</div>
                    <div className="col-span-1 text-right">Reservas</div>
                    <div className="col-span-1 text-right">Digital</div>
                    <div className="col-span-1 text-right">Efectivo</div>
                    <div className="col-span-2 text-right">Ingresado</div>
                    <div className="col-span-2 text-right">Comisión</div>
                  </div>
                  {sellers.length === 0 && (
                    <div className="py-10 text-center text-xs uppercase" style={{ color: C.gray }}>
                      Sin vendedores registrados
                    </div>
                  )}
                  {sellers.map(sl => {
                    const slRegs    = regs.filter(r => r.seller_id === sl.user_id);
                    const digital   = slRegs.filter(r => r.ref_code).length;
                    const efectivo  = slRegs.filter(r => r.payment_mode === 'cash_to_seller').length;
                    const paid      = slRegs.reduce((a, r) => a + r.amount_paid, 0);
                    const comEarned = paid * ((season?.commission_pct || 10) / 100);
                    const comPaid2  = payouts.filter(p => p.seller_user_id === sl.user_id).reduce((a, p) => a + p.amount, 0);
                    const bal       = comEarned - comPaid2;
                    return (
                      <div key={sl.id} className="grid grid-cols-12 px-5 py-3 items-center"
                        style={{ borderBottom: `1px solid ${C.gray}08` }}>
                        <div className="col-span-3">
                          <p className="text-xs font-bold uppercase truncate">{sl.name}</p>
                          <p className="text-[9px]" style={{ color: C.gray }}>{sl.ref_code}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[9px] uppercase" style={{ color: C.gray }}>{sl.university}</p>
                          {sl.team_name && <p className="text-[9px]" style={{ color: `${C.gray}80` }}>{sl.team_name}</p>}
                        </div>
                        <div className="col-span-1 text-right text-sm font-bold">{slRegs.length}</div>
                        <div className="col-span-1 text-right text-xs" style={{ color: C.green }}>{digital}</div>
                        <div className="col-span-1 text-right text-xs" style={{ color: C.yellow }}>{efectivo}</div>
                        <div className="col-span-2 text-right text-xs">{fmtK(paid)}</div>
                        <div className="col-span-2 text-right">
                          <p className="text-xs" style={{ color: C.green }}>{fmtK(comEarned)}</p>
                          {bal > 0 && <p className="text-[9px]" style={{ color: C.red }}>-{fmtK(bal)} pend.</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── FLUJO DE CAJA ── */}
            {tab === 'cashflow' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: C.gray }}>Flujo de caja proyectado</h2>
                  <p className="text-[10px] uppercase" style={{ color: `${C.gray}70` }}>
                    Rojo = recibido · Gris = proyectado según calendarios activos
                  </p>
                </div>
                {cashFlowData.length === 0 ? (
                  <div className="py-20 text-center text-xs uppercase" style={{ color: C.gray }}>
                    Sin datos de cuotas aún
                  </div>
                ) : (
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={cashFlowData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${C.gray}20`} />
                        <XAxis dataKey="mes" tick={{ fill: C.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => fmtK(v)} tick={{ fill: C.gray, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: C.bgS, border: `1px solid ${C.gray}30`, borderRadius: 4 }}
                          labelStyle={{ color: C.cream, fontSize: 10, textTransform: 'uppercase' }}
                          formatter={(v: any, name: string) => [fmtK(v), name === 'recibido' ? 'Recibido' : 'Proyectado']}
                        />
                        <Legend formatter={v => <span style={{ color: C.gray, fontSize: 10, textTransform: 'uppercase' }}>{v === 'recibido' ? 'Recibido' : 'Proyectado'}</span>} />
                        <Bar dataKey="recibido"   fill={C.red}          radius={[2,2,0,0]} maxBarSize={48} />
                        <Bar dataKey="proyectado" fill={`${C.gray}50`}  radius={[2,2,0,0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Monthly summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <p className="text-[9px] uppercase mb-1" style={{ color: C.gray }}>Total recibido</p>
                    <p className="text-xl font-black" style={{ color: C.green }}>{fmtM(kpis.totalReceived)}</p>
                  </div>
                  <div className="p-4" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <p className="text-[9px] uppercase mb-1" style={{ color: C.gray }}>Total proyectado</p>
                    <p className="text-xl font-black" style={{ color: C.gray }}>{fmtM(kpis.totalPending)}</p>
                  </div>
                  <div className="p-4" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <p className="text-[9px] uppercase mb-1" style={{ color: C.gray }}>Total SOLSTICE 2026</p>
                    <p className="text-xl font-black" style={{ color: C.red }}>{fmtM(kpis.totalReceived + kpis.totalPending)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── COMISIONES ── */}
            {tab === 'comisiones' && (
              <div className="space-y-6">
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Gestión de comisiones</h2>
                <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                  <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                    style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                    <div className="col-span-3">Vendedor</div>
                    <div className="col-span-2 text-right">Ganada</div>
                    <div className="col-span-2 text-right">Pagada</div>
                    <div className="col-span-2 text-right">Saldo</div>
                    <div className="col-span-3 text-right">Acción</div>
                  </div>
                  {sellerCommissions.length === 0 && (
                    <div className="py-10 text-center text-xs uppercase" style={{ color: C.gray }}>
                      Sin comisiones generadas aún
                    </div>
                  )}
                  {sellerCommissions.map(sl => (
                    <div key={sl.id} className="grid grid-cols-12 px-5 py-4 items-center"
                      style={{ borderBottom: `1px solid ${C.gray}08` }}>
                      <div className="col-span-3">
                        <p className="text-xs font-bold uppercase truncate">{sl.name}</p>
                        <p className="text-[9px]" style={{ color: C.gray }}>{sl.university} · {sl.regsCount} reservas</p>
                      </div>
                      <div className="col-span-2 text-right text-xs font-bold" style={{ color: C.green }}>{fmtK(sl.earned)}</div>
                      <div className="col-span-2 text-right text-xs" style={{ color: C.gray }}>{fmtK(sl.paid)}</div>
                      <div className="col-span-2 text-right text-xs font-black"
                        style={{ color: sl.balance > 0 ? C.red : C.green }}>
                        {sl.balance > 0 ? `-${fmtK(sl.balance)}` : '✓'}
                      </div>
                      <div className="col-span-3 flex justify-end">
                        {sl.balance > 0 && (
                          <button onClick={() => { setComModal(sl as any); setComAmount(String(Math.round(sl.balance))); }}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-[9px] uppercase font-black tracking-widest transition-all"
                            style={{ border: `1px solid ${C.green}40`, color: C.green }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.green}15`; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                            <Send size={10} /> Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Historial de pagos de comisión */}
                {payouts.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-[10px] uppercase tracking-widest" style={{ color: C.gray }}>Historial de pagos</h3>
                    <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                      {payouts.slice(0, 10).map(p => {
                        const sl = sellers.find(s => s.user_id === p.seller_user_id);
                        return (
                          <div key={p.id} className="flex items-center justify-between px-5 py-3"
                            style={{ borderBottom: `1px solid ${C.gray}08` }}>
                            <div>
                              <p className="text-xs font-bold uppercase">{sl?.name || '—'}</p>
                              <p className="text-[9px]" style={{ color: C.gray }}>
                                {new Date(p.paid_at).toLocaleDateString('es-CO', { dateStyle: 'medium' })} · {p.method}
                              </p>
                            </div>
                            <p className="text-sm font-black" style={{ color: C.green }}>{fmt(p.amount)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── EXPORTAR ── */}
            {tab === 'exportar' && (
              <div className="space-y-4">
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Exportaciones</h2>
                <p className="text-[10px] uppercase" style={{ color: `${C.gray}60` }}>
                  Todos los archivos son exclusivos de SOLSTICE — no incluyen datos de Midnight.
                </p>
                <div className="space-y-3 max-w-md">
                  {[
                    { label: 'Todas las transacciones', sub: 'Registros con estado, pagos y vendedor', fn: exportTransactions },
                    { label: 'Morosos',                  sub: 'Compradores con cuotas vencidas',       fn: exportMorosos },
                    { label: 'Comisiones por vendedor',  sub: 'Ganado, pagado y saldo pendiente',      fn: exportCommissions },
                    { label: 'Cuotas pendientes',        sub: 'Calendario completo de cobros futuros', fn: exportSchedules },
                  ].map(({ label, sub, fn }) => (
                    <button key={label} onClick={fn}
                      className="w-full flex items-center justify-between px-6 py-4 text-left transition-all group"
                      style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = `${C.gray}15`)}>
                      <div>
                        <p className="text-xs uppercase font-bold" style={{ letterSpacing: '0.1em' }}>{label}</p>
                        <p className="text-[9px] mt-0.5 uppercase" style={{ color: C.gray }}>{sub}</p>
                      </div>
                      <Download size={14} style={{ color: C.red }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Commission payment modal ── */}
      <AnimatePresence>
        {comModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
              onClick={() => setComModal(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
              style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
                  Registrar pago de comisión
                </h3>
                <button onClick={() => setComModal(null)} style={{ color: C.gray }}><X size={18} /></button>
              </div>
              <p className="text-xs uppercase font-bold" style={{ color: C.red }}>{comModal.name}</p>

              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Monto (COP)</label>
                  <input type="number" value={comAmount} onChange={e => setComAmount(e.target.value)}
                    className="px-3 py-2.5 text-xs outline-none"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Método</label>
                  <select value={comMethod} onChange={e => setComMethod(e.target.value)}
                    className="px-3 py-2.5 text-xs outline-none"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                    <option value="transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="mixed">Mixto</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Notas (opcional)</label>
                  <input type="text" value={comNotes} onChange={e => setComNotes(e.target.value)}
                    placeholder="ej. Transferencia Nequi"
                    className="px-3 py-2.5 text-xs outline-none"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }} />
                </div>
              </div>

              <button onClick={payCommission} disabled={comLoading || !comAmount}
                className="w-full py-3 text-xs uppercase font-black tracking-widest flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: C.green, color: '#000' }}>
                {comLoading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Registrar pago</>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
