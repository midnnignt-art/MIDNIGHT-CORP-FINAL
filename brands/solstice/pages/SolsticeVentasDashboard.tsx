import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Share2, Check, Users, ChevronDown, ChevronUp,
  AlertTriangle, Banknote, Download, Loader2, CheckCircle2,
  Clock, X, Globe, BarChart2, UserCheck, Trophy, Calendar,
  Building2, Layers, User, UserPlus, Mail,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';

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
    <span className="text-[8px] uppercase px-2 py-0.5"
      style={{
        background: `${s.color}20`,
        color: s.color,
        letterSpacing: '0.15em',
        fontWeight: 500,
        borderRadius: '999px',
      }}>
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color = C.cream, small }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      className="p-6"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(32px) saturate(180%)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        boxShadow: hovered ? '0 28px 56px rgba(0,0,0,0.35)' : '0 20px 40px rgba(0,0,0,0.20)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        transition: '0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="text-[9px] uppercase mb-2" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>{label}</p>
      <p className={small ? 'text-xl' : 'text-2xl'} style={{ color, fontWeight: 500 }}>{value}</p>
      {sub && <p className="text-[9px] mt-1 uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>{sub}</p>}
    </div>
  );
}

function DateBar({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Calendar size={11} style={{ color: C.gray }} />
      {DATE_FILTERS.map(df => (
        <button key={df.id} onClick={() => onChange(df.id)}
          className="px-3 py-1 text-[9px] uppercase tracking-widest"
          style={{
            background: value === df.id ? 'rgba(230,57,47,0.20)' : 'transparent',
            color:      value === df.id ? C.cream : C.gray,
            border:     value === df.id ? `0.5px solid rgba(230,57,47,0.35)` : '0.5px solid rgba(96,96,96,0.30)',
            borderRadius: '999px',
            fontWeight: 500,
            padding: '4px 14px',
            transition: 'all 0.3s ease',
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
    <div style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
      <div
        className="grid px-5 py-4 items-center cursor-pointer hover:bg-white/3 transition-colors"
        style={{ gridTemplateColumns: showSeller ? '3fr 2fr 1fr 2fr 2fr 2fr 0.5fr' : '3fr 2fr 2fr 2fr 2fr 0.5fr' }}
        onClick={onToggle}
      >
        <div>
          <div className="flex items-center gap-2">
            {hasOverdue && <span className="w-1.5 h-1.5 shrink-0" style={{ background: C.red, borderRadius: '999px' }} />}
            <div>
              <p className="text-xs uppercase truncate" style={{ fontWeight: 500 }}>{reg.customer_name}</p>
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
          <span className="text-[8px] uppercase px-1.5 py-0.5"
            style={{
              background: reg.payment_mode === 'cash_to_seller' ? `${C.yellow}18` : `${C.green}18`,
              color:      reg.payment_mode === 'cash_to_seller' ? C.yellow : C.green,
              borderRadius: '999px',
            }}>
            {reg.payment_mode === 'cash_to_seller' ? 'Ef' : 'Dig'}
          </span>
        </div>
        <div><StatusBadge status={reg.status} /></div>
        <div>
          <p className="text-xs" style={{ fontWeight: 500 }}>{fmtK(reg.amount_paid)}</p>
          <p className="text-[9px]" style={{ color: C.gray }}>de {fmtK(reg.total_amount)}</p>
        </div>
        <div>
          {next ? (
            <div>
              <p className="text-xs" style={{ color: hasOverdue ? C.red : C.cream, fontWeight: 500 }}>{fmtK(next.amount)}</p>
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
            <div className="px-5 pb-5 pt-2 space-y-4"
              style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', borderRadius: '0 0 20px 20px' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[['Email', reg.customer_email], ['Teléfono', reg.customer_phone || '—'], ['Orden', reg.order_number], ['Ref', reg.ref_code || '—']].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9px] uppercase mb-0.5" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>{k}</p>
                    <p className="font-mono text-[10px]">{v}</p>
                  </div>
                ))}
              </div>
              {reg.schedules && reg.schedules.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reg.schedules.map(sc => (
                    <div key={sc.id} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px]"
                      style={{
                        background: sc.status === 'paid' ? `${C.green}15` : sc.status === 'overdue' ? `${C.red}15` : `${C.gray}10`,
                        border: `0.5px solid ${sc.status === 'paid' ? 'rgba(16,185,129,0.25)' : sc.status === 'overdue' ? 'rgba(230,57,47,0.35)' : 'rgba(96,96,96,0.20)'}`,
                        borderRadius: '999px',
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
                  className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest"
                  style={{
                    background: 'rgba(245,158,11,0.22)',
                    border: '0.5px solid rgba(245,158,11,0.45)',
                    color: C.yellow,
                    borderRadius: '999px',
                    fontWeight: 500,
                    transition: 'all 0.3s ease',
                  }}>
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
  const [recruitOpen,    setRecruitOpen]    = useState(false);
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

      // Enrich solstice_sellers with profile/team/squad data.
      // Sellers ven solo su propia fila — los managers/admins necesitan ver
      // a todos para armar el árbol del equipo.
      let ssQuery = supabase.from('solstice_sellers').select('*');
      if (isSeller) ssQuery = ssQuery.eq('user_id', currentUser.user_id);
      const { data: ss } = await ssQuery;
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
  // Usamos /sol/p/CODE: landing branded con foto + nombre del promotor +
  // CTA "Reservar mi semana". Captura ms_ref_code automáticamente.
  const referralLink = mySeller?.ref_code
    ? `${window.location.origin}/sol/p/${mySeller.ref_code}`
    : '';
  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    toast.success('Link copiado');
  };
  const shareWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`¡Reserva tu semana SOLSTICE 2026! 🌅\n${referralLink}`)}`, '_blank');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  // ── Cash Modal (shared) ────────────────────────────────────────────────────
  const CashModal = () => (
    <AnimatePresence>
      {cashModal && cashSchedule && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={() => setCashModal(null)} />
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
            style={{
              background: 'rgba(8,0,0,0.90)',
              backdropFilter: 'blur(40px) saturate(160%)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '32px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.60)',
            }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base uppercase" style={{ fontFamily: "'Poiret One',sans-serif", letterSpacing: '0.1em', fontWeight: 300 }}>
                Confirmar pago efectivo
              </h3>
              <button onClick={() => setCashModal(null)} style={{ color: C.gray }}><X size={18} /></button>
            </div>
            <div className="space-y-2 p-4" style={{
              background: 'rgba(255,255,255,0.02)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
            }}>
              {[['Comprador', cashModal.customer_name], ['Cuota', String(cashSchedule.installment_number)], ['Monto', fmt(cashSchedule.amount)]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs uppercase" style={{ letterSpacing: '0.1em' }}>
                  <span style={{ color: C.gray }}>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={confirmCashPayment} disabled={cashLoading}
              className="w-full py-4 text-sm uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: 'rgba(245,158,11,0.22)',
                border: '0.5px solid rgba(245,158,11,0.45)',
                color: C.yellow,
                borderRadius: '999px',
                fontWeight: 500,
                transition: 'all 0.3s ease',
              }}>
              {cashLoading ? <Loader2 size={14} className="animate-spin" /> : <><Banknote size={14} /> Confirmar recibo</>}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
        <div className="px-6 md:px-8 pt-8 pb-0" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[9px] uppercase mb-1" style={{ color: C.red, fontWeight: 500, letterSpacing: '0.4em' }}>Solstice 2026</p>
          <h1 className="text-3xl uppercase mb-5" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em', fontWeight: 300 }}>
            Command Center
          </h1>
          <div className="flex gap-0 -mb-px">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setAdminTab(tab.id)}
                className="flex items-center gap-2 px-5 py-3 text-[10px] uppercase tracking-widest"
                style={{
                  borderBottom: adminTab === tab.id ? `2px solid ${C.red}` : '2px solid transparent',
                  color: adminTab === tab.id ? C.red : C.gray,
                  borderRadius: '999px',
                  fontWeight: 500,
                  transition: 'all 0.3s ease',
                }}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 md:px-8 py-8 space-y-8 max-w-7xl">

          {/* Date + Recruit + Export bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <DateBar value={dateFilter} onChange={setDateFilter} />
            <button onClick={() => setRecruitOpen(true)}
              className="ml-auto flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest"
              style={{
                background: 'rgba(230,57,47,0.18)',
                border: '0.5px solid rgba(230,57,47,0.50)',
                color: C.cream,
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
              <UserPlus size={12} /> Reclutar
            </button>
            <button onClick={() => exportCsv(dateRegs)}
              className="flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-widest"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: C.gray,
                borderRadius: '999px',
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
                <div className="p-6 space-y-4" style={{
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(32px) saturate(180%)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
                }}>
                  <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Canal de adquisición</p>
                  {[
                    { label: 'Orgánico',  n: globalStats.organic,    color: C.blue,   total: globalStats.count },
                    { label: 'Comisión',  n: globalStats.commission,  color: C.green,  total: globalStats.count },
                    { label: 'Digital',   n: globalStats.digital,     color: '#22d3ee',total: globalStats.count },
                    { label: 'Efectivo',  n: globalStats.cash,        color: C.yellow, total: globalStats.count },
                  ].map(row => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex justify-between text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                        <span>{row.label}</span>
                        <span><span style={{ color: C.cream }}>{row.n}</span> / {row.total}</span>
                      </div>
                      <div className="h-1" style={{ background: `${C.gray}20`, borderRadius: '999px' }}>
                        <div className="h-full transition-all"
                          style={{ width: row.total ? `${(row.n / row.total) * 100}%` : '0%', background: row.color, borderRadius: '999px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sales Intelligence — gráfico de últimos 30 días */}
              {dateRegs.length > 0 && <SalesIntelChart regs={dateRegs} />}

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
                      <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Top vendedores</p>
                    </div>
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(24px)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '24px',
                      overflow: 'hidden',
                    }}>
                      {top5.map((sl, i) => (
                        <div key={sl.user_id} className="flex items-center gap-4 px-5 py-3"
                          style={{ borderBottom: i < top5.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                          <span className="text-xs w-5"
                            style={{ color: i===0?'#FFD700':i===1?'#C0C0C0':i===2?'#CD7F32':C.gray, fontWeight: 500 }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs uppercase truncate" style={{ fontWeight: 500 }}>{sl.name}</p>
                            <p className="text-[9px]" style={{ color: C.gray }}>
                              {[sl.squad_name, sl.team_name].filter(Boolean).join(' · ') || 'Sin equipo'}
                            </p>
                          </div>
                          <span className="text-sm" style={{ color: C.red, fontWeight: 500 }}>{sl.count}</span>
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
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `0.5px solid rgba(59,130,246,0.30)`,
                    borderRadius: '24px',
                  }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2" style={{ background: C.blue, borderRadius: '999px' }} />
                    <p className="text-xs uppercase" style={{ color: C.blue, fontWeight: 500 }}>
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
                <div key={sq.id} style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                  {/* Squad header */}
                  <button className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/3"
                    onClick={() => setExpandedSquad(v => v === sq.id ? null : sq.id)}>
                    <Layers size={14} style={{ color: C.gray }} />
                    <div className="flex-1">
                      <p className="text-sm uppercase" style={{ letterSpacing: '0.12em', fontWeight: 500 }}>{sq.name}</p>
                      <p className="text-[9px] uppercase mt-0.5" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>
                        {sq.teams.length} equipo{sq.teams.length !== 1 ? 's' : ''} · {sq.teams.reduce((a,t)=>a+t.sellers.length,0)} vendedores en Solstice
                      </p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-sm" style={{ color: C.red, fontWeight: 500 }}>{sq.count}</p>
                        <p className="text-[9px]" style={{ color: C.gray }}>reservas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm" style={{ color: C.green, fontWeight: 500 }}>{fmtK(sq.paid)}</p>
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
                        <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
                          {sq.teams.map(team => (
                            <div key={team.id} style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                              {/* Team row */}
                              <button className="w-full flex items-center gap-3 pl-10 pr-5 py-3 text-left transition-colors hover:bg-white/3"
                                onClick={() => setExpandedTeam(v => v === team.id ? null : team.id)}>
                                <Building2 size={12} style={{ color: C.gray }} />
                                <div className="flex-1">
                                  <p className="text-xs uppercase" style={{ fontWeight: 500 }}>{team.name}</p>
                                  <p className="text-[9px]" style={{ color: C.gray }}>{team.sellers.length} vendedores</p>
                                </div>
                                <div className="flex items-center gap-5">
                                  <span className="text-xs" style={{ color: C.red, fontWeight: 500 }}>{team.count}</span>
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
                                      <div key={sl.user_id} style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                                        <button className="w-full flex items-center gap-3 pl-16 pr-5 py-2.5 text-left transition-colors hover:bg-white/3"
                                          onClick={() => setExpandedSeller(v => v === sl.user_id ? null : sl.user_id)}>
                                          <User size={11} style={{ color: C.gray }} />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs uppercase truncate" style={{ fontWeight: 500 }}>{sl.name}</p>
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
                                            {/* Link de venta del vendedor — el admin lo copia y se lo manda */}
                                            {sl.ref_code && (
                                              <div className="flex items-center gap-2 px-3 py-2 mb-1"
                                                style={{ background: 'rgba(230,57,47,0.08)', border: '0.5px solid rgba(230,57,47,0.30)', borderRadius: '14px' }}>
                                                <Globe size={12} style={{ color: C.red, flexShrink: 0 }} />
                                                <span className="text-[9px] flex-1 truncate font-mono" style={{ color: C.cream }}>
                                                  /sol/p/{sl.ref_code}
                                                </span>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const link = `${window.location.origin}/sol/p/${sl.ref_code}`;
                                                    navigator.clipboard?.writeText(link);
                                                    toast.success(`Link de ${sl.name.split(' ')[0]} copiado`);
                                                  }}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-[9px] uppercase"
                                                  style={{ background: 'rgba(230,57,47,0.25)', border: '0.5px solid rgba(230,57,47,0.50)', color: C.cream, borderRadius: '999px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer' }}>
                                                  <Copy size={10} /> Copiar
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const link = `${window.location.origin}/sol/p/${sl.ref_code}`;
                                                    const msg = `¡Tu link de ventas SOLSTICE 2026! 🌅\n${link}\n\nMandalo a tus contactos — cada compra por ese link te queda contada.`;
                                                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                                                  }}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-[9px] uppercase"
                                                  style={{ background: 'rgba(16,185,129,0.18)', border: '0.5px solid rgba(16,185,129,0.45)', color: '#86efac', borderRadius: '999px', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer' }}>
                                                  <Share2 size={10} /> WA
                                                </button>
                                              </div>
                                            )}
                                            {sl.regs.length === 0
                                              ? <p className="text-[9px] uppercase" style={{ color: C.gray }}>Sin compras en este período</p>
                                              : sl.regs.map(r => (
                                                <div key={r.id} className="flex items-center gap-3 px-3 py-2"
                                                  style={{
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '0.5px solid rgba(255,255,255,0.08)',
                                                    borderRadius: '14px',
                                                  }}>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] uppercase truncate" style={{ fontWeight: 500 }}>{r.customer_name}</p>
                                                    <p className="text-[9px]" style={{ color: C.gray }}>{r.customer_university}</p>
                                                  </div>
                                                  <StatusBadge status={r.status} />
                                                  <span className="text-[9px] px-1.5 py-0.5 uppercase"
                                                    style={{
                                                      background: r.payment_mode==='cash_to_seller'?`${C.yellow}18`:`${C.green}18`,
                                                      color: r.payment_mode==='cash_to_seller'?C.yellow:C.green,
                                                      borderRadius: '999px',
                                                    }}>
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
                <div style={{ border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                  <div className="px-5 py-3 flex items-center justify-between">
                    <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Equipos sin squad</p>
                    <div className="flex gap-5 text-xs">
                      <span style={{ color: C.red }}>{orgTree.noSquadTeams.reduce((a,t)=>a+t.count,0)}</span>
                      <span style={{ color: C.green }}>{fmtK(orgTree.noSquadTeams.reduce((a,t)=>a+t.paid,0))}</span>
                    </div>
                  </div>
                  {orgTree.noSquadTeams.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-2"
                      style={{ borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
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
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              overflow: 'hidden',
            }}>
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase"
                style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontWeight: 500, letterSpacing: '0.06em' }}>
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
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', background: expandedSeller===sl.user_id?`rgba(230,57,47,0.06)`:'transparent' }}
                      onClick={() => setExpandedSeller(v => v===sl.user_id ? null : sl.user_id)}>
                      <div className="col-span-3 flex items-center gap-2">
                        {idx < 3 && <span style={{ color: ['#FFD700','#C0C0C0','#CD7F32'][idx], fontSize: 11 }}>★</span>}
                        <div className="min-w-0">
                          <p className="text-xs uppercase truncate"
                            style={{ color: expandedSeller===sl.user_id ? C.red : C.cream, fontWeight: 500 }}>{sl.name}</p>
                          <p className="text-[9px] font-mono" style={{ color: C.gray }}>{sl.ref_code}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-[9px]" style={{ color: C.gray }}>
                        {sl.squad_name && <p className="truncate">{sl.squad_name}</p>}
                        {sl.team_name  && <p className="truncate">{sl.team_name}</p>}
                      </div>
                      <div className="col-span-1 text-right text-sm" style={{ color: C.red, fontWeight: 500 }}>{sl.count}</div>
                      <div className="col-span-1 text-right text-xs" style={{ color: C.green }}>{sl.dig}</div>
                      <div className="col-span-1 text-right text-xs" style={{ color: C.yellow }}>{sl.cash}</div>
                      <div className="col-span-2 text-right text-xs">{fmtK(sl.paid)}</div>
                      <div className="col-span-2 text-right text-xs" style={{ color: C.yellow }}>{fmtK(sl.com)}</div>
                    </button>
                    <AnimatePresence>
                      {expandedSeller === sl.user_id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-5 pb-3 pt-1 space-y-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {sl.regs.length === 0
                              ? <p className="text-[9px] uppercase py-2" style={{ color: C.gray }}>Sin compras en este período</p>
                              : sl.regs.map(r => (
                                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5"
                                  style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '0.5px solid rgba(255,255,255,0.08)',
                                    borderRadius: '14px',
                                  }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] uppercase truncate" style={{ fontWeight: 500 }}>{r.customer_name}</p>
                                    <p className="text-[9px]" style={{ color: C.gray }}>{r.customer_university} · {r.order_number}</p>
                                  </div>
                                  <StatusBadge status={r.status} />
                                  <span className="text-[9px] uppercase px-1.5 py-0.5"
                                    style={{
                                      background: r.payment_mode==='cash_to_seller'?`${C.yellow}15`:`${C.green}15`,
                                      color: r.payment_mode==='cash_to_seller'?C.yellow:C.green,
                                      borderRadius: '999px',
                                    }}>
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
                  <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Sin vendedores registrados en Solstice</p>
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
                    className="text-[9px] uppercase tracking-widest"
                    style={{
                      background: sellerFilter===f.id ? 'rgba(230,57,47,0.20)' : 'transparent',
                      color:      sellerFilter===f.id ? C.cream : C.gray,
                      border:     sellerFilter===f.id ? `0.5px solid rgba(230,57,47,0.35)` : '0.5px solid rgba(96,96,96,0.30)',
                      borderRadius: '999px',
                      fontWeight: 500,
                      padding: '4px 14px',
                      transition: 'all 0.3s ease',
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredRegs.length === 0 ? (
                <div className="py-16 text-center" style={{ color: C.gray }}>
                  <UserCheck size={32} className="mx-auto mb-4 opacity-30" />
                  <p className="text-xs uppercase" style={{ fontWeight: 500, letterSpacing: '0.08em' }}>Sin compradores en este período</p>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                  overflow: 'hidden',
                }}>
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

        <CashModal />
        <SolsticeRecruitModal open={recruitOpen} onClose={() => setRecruitOpen(false)} onCreated={load} />
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
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[9px] uppercase mb-1" style={{ color: C.red, fontWeight: 500, letterSpacing: '0.4em' }}>
          {isSeller ? 'Mi Dashboard' : 'Dashboard · Gerente'}
        </p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em', fontWeight: 300 }}>
          {isSeller ? 'Mis Ventas' : 'Vista Equipo'}
        </h1>
        {mySeller && (
          <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>
            {season?.name || 'SOLSTICE 2026'}
            {mySeller.team_name  && ` · ${mySeller.team_name}`}
            {mySeller.squad_name && ` · ${mySeller.squad_name}`}
          </p>
        )}
      </div>

      <div className="px-8 py-8 space-y-10 max-w-5xl">

        {/* ── TU LANDING PAGE — prominente, lo primero que ve el vendedor ──
            El vendedor copia este link y lo manda. Cada compra que llegue por
            él se le cuenta automáticamente (sin que el cliente ponga código). */}
        {mySeller?.ref_code && (
          <div className="p-5 md:p-6" style={{
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(230,57,47,0.12) 0%, rgba(255,122,0,0.05) 100%)',
            border: '0.5px solid rgba(230,57,47,0.40)',
          }}>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={15} style={{ color: C.red }} />
              <p className="text-[10px] uppercase" style={{ color: C.red, letterSpacing: '0.35em', fontWeight: 600 }}>
                Tu landing page de ventas
              </p>
            </div>
            <p className="text-xs mb-4" style={{ color: `${C.cream}cc`, lineHeight: 1.5 }}>
              Mandá este link a tus contactos. Cuando alguien entra y compra, la venta
              <strong style={{ color: C.cream }}> se te cuenta automáticamente</strong> — sin códigos.
            </p>
            <div className="flex items-center gap-3 px-4 py-3 mb-3" style={{
              background: 'rgba(0,0,0,0.45)',
              border: '0.5px dashed rgba(230,57,47,0.40)',
              borderRadius: '14px',
            }}>
              <span className="text-xs flex-1 break-all font-mono" style={{ color: C.cream }}>{referralLink}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={copyLink}
                className="flex items-center justify-center gap-2 px-3 py-3 text-[10px] uppercase"
                style={{
                  background: linkCopied ? C.green : 'rgba(230,57,47,0.22)',
                  border: `0.5px solid ${linkCopied ? C.green : 'rgba(230,57,47,0.50)'}`,
                  color: C.cream, borderRadius: '999px', fontWeight: 600, letterSpacing: '0.15em',
                  transition: 'all 0.3s ease', cursor: 'pointer',
                }}>
                {linkCopied ? <Check size={13} /> : <Copy size={13} />} {linkCopied ? 'Copiado' : 'Copiar'}
              </button>
              <button onClick={shareWhatsApp}
                className="flex items-center justify-center gap-2 px-3 py-3 text-[10px] uppercase"
                style={{
                  background: 'rgba(16,185,129,0.18)', border: '0.5px solid rgba(16,185,129,0.45)',
                  color: '#86efac', borderRadius: '999px', fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer',
                }}>
                <Share2 size={13} /> WhatsApp
              </button>
              <button onClick={() => window.open(referralLink, '_blank', 'noopener')}
                className="flex items-center justify-center gap-2 px-3 py-3 text-[10px] uppercase"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)',
                  color: C.cream, borderRadius: '999px', fontWeight: 600, letterSpacing: '0.15em', cursor: 'pointer',
                }}>
                <Globe size={13} /> Ver
              </button>
            </div>
          </div>
        )}

        <DateBar value={dateFilter} onChange={setDateFilter} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Reservas"   value={String(myStats.count)}      sub={`${myStats.digital} dig · ${myStats.cash} ef`} />
          <KpiCard label="Pagado"     value={fmtK(myStats.paid)}         sub="acumulado" color={C.red} />
          <KpiCard label="Comisión"   value={fmtK(myStats.com)}          sub={`${season?.commission_pct||10}%`} color={C.green} />
          <KpiCard label="Pendiente"  value={fmtK(myStats.comPending)}   sub="cuotas futuras" />
        </div>
        {myStats.inMora > 0 && (
          <div className="flex items-center gap-3 px-5 py-3"
            style={{
              background: 'rgba(230,57,47,0.12)',
              border: '0.5px solid rgba(230,57,47,0.35)',
              borderRadius: '20px',
            }}>
            <AlertTriangle size={16} style={{ color: C.red }} />
            <p className="text-xs uppercase" style={{ color: C.red, letterSpacing: '0.15em', fontWeight: 500 }}>
              {myStats.inMora} comprador{myStats.inMora > 1 ? 'es' : ''} con cuota vencida
            </p>
          </div>
        )}

        {/* Manager: team table */}
        {isManager && teamSellers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase" style={{ color: C.gray, fontWeight: 300, letterSpacing: '-0.02em' }}>Mi equipo</p>
              <button onClick={() => exportCsv(allRegs)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest px-4 py-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  color: C.gray,
                  borderRadius: '999px',
                  transition: 'all 0.3s ease',
                }}>
                <Download size={12} /> CSV
              </button>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              overflow: 'hidden',
            }}>
              <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase"
                style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontWeight: 500, letterSpacing: '0.06em' }}>
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
                    style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', background: sellerFilter===sl.user_id?'rgba(230,57,47,0.08)':'transparent' }}>
                    <div className="col-span-4">
                      <p className="text-xs uppercase truncate" style={{ color: sellerFilter===sl.user_id?C.red:C.cream, fontWeight: 500 }}>{sl.name}</p>
                      <p className="text-[9px] font-mono" style={{ color: C.gray }}>{sl.ref_code}</p>
                    </div>
                    <div className="col-span-2 text-right text-xs" style={{ fontWeight: 500 }}>{slRegs.length}</div>
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
            <p className="text-xs uppercase" style={{ color: C.gray, fontWeight: 300, letterSpacing: '-0.02em' }}>
              {sellerFilter==='all' ? 'Mis compradores' : `Compradores de ${teamSellers.find(s=>s.user_id===sellerFilter)?.name||'vendedor'}`}
              <span className="ml-2" style={{ color: C.red }}>({buyerRegs.length})</span>
            </p>
            {isSeller && (
              <button onClick={() => exportCsv(allRegs)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-widest px-4 py-2"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  color: C.gray,
                  borderRadius: '999px',
                  transition: 'all 0.3s ease',
                }}>
                <Download size={12} /> CSV
              </button>
            )}
          </div>
          {buyerRegs.length === 0 ? (
            <div className="py-16 text-center" style={{ color: C.gray }}>
              <UserCheck size={32} className="mx-auto mb-4 opacity-30" />
              <p className="text-xs uppercase" style={{ fontWeight: 500, letterSpacing: '0.08em' }}>Sin compradores aún</p>
            </div>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(24px)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
              overflow: 'hidden',
            }}>
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
          <div className="p-6 space-y-3" style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(16,185,129,0.25)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
          }}>
            <div className="flex items-center gap-2"><Globe size={14} style={{ color: C.green }} />
              <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Digital</p></div>
            <p className="text-3xl" style={{ color: C.green, fontWeight: 500 }}>{myStats.digital}</p>
            <div className="h-1" style={{ background: `${C.gray}20`, borderRadius: '999px' }}>
              <div className="h-full" style={{ width: myStats.count ? `${(myStats.digital/myStats.count)*100}%` : '0%', background: C.green, borderRadius: '999px' }} />
            </div>
          </div>
          <div className="p-6 space-y-3" style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(245,158,11,0.25)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
          }}>
            <div className="flex items-center gap-2"><Banknote size={14} style={{ color: C.yellow }} />
              <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Efectivo</p></div>
            <p className="text-3xl" style={{ color: C.yellow, fontWeight: 500 }}>{myStats.cash}</p>
            <div className="h-1" style={{ background: `${C.gray}20`, borderRadius: '999px' }}>
              <div className="h-full" style={{ width: myStats.count ? `${(myStats.cash/myStats.count)*100}%` : '0%', background: C.yellow, borderRadius: '999px' }} />
            </div>
          </div>
        </div>
      </div>

      <CashModal />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Intelligence: gráfico de últimos 30 días (reservas + revenue acumulado)
// ─────────────────────────────────────────────────────────────────────────────

function SalesIntelChart({ regs }: { regs: Registration[] }) {
  const data = useMemo(() => {
    // 30 días terminados hoy
    const now = new Date();
    const days: Array<{ date: string; label: string; count: number; revenue: number }> = [];
    const map: Record<string, { count: number; revenue: number }> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      days.push({ date: key, label, count: 0, revenue: 0 });
      map[key] = { count: 0, revenue: 0 };
    }

    for (const r of regs) {
      const key = (r.created_at || '').slice(0, 10);
      if (map[key]) {
        map[key].count += 1;
        map[key].revenue += r.amount_paid || 0;
      }
    }

    return days.map(d => ({
      ...d,
      count: map[d.date].count,
      revenue: Math.round(map[d.date].revenue / 1000), // K
    }));
  }, [regs]);

  const totalCount30   = data.reduce((s, d) => s + d.count, 0);
  const totalRevenue30 = data.reduce((s, d) => s + d.revenue, 0);
  const avgPerDay      = (totalCount30 / 30).toFixed(1);
  const last7          = data.slice(-7).reduce((s, d) => s + d.count, 0);
  const prev7          = data.slice(-14, -7).reduce((s, d) => s + d.count, 0);
  const trendPct       = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : (last7 > 0 ? 100 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 size={12} style={{ color: C.red }} />
          <p className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>
            Sales Intelligence · últimos 30 días
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase" style={{ letterSpacing: '0.18em' }}>
          <span style={{ color: C.gray }}>
            <span style={{ color: C.cream, fontWeight: 600 }}>{totalCount30}</span> reservas
          </span>
          <span style={{ color: C.gray }}>
            <span style={{ color: C.red, fontWeight: 600 }}>${totalRevenue30}K</span> pagado
          </span>
          <span style={{ color: C.gray }}>
            <span style={{ color: trendPct >= 0 ? C.green : C.red, fontWeight: 600 }}>
              {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(0)}%
            </span> vs 7d ant.
          </span>
        </div>
      </div>

      <div
        className="p-4 md:p-6"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(32px) saturate(180%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
        }}
      >
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="solsticeReservasFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.red}   stopOpacity={0.45} />
                  <stop offset="100%" stopColor={C.red}   stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="solsticeRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#FFB48C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FFB48C" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#606060"
                tick={{ fontSize: 9, fill: '#606060', letterSpacing: '0.1em' }}
                interval="preserveStartEnd"
                minTickGap={20}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#606060"
                tick={{ fontSize: 9, fill: '#606060' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#606060"
                tick={{ fontSize: 9, fill: '#606060' }}
                tickFormatter={v => `${v}K`}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(8,0,0,0.94)',
                  border: '0.5px solid rgba(230,57,47,0.40)',
                  borderRadius: 14,
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  padding: '10px 14px',
                }}
                labelStyle={{ color: C.gray, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}
                itemStyle={{ color: C.cream }}
                formatter={(value: number, name: string) => {
                  if (name === 'Reservas') return [value, name];
                  if (name === 'Revenue') return [`$${value}K`, name];
                  return [value, name];
                }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="count"
                name="Reservas"
                stroke={C.red}
                strokeWidth={2}
                fill="url(#solsticeReservasFill)"
                dot={false}
                activeDot={{ r: 4, fill: C.red, strokeWidth: 2, stroke: C.bg }}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#FFB48C"
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="url(#solsticeRevenueFill)"
                dot={false}
                activeDot={{ r: 4, fill: '#FFB48C', strokeWidth: 2, stroke: C.bg }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4"
          style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <Legend color={C.red}      label="Reservas / día" />
          <Legend color="#FFB48C"     label="Revenue / día (K)" dashed />
          <span className="ml-auto text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
            Promedio: <span style={{ color: C.cream }}>{avgPerDay} reservas/día</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2 text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
      <span style={{
        display: 'inline-block', width: 14, height: 2,
        background: dashed ? 'transparent' : color,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
      }} />
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SolsticeRecruitModal — reclutar vendedor Solstice rápido
//
// Flujo:
// 1. Verifica si el email ya existe en `promoters` (Midnight base)
// 2. Si no existe → crea perfil con rol PROMOTER + lo agrega a solstice_sellers
// 3. Si existe → solo lo agrega a solstice_sellers (habilita para vender Solstice)
// ─────────────────────────────────────────────────────────────────────────────

function SolsticeRecruitModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [step, setStep]   = useState<'form' | 'enable' | 'done'>('form');
  const [email, setEmail] = useState('');
  const [name, setName]   = useState('');
  const [code, setCode]   = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSeller, setCreatedSeller] = useState<{ name: string; refCode: string; phone: string | null } | null>(null);
  const [linkCopiedTick, setLinkCopiedTick] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('form'); setEmail(''); setName(''); setCode(''); setPhone('');
      setExisting(null); setError(null); setLoading(false);
      setCreatedSeller(null); setLinkCopiedTick(false);
    }
  }, [open]);

  const checkEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Email inválido');
      return;
    }
    setLoading(true); setError(null);
    try {
      const { data } = await supabase
        .from('promoters')
        .select('user_id, name, email, code, phone, role')
        .ilike('email', email.trim())
        .maybeSingle();
      if (data) {
        setExisting(data);
        setStep('enable');
      } else {
        // No existe → seguir con el form para crear
        setExisting(null);
        setName(''); setCode(email.split('@')[0].toUpperCase().replace(/\W/g, '').slice(0, 12));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAndEnable = async () => {
    if (!name || !code) { setError('Nombre y código requeridos'); return; }
    setLoading(true); setError(null);
    try {
      const cleanCode = code.toUpperCase().replace(/\W/g, '');

      // 1. Insert en promoters (Midnight base)
      const { data: prom, error: pErr } = await supabase
        .from('promoters')
        .insert({
          name, email: email.toLowerCase().trim(),
          code: cleanCode,
          phone: phone || null,
          role: 'PROMOTER',
        })
        .select()
        .single();
      if (pErr) throw new Error('No se pudo crear en Midnight: ' + pErr.message);

      // 2. Habilitar en solstice_sellers — el ref_code es lo que usa el link
      // de venta /sol/p/CODE para atribuir compras al vendedor.
      const { data: season } = await supabase
        .from('solstice_seasons').select('id').eq('status', 'open').maybeSingle();

      const { error: sErr } = await supabase.from('solstice_sellers').insert({
        user_id: prom.user_id,
        season_id: season?.id ?? null,
        ref_code: cleanCode,
        status: 'active',
      });
      if (sErr) throw new Error('No se pudo habilitar en Solstice: ' + sErr.message);

      // 3. Mostrar al admin el link listo para enviarle al vendedor
      setCreatedSeller({ name, refCode: cleanCode, phone: phone || null });
      setStep('done');
      toast.success(`${name} creado · link listo para enviar`);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const enableExisting = async () => {
    if (!existing) return;
    setLoading(true); setError(null);
    try {
      let finalRefCode = existing.code as string;

      // Verificar si ya está habilitado en Solstice
      const { data: already } = await supabase
        .from('solstice_sellers')
        .select('id, status, ref_code')
        .eq('user_id', existing.user_id)
        .maybeSingle();

      if (already) {
        finalRefCode = already.ref_code || existing.code;
        if (already.status !== 'active') {
          await supabase.from('solstice_sellers').update({ status: 'active' }).eq('id', already.id);
        }
      } else {
        const { data: season } = await supabase
          .from('solstice_seasons').select('id').eq('status', 'open').maybeSingle();
        const { error: sErr } = await supabase.from('solstice_sellers').insert({
          user_id: existing.user_id,
          season_id: season?.id ?? null,
          ref_code: existing.code,
          status: 'active',
        });
        if (sErr) throw new Error(sErr.message);
      }

      setCreatedSeller({ name: existing.name, refCode: finalRefCode, phone: existing.phone || null });
      setStep('done');
      toast.success(`${existing.name} habilitado · link listo`);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
        style={{
          background: 'rgba(8,0,0,0.94)',
          backdropFilter: 'blur(40px) saturate(160%)',
          border: '0.5px solid rgba(230,57,47,0.30)',
          borderRadius: '28px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.65)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase mb-1" style={{ color: C.red, letterSpacing: '0.35em', fontWeight: 600 }}>
              Reclutar Solstice
            </p>
            <h3 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
              {step === 'enable' ? 'Cuenta ya existe' : 'Vendedor nuevo'}
            </h3>
          </div>
          <button onClick={onClose} style={{ color: C.gray, cursor: 'pointer' }} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {step === 'form' && (
          <>
            <p className="text-[11px]" style={{ color: C.gray, lineHeight: 1.55, letterSpacing: '0.05em' }}>
              Si la cuenta ya existe en Midnight, la habilitamos para Solstice. Si no existe, la creamos en ambos.
            </p>
            <SolRecruitField label="Email" type="email" value={email} onChange={setEmail} placeholder="vendedor@email.com" />

            {existing === null && email && !loading ? (
              <>
                <SolRecruitField label="Nombre completo" value={name} onChange={setName} placeholder="María Pérez" />
                <div className="grid grid-cols-2 gap-3">
                  <SolRecruitField label="Código (ref)" value={code} onChange={v => setCode(v.toUpperCase().replace(/\W/g, ''))} placeholder="MARIA" />
                  <SolRecruitField label="WhatsApp" type="tel" value={phone} onChange={setPhone} placeholder="+57 300 ..." />
                </div>
              </>
            ) : null}

            {error && <p className="text-[11px]" style={{ color: C.red }}>{error}</p>}

            {existing === null && (name === '' || code === '') ? (
              <button onClick={checkEmail} disabled={loading || !email}
                className="w-full py-3.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                style={{
                  background: 'rgba(230,57,47,0.22)',
                  border: '0.5px solid rgba(230,57,47,0.50)',
                  color: C.cream,
                  borderRadius: '999px',
                  fontWeight: 600,
                  opacity: loading || !email ? 0.5 : 1,
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Verificar email
              </button>
            ) : (
              <button onClick={createAndEnable} disabled={loading}
                className="w-full py-3.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                style={{
                  background: C.red, color: '#fff',
                  borderRadius: '999px',
                  fontWeight: 600,
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
                }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Crear + habilitar
              </button>
            )}
          </>
        )}

        {step === 'enable' && existing && (
          <>
            <div className="p-4" style={{
              background: 'rgba(16,185,129,0.10)',
              border: '0.5px solid rgba(16,185,129,0.35)',
              borderRadius: '14px',
            }}>
              <p className="text-[10px] uppercase mb-1" style={{ color: '#10b981', letterSpacing: '0.25em', fontWeight: 600 }}>
                Encontrado en Midnight
              </p>
              <p className="text-sm" style={{ color: C.cream, fontWeight: 600 }}>{existing.name}</p>
              <p className="text-[11px]" style={{ color: C.gray }}>{existing.email}</p>
              <p className="text-[10px] mt-1" style={{ color: C.gray }}>
                Código: <span className="font-mono">{existing.code}</span> · Rol: {existing.role}
              </p>
            </div>

            <p className="text-[11px]" style={{ color: C.gray, lineHeight: 1.55 }}>
              Al confirmar, esta cuenta queda habilitada para vender Solstice. Conservará su rol y código de Midnight.
            </p>

            {error && <p className="text-[11px]" style={{ color: C.red }}>{error}</p>}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep('form')} disabled={loading}
                className="py-3 text-[10px] uppercase tracking-widest"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  color: C.gray, borderRadius: '999px', fontWeight: 600, cursor: 'pointer',
                }}>
                Volver
              </button>
              <button onClick={enableExisting} disabled={loading}
                className="py-3 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                style={{
                  background: '#10b981', color: '#fff',
                  borderRadius: '999px', fontWeight: 600,
                  opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                {loading ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                Habilitar
              </button>
            </div>
          </>
        )}

        {step === 'done' && createdSeller && (() => {
          const link = `${window.location.origin}/sol/p/${createdSeller.refCode}`;
          const msg = `¡Listo! Tu link de ventas para SOLSTICE 2026 es:\n${link}\n\nMandalo a quien quieras invitar. Cada venta que llegue por ese link te queda contada automáticamente. 🌅`;
          // Limpiamos el phone para wa.me (solo dígitos, sin +)
          const waNum = (createdSeller.phone || '').replace(/[^0-9]/g, '');
          const waUrl = waNum
            ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`
            : `https://wa.me/?text=${encodeURIComponent(msg)}`;
          return (
            <>
              <div className="p-4" style={{
                background: 'rgba(16,185,129,0.10)',
                border: '0.5px solid rgba(16,185,129,0.35)',
                borderRadius: '14px',
              }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                  <p className="text-[10px] uppercase" style={{ color: '#10b981', letterSpacing: '0.25em', fontWeight: 600 }}>
                    Vendedor habilitado
                  </p>
                </div>
                <p className="text-sm" style={{ color: C.cream, fontWeight: 600 }}>{createdSeller.name}</p>
                <p className="text-[10px] mt-1" style={{ color: C.gray }}>
                  Código: <span className="font-mono">{createdSeller.refCode}</span>
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.3em', color: C.red, fontWeight: 600 }}>
                  Su link de ventas
                </p>
                <div style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '0.5px dashed rgba(230,57,47,0.45)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  textAlign: 'center',
                }}>
                  <p className="font-mono break-all" style={{ fontSize: '13px', color: C.cream, lineHeight: 1.5 }}>
                    {link}
                  </p>
                </div>
                <p className="text-[10px] mt-2" style={{ color: C.gray, lineHeight: 1.5 }}>
                  Mandáselo por WhatsApp. Cuando un cliente abra este link y compre, la venta se cuenta para {createdSeller.name.split(' ')[0]}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => window.open(waUrl, '_blank', 'noopener')}
                  className="py-3 text-[10px] uppercase flex items-center justify-center gap-2"
                  style={{
                    background: 'rgba(16,185,129,0.18)',
                    border: '0.5px solid rgba(16,185,129,0.55)',
                    color: '#86efac',
                    letterSpacing: '0.2em',
                    borderRadius: '999px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💬 {waNum ? `Mandar a ${createdSeller.name.split(' ')[0]}` : 'WhatsApp'}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(link);
                    setLinkCopiedTick(true);
                    setTimeout(() => setLinkCopiedTick(false), 1500);
                  }}
                  className="py-3 text-[10px] uppercase flex items-center justify-center gap-2"
                  style={{
                    background: linkCopiedTick ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.06)',
                    border: linkCopiedTick ? '0.5px solid rgba(16,185,129,0.55)' : '0.5px solid rgba(255,255,255,0.18)',
                    color: linkCopiedTick ? '#86efac' : C.cream,
                    letterSpacing: '0.2em',
                    borderRadius: '999px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {linkCopiedTick ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar link</>}
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 text-[10px] uppercase"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.12)',
                  color: C.gray,
                  letterSpacing: '0.25em',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Listo
              </button>
            </>
          );
        })()}
      </motion.div>
    </AnimatePresence>
  );
}

function SolRecruitField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: '12px',
          color: '#F9F2D7',
          padding: '11px 14px',
          width: '100%',
          outline: 'none',
          fontSize: '13px',
        }}
      />
    </div>
  );
}
