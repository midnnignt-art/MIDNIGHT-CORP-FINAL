import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Share2, Check, Users, ChevronDown, ChevronUp,
  AlertTriangle, Banknote, Download, Loader2, CheckCircle2,
  Clock, X, Globe, BarChart2, UserCheck, Trophy, Calendar,
  Building2, Layers, User,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';

const C = {
  bg: '#000', bgS: '#0d0d0d', bgT: '#111',
  red: '#E6392F', gray: '#606060', cream: '#F9F2D7',
  green: '#10b981', yellow: '#f59e0b', blue: '#3b82f6',
};

type AdminTab   = 'resumen' | 'squads' | 'sellers' | 'buyers';
type DateFilter = 'today' | 'week' | 'month' | 'all';

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
  created_at: string; schedules?: Schedule[]; seller_name?: string;
}
interface RichSeller {
  user_id: string; name: string; ref_code: string;
  team_id: string | null; team_name: string | null;
  squad_id: string | null; squad_name: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

const DATE_FILTERS: { id: DateFilter; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'week',  label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'all',   label: 'Todo' },
];

function applyDateFilter(regs: Registration[], df: DateFilter): Registration[] {
  if (df === 'all') return regs;
  const now = new Date();
  const cutoff = new Date(now);
  if (df === 'today') { cutoff.setHours(0, 0, 0, 0); }
  else if (df === 'week') { cutoff.setDate(cutoff.getDate() - cutoff.getDay()); cutoff.setHours(0, 0, 0, 0); }
  else { cutoff.setDate(1); cutoff.setHours(0, 0, 0, 0); }
  return regs.filter(r => new Date(r.created_at) >= cutoff);
}

function stats(regs: Registration[], comPct: number) {
  const count      = regs.length;
  const paid       = regs.reduce((a, r) => a + r.amount_paid, 0);
  const organic    = regs.filter(r => !r.seller_id).length;
  const commission = regs.filter(r =>  r.seller_id).length;
  const digital    = regs.filter(r => r.ref_code && r.payment_mode !== 'cash_to_seller').length;
  const cash       = regs.filter(r => r.payment_mode === 'cash_to_seller').length;
  const inMora     = regs.filter(r => r.schedules?.some(s => s.status === 'overdue')).length;
  const com        = paid * comPct;
  const pending    = regs.reduce((a, r) => a + (r.total_amount - r.amount_paid), 0);
  const comPending = pending * comPct;
  return { count, paid, organic, commission, digital, cash, inMora, com, comPending };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function KpiCard({ label, value, sub, color = C.cream, small }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean;
}) {
  return (
    <div className="p-5" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
      <p className="text-[9px] uppercase tracking-[0.25em] mb-2" style={{ color: C.gray }}>{label}</p>
      <p className={`font-black ${small ? 'text-xl' : 'text-2xl'}`} style={{ color }}>{value}</p>
      {sub && <p className="text-[9px] mt-1 uppercase" style={{ color: C.gray }}>{sub}</p>}
    </div>
  );
}

function DateBar({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Calendar size={11} style={{ color: C.gray }} />
      {DATE_FILTERS.map(df => (
        <button key={df.id} onClick={() => onChange(df.id)}
          className="px-3 py-1 text-[9px] uppercase font-black tracking-widest transition-all"
          style={{
            background: value === df.id ? C.red : 'transparent',
            color:      value === df.id ? C.cream : C.gray,
            border:     `1px solid ${value === df.id ? C.red : C.gray + '30'}`,
          }}>
          {df.label}
        </button>
      ))}
    </div>
  );
}

// ── Buyer row (shared) ────────────────────────────────────────────────────────

