import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, Cell,
} from 'recharts';
import {
  Loader2, Plus, Trash2, DollarSign, TrendingUp, Save,
  Calendar, Building2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981', orange: '#FFB48C' };

interface Week {
  id: string;
  university: string;
  start_date: string;
  end_date: string;
  capacity: number;
}

interface Expense {
  id: string;
  week_id: string;
  category: string;
  description: string | null;
  amount_estimated: number;
  amount_actual: number | null;
  status: 'estimated' | 'committed' | 'paid';
  vendor: string | null;
  due_date: string | null;
}

interface Season {
  id: string;
  combo_total: number;
  installments: number;
  commission_pct: number;
}

const CATEGORIES = [
  'Hospedaje',
  'Lanchas + Beach Club',
  'Logística',
  'Producción / DJ',
  'Comida y bebida',
  'Marketing',
  'Comisiones',
  'Seguros',
  'Otros',
];

const fmt  = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

export default function SolsticeProyecciones() {
  const [season, setSeason] = useState<Season | null>(null);
  const [weeks, setWeeks]   = useState<Week[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [regs, setRegs] = useState<Array<{ week_id: string | null; amount_paid: number; total_amount: number; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string | 'all'>('all');

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: w }, { data: e }, { data: r }] = await Promise.all([
        supabase.from('solstice_seasons').select('id, combo_total, installments, commission_pct').eq('status', 'open').maybeSingle(),
        supabase.from('solstice_weeks').select('id, university, start_date, end_date, capacity').order('start_date'),
        supabase.from('solstice_week_expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('solstice_registrations').select('week_id, amount_paid, total_amount, status').neq('status', 'cancelled'),
      ]);
      setSeason(s as Season);
      setWeeks((w || []) as Week[]);
      setExpenses((e || []) as Expense[]);
      setRegs((r || []) as any);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Cálculos por semana ────────────────────────────────────────────────
  const perWeek = useMemo(() => {
    return weeks.map(w => {
      const wRegs    = regs.filter(r => r.week_id === w.id);
      const wExp     = expenses.filter(e => e.week_id === w.id);
      const occupancy = wRegs.length;
      const occupancyPct = w.capacity > 0 ? (occupancy / w.capacity) * 100 : 0;
      const revenueExpected = wRegs.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const revenueCollected = wRegs.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
      const expEstimated = wExp.reduce((s, e) => s + Number(e.amount_estimated || 0), 0);
      const expActual    = wExp.reduce((s, e) => s + Number(e.amount_actual || e.amount_estimated || 0), 0);
      const expPaid      = wExp.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount_actual || e.amount_estimated || 0), 0);
      const commission = season?.commission_pct ? revenueExpected * (Number(season.commission_pct) / 100) : 0;
      const projectedProfit = revenueExpected - expEstimated - commission;
      return {
        ...w,
        occupancy,
        occupancyPct,
        revenueExpected,
        revenueCollected,
        expEstimated,
        expActual,
        expPaid,
        commission,
        projectedProfit,
        wExp,
      };
    });
  }, [weeks, regs, expenses, season]);

  const totals = useMemo(() => perWeek.reduce((acc, w) => ({
    occupancy:        acc.occupancy + w.occupancy,
    capacity:         acc.capacity + w.capacity,
    revenueExpected:  acc.revenueExpected + w.revenueExpected,
    revenueCollected: acc.revenueCollected + w.revenueCollected,
    expEstimated:     acc.expEstimated + w.expEstimated,
    expPaid:          acc.expPaid + w.expPaid,
    commission:       acc.commission + w.commission,
    profit:           acc.profit + w.projectedProfit,
  }), { occupancy: 0, capacity: 0, revenueExpected: 0, revenueCollected: 0, expEstimated: 0, expPaid: 0, commission: 0, profit: 0 }),
  [perWeek]);

  const chartData = perWeek.map(w => ({
    name:    w.university,
    Ingresos: Math.round(w.revenueExpected / 1000),
    Gastos:   Math.round(w.expEstimated / 1000),
    Comisión: Math.round(w.commission / 1000),
    Utilidad: Math.round(w.projectedProfit / 1000),
  }));

  const filteredWeeks = selectedWeek === 'all' ? perWeek : perWeek.filter(w => w.id === selectedWeek);

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
            Solstice · Finanzas
          </p>
          <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Gastos y proyecciones
          </h1>
          <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            Por semana · ingresos vs gastos vs utilidad esperada
          </p>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Ocupación" value={`${totals.occupancy}/${totals.capacity}`} accent />
          <StatBlock label="Ingresos esperados" value={fmtK(totals.revenueExpected)} />
          <StatBlock label="Gastos estimados" value={fmtK(totals.expEstimated)} />
          <StatBlock label="Utilidad proyectada" value={fmtK(totals.profit)} accent={totals.profit > 0} negative={totals.profit < 0} />
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="p-6" style={{
            background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: '24px',
            backdropFilter: 'blur(28px) saturate(180%)',
          }}>
            <p className="text-[10px] uppercase mb-4" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
              <TrendingUp size={11} className="inline mr-1.5" /> Proyección por semana (K)
            </p>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#606060' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#606060' }} tickFormatter={v => `${v}K`} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(8,0,0,0.94)',
                      border: '0.5px solid rgba(230,57,47,0.40)',
                      borderRadius: 14, fontSize: 11, padding: '10px 14px',
                    }}
                    labelStyle={{ color: C.gray, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em' }}
                    formatter={(v: number, n: string) => [`$${v}K`, n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: C.gray, paddingTop: 12 }} />
                  <Bar dataKey="Ingresos" fill={C.green} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Gastos"   fill={C.red}   radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Comisión" fill={C.orange} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Utilidad" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.Utilidad >= 0 ? '#22d3ee' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Selector de semana */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedWeek('all')}
            className="px-3 py-2 text-[10px] uppercase"
            style={{
              background: selectedWeek === 'all' ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
              border: selectedWeek === 'all' ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
              color: selectedWeek === 'all' ? C.red : C.gray,
              letterSpacing: '0.2em',
              borderRadius: '999px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Todas
          </button>
          {weeks.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWeek(w.id)}
              className="px-3 py-2 text-[10px] uppercase"
              style={{
                background: selectedWeek === w.id ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                border: selectedWeek === w.id ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                color: selectedWeek === w.id ? C.red : C.gray,
                letterSpacing: '0.2em',
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {w.university}
            </button>
          ))}
        </div>

        {/* Cards por semana con gastos */}
        <div className="space-y-6">
          {filteredWeeks.map(w => (
            <WeekFinanceCard key={w.id} week={w} onAddExpense={(exp) => addExpense(w.id, exp)} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense} />
          ))}
        </div>
      </div>
    </div>
  );

  async function addExpense(weekId: string, exp: Partial<Expense>) {
    const { error } = await supabase.from('solstice_week_expenses').insert({
      week_id: weekId,
      season_id: season?.id ?? null,
      ...exp,
    });
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Gasto agregado');
    load();
  }

  async function updateExpense(id: string, patch: Partial<Expense>) {
    const { error } = await supabase.from('solstice_week_expenses').update({
      ...patch,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Guardado');
    load();
  }

  async function deleteExpense(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return;
    const { error } = await supabase.from('solstice_week_expenses').delete().eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Eliminado');
    load();
  }
}

// ─── Card por semana con sus gastos ───────────────────────────────────────

function WeekFinanceCard({ week, onAddExpense, onUpdateExpense, onDeleteExpense }: {
  week: any;
  onAddExpense: (exp: Partial<Expense>) => void;
  onUpdateExpense: (id: string, patch: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newExp, setNewExp] = useState<Partial<Expense>>({ category: CATEGORIES[0], amount_estimated: 0, status: 'estimated' });

  const profitColor = week.projectedProfit > 0 ? C.green : week.projectedProfit < 0 ? C.red : C.cream;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.035)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: '24px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="p-5 md:p-6 flex flex-wrap items-center justify-between gap-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-[10px] uppercase mb-1" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
            {new Date(week.start_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            {' — '}
            {new Date(week.end_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </p>
          <h3 className="text-xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            {week.university}
          </h3>
          <p className="text-[10px] uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.15em' }}>
            {week.occupancy}/{week.capacity} · {week.occupancyPct.toFixed(0)}% ocupación
          </p>
        </div>
        <div className="flex gap-4 text-right text-[11px] flex-wrap">
          <Mini label="Ingresos" value={fmtK(week.revenueExpected)} color={C.green} />
          <Mini label="Cobrado" value={fmtK(week.revenueCollected)} color={C.cream} />
          <Mini label="Gastos" value={fmtK(week.expEstimated)} color={C.red} />
          <Mini label="Utilidad" value={fmtK(week.projectedProfit)} color={profitColor} bold />
        </div>
      </div>

      {/* Tabla de gastos */}
      <div className="p-5 md:p-6 space-y-2">
        {week.wExp.length === 0 && !adding && (
          <p className="text-xs uppercase py-4 text-center" style={{ color: C.gray, letterSpacing: '0.15em' }}>
            Sin gastos cargados todavía
          </p>
        )}
        {week.wExp.map((exp: Expense) => (
          <ExpenseRow key={exp.id} exp={exp} onUpdate={onUpdateExpense} onDelete={onDeleteExpense} />
        ))}

        {adding && (
          <div
            className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3"
            style={{ background: 'rgba(230,57,47,0.06)', border: '0.5px dashed rgba(230,57,47,0.40)', borderRadius: '12px' }}
          >
            <select
              value={newExp.category}
              onChange={e => setNewExp({ ...newExp, category: e.target.value })}
              className="px-3 py-2 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '10px', color: C.cream }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="text"
              placeholder="Descripción"
              value={newExp.description || ''}
              onChange={e => setNewExp({ ...newExp, description: e.target.value })}
              className="px-3 py-2 text-xs outline-none md:col-span-2"
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '10px', color: C.cream }}
            />
            <input
              type="text"
              placeholder="Vendor"
              value={newExp.vendor || ''}
              onChange={e => setNewExp({ ...newExp, vendor: e.target.value })}
              className="px-3 py-2 text-xs outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '10px', color: C.cream }}
            />
            <input
              type="number"
              placeholder="Monto"
              value={newExp.amount_estimated || ''}
              onChange={e => setNewExp({ ...newExp, amount_estimated: Number(e.target.value) })}
              className="px-3 py-2 text-xs outline-none tabular-nums"
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '10px', color: C.cream }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onAddExpense(newExp);
                  setNewExp({ category: CATEGORIES[0], amount_estimated: 0, status: 'estimated' });
                  setAdding(false);
                }}
                className="flex-1 text-[10px] uppercase"
                style={{ background: C.red, color: '#fff', borderRadius: '10px', fontWeight: 600, letterSpacing: '0.15em' }}
              >
                <Save size={11} className="inline mr-1" />
                Guardar
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-3 text-[10px] uppercase"
                style={{ background: 'rgba(255,255,255,0.06)', color: C.gray, borderRadius: '10px', fontWeight: 600 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase"
            style={{
              background: 'transparent',
              border: '0.5px dashed rgba(255,255,255,0.15)',
              color: C.gray,
              borderRadius: '12px',
              letterSpacing: '0.2em',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={11} /> Agregar gasto
          </button>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ exp, onUpdate, onDelete }: {
  exp: Expense;
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
}) {
  const statusColor = { estimated: C.gray, committed: C.orange, paid: C.green }[exp.status];
  return (
    <div className="flex items-center gap-3 py-2.5 px-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
      <span className="text-[10px] uppercase px-2 py-0.5 flex-shrink-0"
        style={{
          background: `${statusColor}20`,
          color: statusColor,
          letterSpacing: '0.2em',
          borderRadius: '999px',
          fontWeight: 600,
        }}
      >
        {exp.category}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] truncate" style={{ color: C.cream }}>{exp.description || '—'}</p>
        {exp.vendor && <p className="text-[9px]" style={{ color: C.gray }}>{exp.vendor}</p>}
      </div>
      <select
        value={exp.status}
        onChange={e => onUpdate(exp.id, { status: e.target.value as any })}
        className="px-2 py-1 text-[10px] outline-none"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `0.5px solid ${statusColor}40`,
          color: statusColor,
          borderRadius: '999px',
          letterSpacing: '0.15em',
        }}
      >
        <option value="estimated">Estimado</option>
        <option value="committed">Comprometido</option>
        <option value="paid">Pagado</option>
      </select>
      <span className="text-sm tabular-nums" style={{ color: C.cream, fontWeight: 600 }}>
        {fmt(exp.amount_actual ?? exp.amount_estimated)}
      </span>
      <button onClick={() => onDelete(exp.id)} className="p-1" style={{ color: C.gray, cursor: 'pointer' }} title="Eliminar">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function Mini({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 500 }}>{label}</p>
      <p className="tabular-nums" style={{
        color,
        fontFamily: bold ? "'Poiret One', sans-serif" : "'Archivo', sans-serif",
        fontSize: bold ? 18 : 13,
        fontWeight: bold ? 300 : 600,
      }}>{value}</p>
    </div>
  );
}

function StatBlock({ label, value, accent, negative }: { label: string; value: string; accent?: boolean; negative?: boolean }) {
  return (
    <div className="p-4" style={{
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.035)',
      border: `0.5px solid ${negative ? 'rgba(230,57,47,0.30)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <p className="text-[9px] uppercase mb-2" style={{ color: accent ? C.red : C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
        {label}
      </p>
      <p className="text-2xl tabular-nums" style={{
        color: negative ? C.red : accent ? C.red : C.cream,
        fontFamily: "'Poiret One', sans-serif", fontWeight: 300,
      }}>
        {value}
      </p>
    </div>
  );
}
