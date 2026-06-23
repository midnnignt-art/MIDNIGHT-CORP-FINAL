import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import {
  Loader2, FileText, BarChart3, Receipt, FileSpreadsheet,
  Calendar, Wallet, TrendingUp, Lock, Download,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981', orange: '#FFB48C', blue: '#22d3ee' };

type Tab = 'resumen' | 'balance' | 'eerr' | 'movimientos' | 'eventos' | 'impuestos' | 'cierre';

const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

interface Movement {
  id: string;
  kind: 'income' | 'expense';
  source: 'registration' | 'expense' | 'commission' | 'lodging' | 'penalty';
  amount: number;
  date: string;
  description: string;
  reference: string;
}

export default function SolsticeContabilidad() {
  const [tab, setTab]     = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);
  const [regs, setRegs]   = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [weekExpenses, setWeekExpenses] = useState<any[]>([]);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [season, setSeason] = useState<any | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: s }, { data: e }, { data: w }, { data: se }] = await Promise.all([
        supabase.from('solstice_registrations').select('*').neq('status', 'cancelled'),
        supabase.from('solstice_payment_schedules').select('*'),
        supabase.from('solstice_week_expenses').select('*'),
        supabase.from('solstice_weeks').select('*').order('start_date'),
        supabase.from('solstice_seasons').select('*').eq('status', 'open').maybeSingle(),
      ]);
      setRegs(r || []);
      setSchedules(s || []);
      setWeekExpenses(e || []);
      setWeeks(w || []);
      setSeason(se);
    } finally {
      setLoading(false);
    }
  };

  // ─── Cálculos contables ──────────────────────────────────────────────────
  const totals = useMemo(() => {
    const revenueExpected   = regs.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const revenueCollected  = regs.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const accountsReceivable = revenueExpected - revenueCollected;
    const expEstimated      = weekExpenses.reduce((s, e) => s + Number(e.amount_estimated || 0), 0);
    const expPaid           = weekExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount_actual ?? e.amount_estimated ?? 0), 0);
    const expPending        = expEstimated - expPaid;
    const commissionPct     = Number(season?.commission_pct ?? 10);
    const commissionAccrued = (revenueExpected * commissionPct) / 100;
    const grossMargin       = revenueExpected - expEstimated - commissionAccrued;
    const netCashflow       = revenueCollected - expPaid;
    const vat19 = revenueCollected * 0.19;
    return {
      revenueExpected, revenueCollected, accountsReceivable,
      expEstimated, expPaid, expPending,
      commissionAccrued, commissionPct,
      grossMargin, netCashflow, vat19,
    };
  }, [regs, weekExpenses, season]);

  // Movimientos compilados (orden temporal)
  const movements: Movement[] = useMemo(() => {
    const arr: Movement[] = [];
    for (const r of regs) {
      if (Number(r.amount_paid || 0) > 0) {
        arr.push({
          id: `reg-${r.id}`,
          kind: 'income',
          source: 'registration',
          amount: Number(r.amount_paid),
          date: r.created_at,
          description: `${r.customer_name} · ${r.customer_university || ''}`,
          reference: r.order_number,
        });
      }
    }
    for (const e of weekExpenses) {
      if (e.status === 'paid' && Number(e.amount_actual ?? e.amount_estimated ?? 0) > 0) {
        arr.push({
          id: `exp-${e.id}`,
          kind: 'expense',
          source: 'expense',
          amount: Number(e.amount_actual ?? e.amount_estimated ?? 0),
          date: e.updated_at || e.created_at,
          description: `${e.category} · ${e.description || ''}${e.vendor ? ' · ' + e.vendor : ''}`,
          reference: e.vendor || '',
        });
      }
    }
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [regs, weekExpenses]);

  // Por semana (para vista "Eventos" — equivale a P&L por semana)
  const perWeek = useMemo(() => weeks.map(w => {
    const wRegs = regs.filter(r => r.week_id === w.id);
    const wExp  = weekExpenses.filter(e => e.week_id === w.id);
    const revenue = wRegs.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
    const exp = wExp.reduce((s, e) => s + Number(e.amount_actual ?? e.amount_estimated ?? 0), 0);
    const commission = wRegs.reduce((s, r) => s + Number(r.total_amount || 0), 0) * (Number(season?.commission_pct ?? 10) / 100);
    return { ...w, revenue, exp, commission, net: revenue - exp - commission };
  }), [weeks, regs, weekExpenses, season]);

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-4 md:px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Solstice · Contabilidad
          </p>
          <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Libro contable
          </h1>
          <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            P&L · Balance · Movimientos · Impuestos · Cierre — aislado de Midnight
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          {([
            ['resumen',     'Resumen',       <BarChart3 size={11} />],
            ['balance',     'Balance',       <FileSpreadsheet size={11} />],
            ['eerr',        'Estado Result.', <TrendingUp size={11} />],
            ['movimientos', 'Movimientos',   <Receipt size={11} />],
            ['eventos',     'Por semana',    <Calendar size={11} />],
            ['impuestos',   'Impuestos',     <FileText size={11} />],
            ['cierre',      'Cierre',        <Lock size={11} />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] uppercase whitespace-nowrap"
              style={{
                background: tab === id ? 'rgba(230,57,47,0.10)' : 'transparent',
                borderBottom: tab === id ? `2px solid ${C.red}` : '2px solid transparent',
                color: tab === id ? C.red : C.gray,
                letterSpacing: '0.2em',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'resumen'     && <ResumenTab totals={totals} perWeek={perWeek} />}
        {tab === 'balance'     && <BalanceTab totals={totals} />}
        {tab === 'eerr'        && <EerrTab totals={totals} perWeek={perWeek} />}
        {tab === 'movimientos' && <MovimientosTab movements={movements} />}
        {tab === 'eventos'     && <EventosTab perWeek={perWeek} />}
        {tab === 'impuestos'   && <ImpuestosTab totals={totals} />}
        {tab === 'cierre'      && <CierreTab totals={totals} perWeek={perWeek} />}
      </div>
    </div>
  );
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────

function ResumenTab({ totals, perWeek }: { totals: any; perWeek: any[] }) {
  const pieData = [
    { name: 'Cobrado',    value: Math.round(totals.revenueCollected / 1000) },
    { name: 'Por cobrar', value: Math.round(totals.accountsReceivable / 1000) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Ingresos esperados" value={fmtK(totals.revenueExpected)} />
        <Kpi label="Ingresos cobrados"  value={fmtK(totals.revenueCollected)} accent />
        <Kpi label="Gastos estimados"   value={fmtK(totals.expEstimated)} />
        <Kpi label="Utilidad bruta"     value={fmtK(totals.grossMargin)} accent={totals.grossMargin > 0} negative={totals.grossMargin < 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Cobranza">
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} labelLine={false}
                  label={(entry: any) => `${entry.name}: $${entry.value}K`}>
                  <Cell fill={C.green} />
                  <Cell fill={C.red}   />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(8,0,0,0.94)',
                    border: '0.5px solid rgba(230,57,47,0.40)',
                    borderRadius: 14, fontSize: 11, color: C.cream,
                  }}
                  itemStyle={{ color: C.cream }}
                  labelStyle={{ color: C.cream }}
                  formatter={(v: any, n: string) => [`$${v}K`, n]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="P&L por semana (K)">
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={perWeek.map(w => ({ name: w.university, Ingresos: Math.round(w.revenue/1000), Gastos: Math.round(w.exp/1000), Neto: Math.round(w.net/1000) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#606060' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#606060' }} tickFormatter={v => `${v}K`} axisLine={false} tickLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: 'rgba(8,0,0,0.94)', border: '0.5px solid rgba(230,57,47,0.40)', borderRadius: 14, fontSize: 11, color: C.cream }}
                  itemStyle={{ color: C.cream }}
                  labelStyle={{ color: C.cream }}
                  formatter={(v: any, n: string) => [`$${v}K`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: C.gray }} />
                <Bar dataKey="Ingresos" fill={C.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos"   fill={C.red}   radius={[4, 4, 0, 0]} />
                <Bar dataKey="Neto"     fill={C.blue}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Balance ─────────────────────────────────────────────────────────

function BalanceTab({ totals }: { totals: any }) {
  const totalAssets      = totals.revenueCollected + totals.accountsReceivable;
  const totalLiabilities = totals.expPending + totals.commissionAccrued + totals.vat19;
  const equity           = totalAssets - totalLiabilities;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card title="Activos">
        <Row label="Caja (cobrado)"          value={fmt(totals.revenueCollected)} color={C.green} />
        <Row label="Cuentas por cobrar"       value={fmt(totals.accountsReceivable)} color={C.orange} />
        <RowTotal label="Total activos"       value={fmt(totalAssets)} />
      </Card>

      <Card title="Pasivos + Patrimonio">
        <Row label="Cuentas por pagar (gastos)" value={fmt(totals.expPending)} color={C.red} />
        <Row label="Comisiones acumuladas"      value={fmt(totals.commissionAccrued)} color={C.orange} />
        <Row label="IVA 19% (por liquidar)"      value={fmt(totals.vat19)} color={C.gray} />
        <RowTotal label="Total pasivos"         value={fmt(totalLiabilities)} />
        <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <Row label="Patrimonio (utilidad acum.)" value={fmt(equity)} color={equity >= 0 ? C.green : C.red} bold />
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Estado de resultados (P&G) ──────────────────────────────────────

function EerrTab({ totals, perWeek }: { totals: any; perWeek: any[] }) {
  return (
    <Card title="Estado de resultados (acumulado temporada)">
      <Row label="Ingresos esperados"             value={fmt(totals.revenueExpected)} color={C.cream} />
      <Row label="Ingresos cobrados"               value={fmt(totals.revenueCollected)} color={C.green} sub="Subtotal income" />
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <Row label="− Gastos operativos"            value={`-${fmt(totals.expEstimated)}`} color={C.red} />
      <Row label={`− Comisiones (${totals.commissionPct}%)`} value={`-${fmt(totals.commissionAccrued)}`} color={C.red} />
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <RowTotal label="Utilidad bruta proyectada" value={fmt(totals.grossMargin)} color={totals.grossMargin >= 0 ? C.green : C.red} />
      <p className="text-[10px] mt-3" style={{ color: C.gray, letterSpacing: '0.1em' }}>
        Margen: {totals.revenueExpected > 0 ? ((totals.grossMargin / totals.revenueExpected) * 100).toFixed(1) : 0}%
      </p>
    </Card>
  );
}

// ─── Tab: Movimientos ─────────────────────────────────────────────────────

function MovimientosTab({ movements }: { movements: Movement[] }) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const filtered = filter === 'all' ? movements : movements.filter(m => m.kind === filter);

  const exportCsv = () => {
    const rows = filtered.map(m => [
      new Date(m.date).toLocaleDateString('es-CO'),
      m.kind === 'income' ? 'Ingreso' : 'Egreso',
      m.source, m.description, m.reference, m.amount,
    ]);
    const csv = ['Fecha,Tipo,Categoría,Descripción,Referencia,Monto', ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `solstice-movimientos-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-2 text-[10px] uppercase"
              style={{
                background: filter === f ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                border: filter === f ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                color: filter === f ? C.red : C.gray, letterSpacing: '0.2em',
                borderRadius: '999px', fontWeight: 600, cursor: 'pointer',
              }}>
              {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Egresos'}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase"
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: C.gray, letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600, cursor: 'pointer' }}>
          <Download size={11} /> CSV
        </button>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.035)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}>
        {filtered.length === 0 ? (
          <p className="text-xs uppercase py-12 text-center" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            Sin movimientos
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.slice(0, 200).map(m => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: m.kind === 'income' ? C.green : C.red }} />
                <span className="text-[10px] uppercase w-20 flex-shrink-0" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                  {new Date(m.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                </span>
                <span className="text-[9px] uppercase px-2 py-0.5 flex-shrink-0"
                  style={{
                    background: m.kind === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(230,57,47,0.15)',
                    color: m.kind === 'income' ? C.green : C.red,
                    letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600,
                  }}>
                  {m.source}
                </span>
                <p className="text-xs flex-1 truncate" style={{ color: C.cream }}>{m.description}</p>
                <span className="text-sm tabular-nums whitespace-nowrap"
                  style={{ color: m.kind === 'income' ? C.green : C.red, fontWeight: 600 }}>
                  {m.kind === 'income' ? '+' : '−'}{fmt(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {filtered.length > 200 && (
        <p className="text-[10px] uppercase text-center" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          Mostrando 200 / {filtered.length} · Usá el CSV para verlos todos
        </p>
      )}
    </div>
  );
}

// ─── Tab: Por semana (eventos) ────────────────────────────────────────────

function EventosTab({ perWeek }: { perWeek: any[] }) {
  return (
    <div className="space-y-3">
      {perWeek.map(w => {
        const margin = w.revenue > 0 ? (w.net / w.revenue) * 100 : 0;
        return (
          <div key={w.id} className="p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
            }}>
            <div className="flex justify-between items-start mb-3 flex-wrap gap-3">
              <div>
                <p className="text-[10px] uppercase mb-1" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                  {new Date(w.start_date + 'T12:00:00').toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                </p>
                <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
                  {w.university}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>Neto</p>
                <p className="text-2xl tabular-nums" style={{
                  color: w.net >= 0 ? C.green : C.red,
                  fontFamily: "'Poiret One', sans-serif", fontWeight: 300,
                }}>
                  {fmtK(w.net)}
                </p>
                <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                  margen {margin.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
              <Mini label="Ingresos"   value={fmt(w.revenue)} color={C.green} />
              <Mini label="Gastos"     value={fmt(w.exp)} color={C.red} />
              <Mini label="Comisiones" value={fmt(w.commission)} color={C.orange} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Impuestos ───────────────────────────────────────────────────────

function ImpuestosTab({ totals }: { totals: any }) {
  const iva  = totals.revenueCollected * 0.19;
  const rica = totals.revenueCollected * 0.00414;  // ICA Bogotá actividad recreativa aprox
  const total = iva + rica;

  return (
    <Card title="Cálculo de impuestos (base cobrada)">
      <Row label="Base gravable (ingresos cobrados)" value={fmt(totals.revenueCollected)} color={C.cream} />
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <Row label="IVA 19%"     value={fmt(iva)}  color={C.orange} sub="A liquidar" />
      <Row label="ICA 0.414%"  value={fmt(rica)} color={C.orange} sub="Reteíca Bogotá (aprox.)" />
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      <RowTotal label="Total impuestos a liquidar" value={fmt(total)} color={C.red} />

      <div className="mt-4 p-3" style={{
        background: 'rgba(255,180,140,0.06)',
        border: '0.5px solid rgba(255,180,140,0.20)',
        borderRadius: '12px',
      }}>
        <p className="text-[10px] uppercase" style={{ color: C.orange, letterSpacing: '0.2em', fontWeight: 600 }}>
          Aviso
        </p>
        <p className="text-[11px] mt-1" style={{ color: C.gray, lineHeight: 1.5 }}>
          Cálculos referenciales basados en tarifas estándar. Validá con tu contador los regímenes y exenciones aplicables a tu razón social.
        </p>
      </div>
    </Card>
  );
}

// ─── Tab: Cierre ──────────────────────────────────────────────────────────

function CierreTab({ totals, perWeek }: { totals: any; perWeek: any[] }) {
  const allWeeksFinished = perWeek.length > 0 && perWeek.every(w =>
    new Date(w.end_date + 'T23:59:59').getTime() < Date.now()
  );

  return (
    <div className="space-y-6">
      <Card title="Estado del cierre">
        <Row label="Semanas finalizadas"         value={`${perWeek.filter(w => new Date(w.end_date + 'T23:59:59').getTime() < Date.now()).length} / ${perWeek.length}`} color={C.cream} />
        <Row label="Ingresos cobrados"            value={fmt(totals.revenueCollected)} color={C.green} />
        <Row label="Cuentas por cobrar"           value={fmt(totals.accountsReceivable)} color={C.orange} />
        <Row label="Gastos pendientes de pagar"   value={fmt(totals.expPending)} color={C.red} />
        <Row label="Comisiones por liquidar"      value={fmt(totals.commissionAccrued)} color={C.orange} />
        <Row label="Impuestos por liquidar"        value={fmt(totals.vat19)} color={C.red} />
        <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <RowTotal label="Utilidad final proyectada" value={fmt(totals.grossMargin)} color={totals.grossMargin >= 0 ? C.green : C.red} />
      </Card>

      <Card title="Checklist de cierre">
        {[
          ['Confirmar cobros pendientes',    totals.accountsReceivable === 0],
          ['Pagar comisiones a vendedores',  false],
          ['Pagar gastos pendientes',        totals.expPending === 0],
          ['Liquidar impuestos del período', false],
          ['Cerrar todas las semanas',       allWeeksFinished],
          ['Archivar la temporada',          false],
        ].map(([label, done]) => (
          <div key={String(label)} className="flex items-center gap-3 py-2">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              style={{
                background: done ? C.green : 'rgba(255,255,255,0.04)',
                border: done ? 'none' : '0.5px solid rgba(255,255,255,0.10)',
                color: done ? '#fff' : C.gray,
              }}
            >
              {done ? '✓' : ''}
            </span>
            <span className="text-xs" style={{ color: done ? C.cream : C.gray }}>{label}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─── Reusable bits ────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        backdropFilter: 'blur(20px)',
      }}>
      <p className="text-[10px] uppercase mb-4" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent, negative }: { label: string; value: string; accent?: boolean; negative?: boolean }) {
  return (
    <div className="p-4" style={{
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.035)',
      border: `0.5px solid ${negative ? 'rgba(230,57,47,0.30)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <p className="text-[9px] uppercase mb-2" style={{ color: accent ? C.red : C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>{label}</p>
      <p className="text-2xl tabular-nums" style={{
        color: negative ? C.red : accent ? C.red : C.cream,
        fontFamily: "'Poiret One', sans-serif", fontWeight: 300,
      }}>{value}</p>
    </div>
  );
}

function Row({ label, value, color, sub, bold }: { label: string; value: string; color: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <div>
        <span className="text-[12px] uppercase" style={{ color: C.gray, letterSpacing: '0.08em' }}>{label}</span>
        {sub && <span className="text-[9px] ml-2" style={{ color: `${C.gray}99` }}>· {sub}</span>}
      </div>
      <span className="tabular-nums"
        style={{ color, fontSize: bold ? 18 : 14, fontWeight: bold ? 700 : 600 }}>
        {value}
      </span>
    </div>
  );
}

function RowTotal({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between pt-3 mt-2"
      style={{ borderTop: '0.5px solid rgba(255,255,255,0.10)' }}>
      <span className="text-[11px] uppercase" style={{ color: C.cream, letterSpacing: '0.2em', fontWeight: 600 }}>
        {label}
      </span>
      <span className="text-xl tabular-nums" style={{
        color: color || C.cream,
        fontFamily: "'Poiret One', sans-serif", fontWeight: 400,
      }}>
        {value}
      </span>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 500 }}>{label}</p>
      <p className="text-sm tabular-nums mt-0.5" style={{ color, fontWeight: 600 }}>{value}</p>
    </div>
  );
}