function BuyerRow({
  reg, expanded, onToggle, onCash, showSeller,
}: {
  reg: Registration; expanded: boolean; onToggle: () => void;
  onCash: (r: Registration) => void; showSeller?: boolean;
}) {
  const next      = reg.schedules?.find(s => s.status === 'pending' || s.status === 'overdue');
  const hasOverdue = reg.schedules?.some(s => s.status === 'overdue');

  return (
    <div style={{ borderBottom: `1px solid ${C.gray}08` }}>
      <div
        className="grid px-5 py-4 items-center cursor-pointer hover:bg-white/3 transition-colors"
        style={{ gridTemplateColumns: showSeller ? '3fr 2fr 1fr 2fr 2fr 2fr 0.5fr' : '3fr 2fr 2fr 2fr 2fr 0.5fr' }}
        onClick={onToggle}
      >
        <div>
          <div className="flex items-center gap-2">
            {hasOverdue && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.red }} />}
            <div>
              <p className="text-xs font-bold uppercase truncate">{reg.customer_name}</p>
              <p className="text-[9px] truncate" style={{ color: C.gray }}>{reg.customer_university}</p>
            </div>
          </div>
        </div>
        {showSeller && (
          <div className="text-[9px]" style={{ color: reg.seller_name ? C.cream : C.blue }}>
            {reg.seller_name || 'Orgánico'}
          </div>
        )}
        <div>
          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-sm"
            style={{
              background: reg.payment_mode === 'cash_to_seller' ? `${C.yellow}18` : `${C.green}18`,
              color:      reg.payment_mode === 'cash_to_seller' ? C.yellow : C.green,
            }}>
            {reg.payment_mode === 'cash_to_seller' ? 'Ef' : 'Dig'}
          </span>
        </div>
        <div><StatusBadge status={reg.status} /></div>
        <div>
          <p className="text-xs font-bold">{fmtK(reg.amount_paid)}</p>
          <p className="text-[9px]" style={{ color: C.gray }}>de {fmtK(reg.total_amount)}</p>
        </div>
        <div>
          {next ? (
            <div>
              <p className="text-xs font-bold" style={{ color: hasOverdue ? C.red : C.cream }}>{fmtK(next.amount)}</p>
              <p className="text-[9px]" style={{ color: hasOverdue ? C.red : C.gray }}>
                {hasOverdue ? '⚠ Vencida' : new Date(next.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
              </p>
            </div>
          ) : <span className="text-[9px]" style={{ color: C.green }}>Al día ✓</span>}
        </div>
        <div className="flex justify-end">
          {expanded ? <ChevronUp size={13} style={{ color: C.red }} /> : <ChevronDown size={13} style={{ color: C.gray }} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-2 space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, background: C.bgT }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[['Email', reg.customer_email], ['Teléfono', reg.customer_phone || '—'], ['Orden', reg.order_number], ['Ref', reg.ref_code || '—']].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.2em' }}>{k}</p>
                    <p className="font-mono text-[10px]">{v}</p>
                  </div>
                ))}
              </div>
              {reg.schedules && reg.schedules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reg.schedules.map(sc => (
                    <div key={sc.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px]"
                      style={{
                        background: sc.status === 'paid' ? `${C.green}15` : sc.status === 'overdue' ? `${C.red}15` : `${C.gray}10`,
                        border: `1px solid ${sc.status === 'paid' ? C.green + '30' : sc.status === 'overdue' ? C.red + '30' : C.gray + '20'}`,
                      }}>
                      {sc.status === 'paid' ? <CheckCircle2 size={10} style={{ color: C.green }} />
                        : sc.status === 'overdue' ? <AlertTriangle size={10} style={{ color: C.red }} />
                        : <Clock size={10} style={{ color: C.gray }} />}
                      <span style={{ color: sc.status === 'paid' ? C.green : sc.status === 'overdue' ? C.red : C.gray }}>
                        C{sc.installment_number} · {fmtK(sc.amount)} · {new Date(sc.due_date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {reg.payment_mode === 'cash_to_seller' && next && (
                <button onClick={() => onCash(reg)}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-black tracking-widest transition-all"
                  style={{ background: C.bgS, border: `1px solid ${C.yellow}40`, color: C.yellow }}>
                  <Banknote size={13} /> Marcar cuota {next.installment_number} como recibida · {fmtK(next.amount)}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props { role: 'seller' | 'manager' | 'admin' }

export default function SolsticeVentasDashboard({ role }: Props) {
  const { currentUser, promoters, teams: storeTeams, superSquads: storeSquads } = useStore();
  const isAdmin   = role === 'admin';
  const isSeller  = role === 'seller';
  const isManager = role === 'manager';

  const [season,  setSeason]  = useState<Season | null>(null);
  const [allRegs, setAllRegs] = useState<Registration[]>([]);
  const [sellers, setSellers] = useState<RichSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySeller,     setMySeller]     = useState<RichSeller | null>(null);
  const [teamSellers,  setTeamSellers]  = useState<RichSeller[]>([]);

  // UI state
  const [adminTab,       setAdminTab]       = useState<AdminTab>('resumen');
  const [dateFilter,     setDateFilter]     = useState<DateFilter>('all');
  const [expandedSquad,  setExpandedSquad]  = useState<string | null>(null);
  const [expandedTeam,   setExpandedTeam]   = useState<string | null>(null);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [expandedReg,    setExpandedReg]    = useState<string | null>(null);
  const [sellerFilter,   setSellerFilter]   = useState<string>('all');
  const [linkCopied,     setLinkCopied]     = useState(false);

  // Cash modal
  const [cashModal,    setCashModal]    = useState<Registration | null>(null);
  const [cashSchedule, setCashSchedule] = useState<Schedule | null>(null);
  const [cashLoading,  setCashLoading]  = useState(false);

  const comPct = (season?.commission_pct || 10) / 100;

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data: s } = await supabase.from('solstice_seasons').select('*').eq('status', 'open').single();
      if (s) setSeason(s as Season);

      // Enrich solstice_sellers with profile/team/squad data
      const { data: ss } = await supabase.from('solstice_sellers').select('*');
      const richSellers: RichSeller[] = (ss || []).map((sl: any) => {
        const profile = promoters.find(p => p.user_id === sl.user_id) as any;
        const team    = storeTeams.find(t => t.id === sl.sales_team_id);
        const squad   = storeSquads.find(sq => sq.id === team?.super_squad_id);
        return {
          user_id:    sl.user_id,
          name:       profile?.name || currentUser.name || sl.user_id,
          ref_code:   sl.ref_code || '',
          team_id:    sl.sales_team_id || null,
          team_name:  team?.name || null,
          squad_id:   squad?.id || null,
          squad_name: squad?.name || null,
        };
      });
      setSellers(richSellers);

      const myRich = richSellers.find(sl => sl.user_id === currentUser.user_id) || null;
      setMySeller(myRich);

      // Scope registrations query
      let q = supabase.from('solstice_registrations').select('*').order('created_at', { ascending: false });
      if (isSeller) {
        q = q.eq('seller_id', currentUser.user_id);
      } else if (isManager && myRich?.team_id) {
        const teamMemberIds = richSellers.filter(sl => sl.team_id === myRich.team_id).map(sl => sl.user_id);
        if (teamMemberIds.length) {
          q = q.in('seller_id', teamMemberIds);
          setTeamSellers(richSellers.filter(sl => sl.team_id === myRich.team_id));
        }
      }

      const { data: regs } = await q;
      if (!regs?.length) { setAllRegs([]); setLoading(false); return; }

      // Schedules
      const regIds = regs.map((r: any) => r.id);
      const { data: schedules } = await supabase
        .from('solstice_payment_schedules').select('*')
        .in('registration_id', regIds).order('installment_number');

      const enrichedRegs: Registration[] = regs.map((r: any) => ({
        ...r,
        schedules:   (schedules || []).filter((sc: any) => sc.registration_id === r.id),
        seller_name: richSellers.find(sl => sl.user_id === r.seller_id)?.name || null,
      }));
      setAllRegs(enrichedRegs);
    } catch (err) {
      console.warn('VentasDashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isSeller, isManager, promoters, storeTeams, storeSquads]);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const dateRegs = useMemo(() => applyDateFilter(allRegs, dateFilter), [allRegs, dateFilter]);

  const filteredRegs = useMemo(() => {
    if (sellerFilter === 'all') return dateRegs;
    if (sellerFilter === '__organic__') return dateRegs.filter(r => !r.seller_id);
    return dateRegs.filter(r => r.seller_id === sellerFilter);
  }, [dateRegs, sellerFilter]);

  const globalStats = useMemo(() => stats(dateRegs, comPct), [dateRegs, comPct]);

  // ── Org tree (admin) ───────────────────────────────────────────────────────
  const orgTree = useMemo(() => {
    if (!isAdmin) return null;

    type SellerWithStats = RichSeller & {
      regs: Registration[]; count: number; paid: number;
      digital: number; cash: number; com: number;
    };
    type TeamWithStats = { id: string; name: string; squad_id: string | null; sellers: SellerWithStats[]; count: number; paid: number; };
    type SquadWithStats = { id: string; name: string; teams: TeamWithStats[]; count: number; paid: number; };

    const sellerNodes: SellerWithStats[] = sellers.map(sl => {
      const regs    = dateRegs.filter(r => r.seller_id === sl.user_id);
      const paid    = regs.reduce((a, r) => a + r.amount_paid, 0);
      const digital = regs.filter(r => r.ref_code && r.payment_mode !== 'cash_to_seller').length;
      const cash    = regs.filter(r => r.payment_mode === 'cash_to_seller').length;
      return { ...sl, regs, count: regs.length, paid, digital, cash, com: paid * comPct };
    });

    const teamNodes: TeamWithStats[] = storeTeams.map(t => {
      const tSellers = sellerNodes.filter(s => s.team_id === t.id);
      const count = tSellers.reduce((a, s) => a + s.count, 0);
      const paid  = tSellers.reduce((a, s) => a + s.paid, 0);
      return { id: t.id, name: t.name, squad_id: t.super_squad_id || null, sellers: tSellers, count, paid };
    });

    const squadNodes: SquadWithStats[] = storeSquads.map(sq => {
      const sqTeams = teamNodes.filter(t => t.squad_id === sq.id);
      const count = sqTeams.reduce((a, t) => a + t.count, 0);
      const paid  = sqTeams.reduce((a, t) => a + t.paid, 0);
      return { id: sq.id, name: sq.name, teams: sqTeams, count, paid };
    });

    const noSquadTeams = teamNodes.filter(t => !t.squad_id || !storeSquads.find(sq => sq.id === t.squad_id));
    const organicRegs  = dateRegs.filter(r => !r.seller_id);

    return { squadNodes, noSquadTeams, organicRegs, sellerNodes };
  }, [isAdmin, sellers, dateRegs, comPct, storeTeams, storeSquads]);

  // ── Cash modal ─────────────────────────────────────────────────────────────
  const openCashModal = (reg: Registration) => {
    setCashSchedule(reg.schedules?.find(s => s.status === 'pending' || s.status === 'overdue') || null);
    setCashModal(reg);
  };

  const confirmCashPayment = async () => {
    if (!cashModal || !cashSchedule || !currentUser) return;
    setCashLoading(true);
    try {
      const { data: payment, error: pe } = await supabase.from('solstice_payments').insert({
        registration_id: cashModal.id, amount: cashSchedule.amount,
        method: 'cash', status: 'completed',
        confirmed_by: currentUser.user_id, paid_at: new Date().toISOString(),
      }).select().single();
      if (pe) throw new Error(pe.message);
      await supabase.from('solstice_payment_schedules')
        .update({ status: 'paid', payment_id: payment.id }).eq('id', cashSchedule.id);
      const newPaid    = cashModal.amount_paid + cashSchedule.amount;
      const remaining  = cashModal.installments_remaining - 1;
      await supabase.from('solstice_registrations').update({
        amount_paid: newPaid, installments_remaining: Math.max(remaining, 0),
        status: remaining <= 0 ? 'completed' : 'active',
      }).eq('id', cashModal.id);
      toast.success(`Cuota ${cashSchedule.installment_number} marcada como recibida`);
      setCashModal(null); setCashSchedule(null); load();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    finally { setCashLoading(false); }
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const exportCsv = (regs: Registration[]) => {
    const header = ['Orden', 'Nombre', 'Email', 'Universidad', 'Modalidad', 'Estado', 'Total', 'Pagado', 'Pendiente', 'Vendedor', 'Canal', 'Orgánico', 'Fecha'];
    const rows = regs.map(r => [
      r.order_number, r.customer_name, r.customer_email, r.customer_university,
      r.payment_mode, r.status, r.total_amount, r.amount_paid, r.total_amount - r.amount_paid,
      r.seller_name || 'Orgánico',
      r.payment_mode === 'cash_to_seller' ? 'Efectivo' : 'Digital',
      r.seller_id ? 'No' : 'Sí',
      new Date(r.created_at).toLocaleDateString('es-CO'),
    ]);
    const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solstice-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast.success('CSV exportado');
  };

  // ── Link ───────────────────────────────────────────────────────────────────
  const referralLink = mySeller?.ref_code ? `https://midnightcorp.click/solstice?ref=${mySeller.ref_code}` : '';
  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Link copiado');
  };
  const shareWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`¡Reserva tu semana SOLSTICE 2026! ${referralLink}`)}`, '_blank');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ADMIN — Command Center
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isAdmin) {
    const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
      { id: 'resumen',  label: 'Resumen',    icon: <BarChart2 size={12} /> },
      { id: 'squads',   label: 'Squads',      icon: <Layers size={12} />    },
      { id: 'sellers',  label: 'Vendedores',  icon: <Users size={12} />     },
      { id: 'buyers',   label: 'Compradores', icon: <UserCheck size={12} /> },
    ];

    return (
      <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

        {/* Header + Tabs */}
        <div className="px-6 md:px-8 pt-8 pb-0" style={{ borderBottom: `1px solid ${C.gray}15` }}>
          <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>Solstice 2026</p>
          <h1 className="text-3xl uppercase mb-5" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
            Command Center
          </h1>
          <div className="flex gap-0 -mb-px">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setAdminTab(tab.id)}
                className="flex items-center gap-2 px-5 py-3 text-[10px] uppercase font-black tracking-widest transition-all"
                style={{
                  borderBottom: adminTab === tab.id ? `2px solid ${C.red}` : '2px solid transparent',
                  color: adminTab === tab.id ? C.red : C.gray,
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 md:px-8 py-8 space-y-8 max-w-7xl">

          {/* Date + Export bar */}
          <div className="flex items-center gap-4 flex-wrap">
            <DateBar value={dateFilter} onChange={setDateFilter} />
            <button onClick={() => exportCsv(dateRegs)}
              className="ml-auto flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-widest transition-all"
              style={{ border: `1px solid ${C.gray}20`, color: C.gray }}
              onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
              onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
              <Download size={11} /> CSV
            </button>
          </div>

          {/* ═══ RESUMEN ═══════════════════════════════════════════════════════ */}
          {adminTab === 'resumen' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total reservas"  value={String(globalStats.count)}
                  sub={`${globalStats.organic} orgánico · ${globalStats.commission} comisión`} />
                <KpiCard label="Pagado"           value={fmtK(globalStats.paid)}  sub="acumulado" color={C.red} />
                <KpiCard label="Orgánico"         value={String(globalStats.organic)}
                  sub={fmtK(dateRegs.filter(r=>!r.seller_id).reduce((a,r)=>a+r.amount_paid,0))} color={C.blue} />
                <KpiCard label="Con comisión"     value={String(globalStats.commission)}
                  sub={`${sellers.length} vendedores activos`} color={C.green} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Digital (link)"  value={String(globalStats.digital)}  sub="via ?ref=" color={C.green} small />
                <KpiCard label="Efectivo"         value={String(globalStats.cash)}     sub="cobro directo" color={C.yellow} small />
                <KpiCard label="En mora"          value={String(globalStats.inMora)}   sub="compradores" color={globalStats.inMora ? C.red : C.gray} small />
                <KpiCard label="Comisión total"   value={fmtK(globalStats.com)}        sub={`${season?.commission_pct||10}%`} color={C.yellow} small />
              </div>

              {/* Acquisition channel bars */}
              {globalStats.count > 0 && (
                <div className="p-5 space-y-4" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Canal de adquisición</p>
                  {[
                    { label: 'Orgánico',  n: globalStats.organic,    color: C.blue,   total: globalStats.count },
                    { label: 'Comisión',  n: globalStats.commission,  color: C.green,  total: globalStats.count },
                    { label: 'Digital',   n: globalStats.digital,     color: '#22d3ee',total: globalStats.count },
                    { label: 'Efectivo',  n: globalStats.cash,        color: C.yellow, total: globalStats.count },
                  ].map(row => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex justify-between text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                        <span>{row.label}</span>
                        <span><span style={{ color: C.cream }}>{row.n}</span> / {row.total}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: `${C.gray}20` }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: row.total ? `${(row.n / row.total) * 100}%` : '0%', background: row.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top 5 sellers */}
              {sellers.length > 0 && (() => {
                const top5 = sellers.map(sl => {
                  const regs = dateRegs.filter(r => r.seller_id === sl.user_id);
                  return { ...sl, count: regs.length, paid: regs.reduce((a,r)=>a+r.amount_paid,0) };
                }).sort((a, b) => b.count - a.count).filter(sl => sl.count > 0).slice(0, 5);
                if (!top5.length) return null;
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Trophy size={12} style={{ color: C.yellow }} />
                      <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Top vendedores</p>
                    </div>
                    <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                      {top5.map((sl, i) => (
                        <div key={sl.user_id} className="flex items-center gap-4 px-5 py-3"
                          style={{ borderBottom: i < top5.length - 1 ? `1px solid ${C.gray}08` : 'none' }}>
                          <span className="text-xs font-black w-5"
                            style={{ color: i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':C.gray }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase truncate">{sl.name}</p>
                            <p className="text-[9px]" style={{ color: C.gray }}>
                              {[sl.squad_name, sl.team_name].filter(Boolean).join(' · ') || 'Sin equipo'}
                            </p>
                          </div>
                          <span className="text-sm font-black" style={{ color: C.red }}>{sl.count}</span>
                          <span className="text-xs" style={{ color: C.green }}>{fmtK(sl.paid)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ═══ SQUADS ════════════════════════════════════════════════════════ */}
          {adminTab === 'squads' && orgTree && (
            <div className="space-y-3">
              {/* Organic block */}
              {orgTree.organicRegs.length > 0 && (
                <div className="flex items-center justify-between px-5 py-4"
                  style={{ background: C.bgS, border: `1px solid ${C.blue}30` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: C.blue }} />
                    <p className="text-xs uppercase font-black tracking-wider" style={{ color: C.blue }}>
                      Orgánico — sin vendedor
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <span><span style={{ color: C.cream }}>{orgTree.organicRegs.length}</span> <span style={{ color: C.gray }}>reservas</span></span>
                    <span style={{ color: C.green }}>{fmtK(orgTree.organicRegs.reduce((a,r)=>a+r.amount_paid,0))}</span>
                  </div>
                </div>
              )}

              {orgTree.squadNodes.map(sq => (
                <div key={sq.id} style={{ border: `1px solid ${C.gray}20` }}>
                  {/* Squad header */}
                  <button className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/3"
                    onClick={() => setExpandedSquad(v => v === sq.id ? null : sq.id)}>
                    <Layers size={14} style={{ color: C.gray }} />
                    <div className="flex-1">
                      <p className="text-sm uppercase font-black" style={{ letterSpacing: '0.12em' }}>{sq.name}</p>
                      <p className="text-[9px] uppercase mt-0.5" style={{ color: C.gray }}>
                        {sq.teams.length} equipo{sq.teams.length !== 1 ? 's' : ''} · {sq.teams.reduce((a,t)=>a+t.sellers.length,0)} vendedores en Solstice
                      </p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-sm font-black" style={{ color: C.red }}>{sq.count}</p>
                        <p className="text-[9px]" style={{ color: C.gray }}>reservas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black" style={{ color: C.green }}>{fmtK(sq.paid)}</p>
                        <p className="text-[9px]" style={{ color: C.gray }}>pagado</p>
                      </div>
                      {expandedSquad === sq.id
                        ? <ChevronUp size={14} style={{ color: C.red }} />
                        : <ChevronDown size={14} style={{ color: C.gray }} />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedSquad === sq.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div style={{ borderTop: `1px solid ${C.gray}12` }}>
                          {sq.teams.map(team => (
                            <div key={team.id} style={{ borderBottom: `1px solid ${C.gray}08` }}>
                              {/* Team row */}
                              <button className="w-full flex items-center gap-3 pl-10 pr-5 py-3 text-left transition-colors hover:bg-white/3"
                                onClick={() => setExpandedTeam(v => v === team.id ? null : team.id)}>
                                <Building2 size={12} style={{ color: C.gray }} />
                                <div className="flex-1">
                                  <p className="text-xs uppercase font-bold">{team.name}</p>
                                  <p className="text-[9px]" style={{ color: C.gray }}>{team.sellers.length} vendedores</p>
                                </div>
                                <div className="flex items-center gap-5">
                                  <span className="text-xs font-black" style={{ color: C.red }}>{team.count}</span>
                                  <span className="text-xs" style={{ color: C.green }}>{fmtK(team.paid)}</span>
                                  {expandedTeam === team.id
                                    ? <ChevronUp size={12} style={{ color: C.red }} />
                                    : <ChevronDown size={12} style={{ color: C.gray }} />}
                                </div>
                              </button>

                              <AnimatePresence>
                                {expandedTeam === team.id && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                    {team.sellers.length === 0 ? (
                                      <p className="pl-16 py-3 text-[9px] uppercase" style={{ color: C.gray }}>Sin vendedores en Solstice</p>
                                    ) : team.sellers.map(sl => (
                                      <div key={sl.user_id} style={{ borderTop: `1px solid ${C.gray}08`, background: C.bgT }}>
                                        <button className="w-full flex items-center gap-3 pl-16 pr-5 py-2.5 text-left transition-colors hover:bg-white/3"
                                          onClick={() => setExpandedSeller(v => v === sl.user_id ? null : sl.user_id)}>
                                          <User size={11} style={{ color: C.gray }} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold uppercase truncate">{sl.name}</p>
                                            <p className="text-[9px] font-mono" style={{ color: C.gray }}>{sl.ref_code}</p>
                                          </div>
                                          <div className="flex items-center gap-4 text-xs">
                                            <span style={{ color: C.red }}>{sl.count}</span>
                                            <span style={{ color: C.green }}>{fmtK(sl.paid)}</span>
                                            <span style={{ color: C.gray }}>{sl.digital}D · {sl.cash}E</span>
                                          </div>
                                        </button>
                                        {expandedSeller === sl.user_id && (
                                          <div className="pl-16 pr-5 pb-3 pt-1 space-y-1.5">
                                            {sl.regs.length === 0
                                              ? <p className="text-[9px] uppercase" style={{ color: C.gray }}>Sin compras en este período</p>
                                              : sl.regs.map(r => (
                                                <div key={r.id} className="flex items-center gap-3 px-3 py-2"
                                                  style={{ background: C.bgS, border: `1px solid ${C.gray}10` }}>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold uppercase truncate">{r.customer_name}</p>
                                                    <p className="text-[9px]" style={{ color: C.gray }}>{r.customer_university}</p>
                                                  </div>
                                                  <StatusBadge status={r.status} />
                                                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm uppercase"
                                                    style={{ background: r.payment_mode==='cash_to_seller'?`${C.yellow}18`:`${C.green}18`, color: r.payment_mode==='cash_to_seller'?C.yellow:C.green }}>
                                                    {r.payment_mode==='cash_to_seller'?'Ef':'Dig'}
                                                  </span>
                                                  <span className="text-[10px]" style={{ color: C.green }}>{fmtK(r.amount_paid)}</span>
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {orgTree.noSquadTeams.length > 0 && (
                <div style={{ border: `1px solid ${C.gray}15` }}>
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Equipos sin squad</p>
                    <div className="flex gap-5 text-xs">
                      <span style={{ color: C.red }}>{orgTree.noSquadTeams.reduce((a,t)=>a+t.count,0)}</span>
                      <span style={{ color: C.green }}>{fmtK(orgTree.noSquadTeams.reduce((a,t)=>a+t.paid,0))}</span>
                    </div>
                  </div>
                  {orgTree.noSquadTeams.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-2"
                      style={{ borderTop: `1px solid ${C.gray}08` }}>
                      <Building2 size={11} style={{ color: C.gray }} />
                      <p className="text-xs flex-1 uppercase">{t.name}</p>
                      <span className="text-xs" style={{ color: C.red }}>{t.count}</span>
                      <span className="text-xs" style={{ color: C.green }}>{fmtK(t.paid)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ SELLERS ═══════════════════════════════════════════════════════ */}
          {adminTab === 'sellers' && (
            <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                <div className="col-span-3">Vendedor</div>
                <div className="col-span-2">Squad · Equipo</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1 text-right">Dig</div>
                <div className="col-span-1 text-right">Ef</div>
                <div className="col-span-2 text-right">Pagado</div>
                <div className="col-span-2 text-right">Comisión</div>
              </div>
              {sellers
                .map(sl => {
                  const regs = dateRegs.filter(r => r.seller_id === sl.user_id);
                  const paid = regs.reduce((a,r)=>a+r.amount_paid,0);
                  return { ...sl, regs, count: regs.length, paid,
                    dig:  regs.filter(r=>r.ref_code&&r.payment_mode!=='cash_to_seller').length,
                    cash: regs.filter(r=>r.payment_mode==='cash_to_seller').length,
                    com:  paid * comPct,
                  };
                })
                .sort((a, b) => b.count - a.count)
                .map((sl, idx) => (
                  <div key={sl.user_id}>
                    <button
                      className="w-full grid grid-cols-12 px-5 py-3 items-center text-left transition-colors hover:bg-white/3"
                      style={{ borderBottom: `1px solid ${C.gray}08`, background: expandedSeller===sl.user_id?`${C.red}06`:'transparent' }}
                      onClick={() => setExpandedSeller(v => v===sl.user_id ? null : sl.user_id)}>
                      <div className="col-span-3 flex items-center gap-2">
                        {idx < 3 && <span style={{ color: ['#FFD700','#C0C0C0','#CD7F32'][idx], fontSize: 11 }}>★</span>}
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase truncate"
                            style={{ color: expandedSeller===sl.user_id ? C.red : C.cream }}>{sl.name}</p>
                          <p className="text-[9px] font-mono" style={{ color: C.gray }}>{sl.ref_code}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-[9px]" style={{ color: C.gray }}>
                        {sl.squad_name && <p className="truncate">{sl.squad_name}</p>}
                        {sl.team_name  && <p className="truncate">{sl.team_name}</p>}
                      </div>
                      <div className="col-span-1 text-right text-sm font-black" style={{ color: C.red }}>{sl.count}</div>
                      <div className="col-span-1 text-right text-xs" style={{ color: C.green }}>{sl.dig}</div>
                      <div className="col-span-1 text-right text-xs" style={{ color: C.yellow }}>{sl.cash}</div>
                      <div className="col-span-2 text-right text-xs">{fmtK(sl.paid)}</div>
                      <div className="col-span-2 text-right text-xs" style={{ color: C.yellow }}>{fmtK(sl.com)}</div>
                    </button>
                    <AnimatePresence>
                      {expandedSeller === sl.user_id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-5 pb-3 pt-1 space-y-1.5" style={{ background: C.bgT }}>
                            {sl.regs.length === 0
                              ? <p className="text-[9px] uppercase py-2" style={{ color: C.gray }}>Sin compras en este período</p>
                              : sl.regs.map(r => (
                                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5"
                                  style={{ background: C.bgS, border: `1px solid ${C.gray}10` }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase truncate">{r.customer_name}</p>
                                    <p className="text-[9px]" style={{ color: C.gray }}>{r.customer_university} · {r.order_number}</p>
                                  </div>
                                  <StatusBadge status={r.status} />
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-sm"
                                    style={{ background: r.payment_mode==='cash_to_seller'?`${C.yellow}15`:`${C.green}15`, color: r.payment_mode==='cash_to_seller'?C.yellow:C.green }}>
                                    {r.payment_mode==='cash_to_seller'?'Ef':'Dig'}
                                  </span>
                                  <span className="text-[10px]" style={{ color: C.green }}>{fmtK(r.amount_paid)}</span>
                                  <span className="text-[9px]" style={{ color: C.gray }}>
                                    {new Date(r.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              {sellers.length === 0 && (
                <div className="py-14 text-center">
                  <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Sin vendedores registrados en Solstice</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ BUYERS ════════════════════════════════════════════════════════ */}
          {adminTab === 'buyers' && (
            <div className="space-y-4">
              {/* Filter pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all',        label: 'Todos',    color: C.red  },
                  { id: '__organic__',label: 'Orgánico', color: C.blue },
                ].concat(sellers.slice(0, 10).map(sl => ({ id: sl.user_id, label: sl.name.split(' ')[0], color: C.red }))).map(f => (
                  <button key={f.id} onClick={() => setSellerFilter(f.id)}
                    className="px-3 py-1 text-[9px] uppercase font-black tracking-widest transition-all"
                    style={{
                      background: sellerFilter===f.id ? f.color : 'transparent',
                      color:      sellerFilter===f.id ? C.cream : C.gray,
                      border:     `1px solid ${sellerFilter===f.id ? f.color : C.gray + '30'}`,
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredRegs.length === 0 ? (
                <div className="py-16 text-center" style={{ color: C.gray }}>
                  <UserCheck size={32} className="mx-auto mb-4 opacity-30" />
                  <p className="text-xs uppercase tracking-widest">Sin compradores en este período</p>
                </div>
              ) : (
                <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                  {filteredRegs.map(reg => (
                    <BuyerRow key={reg.id} reg={reg} showSeller
                      expanded={expandedReg === reg.id}
                      onToggle={() => setExpandedReg(v => v === reg.id ? null : reg.id)}
                      onCash={openCashModal}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cash modal */}
        <AnimatePresence>
          {cashModal && cashSchedule && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={() => setCashModal(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
                style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One',sans-serif", letterSpacing: '0.1em' }}>
                    Confirmar pago efectivo
                  </h3>
                  <button onClick={() => setCashModal(null)} style={{ color: C.gray }}><X size={18} /></button>
                </div>
                <div className="space-y-2 p-4" style={{ background: C.bgT, border: `1px solid ${C.gray}15` }}>
                  {[['Comprador', cashModal.customer_name], ['Cuota', String(cashSchedule.installment_number)], ['Monto', fmt(cashSchedule.amount)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em' }}>
                      <span style={{ color: C.gray }}>{k}</span><span>{v}</span>
                    </div>
                  ))}
                </div>
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SELLER / MANAGER VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const myStats = useMemo(() => stats(filteredRegs, comPct), [filteredRegs, comPct]);
  const buyerRegs = useMemo(() => {
    if (sellerFilter === 'all') return dateRegs;
    return dateRegs.filter(r => r.seller_id === sellerFilter);
  }, [dateRegs, sellerFilter]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>
          {isSeller ? 'Mi Dashboard' : 'Dashboard · Gerente'}
        </p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          {isSeller ? 'Mis Ventas' : 'Vista Equipo'}
        </h1>
        {mySeller && (
          <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            {season?.name || 'SOLSTICE 2026'}
            {mySeller.team_name  && ` · ${mySeller.team_name}`}
            {mySeller.squad_name && ` · ${mySeller.squad_name}`}
          </p>
        )}
      </div>

      <div className="px-8 py-8 space-y-10 max-w-5xl">

        <DateBar value={dateFilter} onChange={setDateFilter} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Reservas"   value={String(myStats.count)}      sub={`${myStats.digital} dig · ${myStats.cash} ef`} />
          <KpiCard label="Pagado"     value={fmtK(myStats.paid)}         sub="acumulado" color={C.red} />
          <KpiCard label="Comisión"   value={fmtK(myStats.com)}          sub={`${season?.commission_pct||10}%`} color={C.green} />
          <KpiCard label="Pendiente"  value={fmtK(myStats.comPending)}   sub="cuotas futuras" />
        </div>
        {myStats.inMora > 0 && (
          <div className="flex items-center gap-3 px-5 py-3" style={{ background: `${C.red}12`, border: `1px solid ${C.red}30` }}>
            <AlertTriangle size={16} style={{ color: C.red }} />
            <p className="text-xs uppercase font-bold" style={{ color: C.red, letterSpacing: '0.15em' }}>
              {myStats.inMora} comprador{myStats.inMora > 1 ? 'es' : ''} con cuota vencida
            </p>
          </div>
        )}

        {/* Referral link */}
        {mySeller?.ref_code && (
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: C.gray }}>Tu link de referidos</p>
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3" style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
                <Globe size={14} style={{ color: C.red }} />
                <span className="text-xs flex-1 truncate font-mono">{referralLink}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={copyLink}
                  className="flex items-center gap-2 px-5 py-3 text-xs uppercase font-black tracking-widest"
                  style={{ background: linkCopied ? C.green : C.red, color: C.cream }}>
                  {linkCopied ? <Check size={13} /> : <Copy size={13} />} {linkCopied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={shareWhatsApp}
                  className="flex items-center gap-2 px-5 py-3 text-xs uppercase font-black tracking-widest"
                  style={{ background: C.bgS, border: `1px solid ${C.gray}20`, color: C.cream }}>
                  <Share2 size={13} /> WA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manager: team table */}
        {isManager && teamSellers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Mi equipo</p>
              <button onClick={() => exportCsv(allRegs)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest px-4 py-2"
                style={{ border: `1px solid ${C.gray}20`, color: C.gray }}>
                <Download size={12} /> CSV
              </button>
            </div>
            <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase tracking-widest"
                style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                <div className="col-span-4">Vendedor</div>
                <div className="col-span-2 text-right">Reservas</div>
                <div className="col-span-2 text-right">Dig · Ef</div>
                <div className="col-span-2 text-right">Pagado</div>
                <div className="col-span-2 text-right">Comisión</div>
              </div>
              {teamSellers.map(sl => {
                const slRegs = dateRegs.filter(r => r.seller_id === sl.user_id);
                const slPaid = slRegs.reduce((a,r)=>a+r.amount_paid,0);
                return (
                  <button key={sl.user_id} onClick={() => setSellerFilter(v => v===sl.user_id?'all':sl.user_id)}
                    className="w-full grid grid-cols-12 px-5 py-3 items-center text-left hover:bg-white/3 transition-colors"
                    style={{ borderBottom: `1px solid ${C.gray}08`, background: sellerFilter===sl.user_id?`${C.red}08`:'transparent' }}>
                    <div className="col-span-4">
                      <p className="text-xs font-bold uppercase truncate" style={{ color: sellerFilter===sl.user_id?C.red:C.cream }}>{sl.name}</p>
                      <p className="text-[9px] font-mono" style={{ color: C.gray }}>{sl.ref_code}</p>
                    </div>
                    <div className="col-span-2 text-right text-xs font-black">{slRegs.length}</div>
                    <div className="col-span-2 text-right text-xs" style={{ color: C.gray }}>
                      {slRegs.filter(r=>r.ref_code&&r.payment_mode!=='cash_to_seller').length} · {slRegs.filter(r=>r.payment_mode==='cash_to_seller').length}
                    </div>
                    <div className="col-span-2 text-right text-xs">{fmtK(slPaid)}</div>
                    <div className="col-span-2 text-right text-xs" style={{ color: C.green }}>{fmtK(slPaid*comPct)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Buyer table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>
              {sellerFilter==='all' ? 'Mis compradores' : `Compradores de ${teamSellers.find(s=>s.user_id===sellerFilter)?.name||'vendedor'}`}
              <span className="ml-2" style={{ color: C.red }}>({buyerRegs.length})</span>
            </p>
            {isSeller && (
              <button onClick={() => exportCsv(allRegs)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest px-4 py-2"
                style={{ border: `1px solid ${C.gray}20`, color: C.gray }}>
                <Download size={12} /> CSV
              </button>
            )}
          </div>
          {buyerRegs.length === 0 ? (
            <div className="py-16 text-center" style={{ color: C.gray }}>
              <UserCheck size={32} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs uppercase tracking-widest">Sin compradores aún</p>
            </div>
          ) : (
            <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
              {buyerRegs.map(reg => (
                <BuyerRow key={reg.id} reg={reg}
                  expanded={expandedReg === reg.id}
                  onToggle={() => setExpandedReg(v => v===reg.id?null:reg.id)}
                  onCash={openCashModal}
                />
              ))}
            </div>
          )}
        </div>

        {/* Channel split */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 space-y-3" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
            <div className="flex items-center gap-2"><Globe size={14} style={{ color: C.green }} />
              <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Digital</p></div>
            <p className="text-3xl font-black" style={{ color: C.green }}>{myStats.digital}</p>
            <div className="h-1 rounded-full" style={{ background: `${C.gray}20` }}>
              <div className="h-full rounded-full" style={{ width: myStats.count ? `${(myStats.digital/myStats.count)*100}%` : '0%', background: C.green }} />
            </div>
          </div>
          <div className="p-5 space-y-3" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
            <div className="flex items-center gap-2"><Banknote size={14} style={{ color: C.yellow }} />
              <p className="text-[9px] uppercase tracking-widest" style={{ color: C.gray }}>Efectivo</p></div>
            <p className="text-3xl font-black" style={{ color: C.yellow }}>{myStats.cash}</p>
            <div className="h-1 rounded-full" style={{ background: `${C.gray}20` }}>
              <div className="h-full rounded-full" style={{ width: myStats.count ? `${(myStats.cash/myStats.count)*100}%` : '0%', background: C.yellow }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cash modal */}
      <AnimatePresence>
        {cashModal && cashSchedule && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={() => setCashModal(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
              style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One',sans-serif", letterSpacing: '0.1em' }}>
                  Confirmar pago efectivo
                </h3>
                <button onClick={() => setCashModal(null)} style={{ color: C.gray }}><X size={18} /></button>
              </div>
              <div className="space-y-2 p-4" style={{ background: C.bgT, border: `1px solid ${C.gray}15` }}>
                {[['Comprador', cashModal.customer_name], ['Cuota', String(cashSchedule.installment_number)], ['Monto', fmt(cashSchedule.amount)]].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em' }}>
                    <span style={{ color: C.gray }}>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>
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
