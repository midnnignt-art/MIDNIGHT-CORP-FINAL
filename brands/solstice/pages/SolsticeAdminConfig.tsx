import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Calendar, DollarSign, Percent, Bell, Users,
  Save, Plus, Loader2, CheckCircle2, Copy, ToggleLeft, ToggleRight,
  Trash2, Edit2, X, Search, ExternalLink
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981' };

// ── Types ────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed';
  tagline: string;
  entry_price: number;
  combo_total: number;
  installments: number;
  phase1_price: number | null;
  phase1_limit: number | null;
  phase2_price: number | null;
  early_bird_price: number | null;
  early_bird_deadline: string | null;
  penalty_catamaran_at: number;
  warning_days_before: number;
  commission_pct: number;
  manager_commission_pct: number;
}

interface Week {
  id: string;
  season_id: string;
  university: string;
  start_date: string;
  end_date: string;
  capacity: number;
  reserved?: number;
}

interface Seller {
  id: string;
  user_id: string;
  university: string;
  role: 'seller' | 'manager';
  ref_code: string;
  status: 'active' | 'inactive';
  name?: string;
  email?: string;
  sales?: number;
}

interface MidnightPromoter {
  user_id: string;
  name: string;
  email: string;
  code: string;
}

type Tab = 'general' | 'weeks' | 'prices' | 'commissions' | 'penalties' | 'sellers';

// ── Helpers ──────────────────────────────────────────────────────────────────

function genRefCode(name: string): string {
  const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  return `SOL-${base}-${Math.floor(Math.random() * 900 + 100)}`;
}

function InputRow({ label, value, onChange, type = 'text', prefix }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; prefix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>{label}</label>
      <div className="flex items-center" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
        {prefix && <span className="px-3 text-xs" style={{ color: C.gray, borderRight: `1px solid ${C.gray}20` }}>{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent"
          style={{ color: C.cream }}
          onFocus={e => (e.currentTarget.parentElement!.style.borderColor = C.red)}
          onBlur={e => (e.currentTarget.parentElement!.style.borderColor = `${C.gray}20`)}
        />
      </div>
    </div>
  );
}

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 py-2">
      {active
        ? <ToggleRight size={22} style={{ color: C.red }} />
        : <ToggleLeft size={22} style={{ color: C.gray }} />}
      <span className="text-xs uppercase tracking-widest" style={{ color: active ? C.cream : C.gray }}>{label}</span>
    </button>
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-6 py-2.5 text-xs uppercase font-black tracking-widest transition-all disabled:opacity-40"
      style={{ background: C.red, color: C.cream }}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      Guardar
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SolsticeAdminConfig() {
  const [tab, setTab] = useState<Tab>('general');
  const [season, setSeason] = useState<Season | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Phases / early bird toggles
  const [phasesOn, setPhasesOn] = useState(false);
  const [earlyBirdOn, setEarlyBirdOn] = useState(false);

  // Day prices (kept separate from season for clarity)
  const [dayPrices, setDayPrices] = useState([70000, 70000, 130000, 100000, 70000]);

  // Seller modal
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<MidnightPromoter[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newSeller, setNewSeller] = useState<Partial<Seller & { name: string; email: string }>>({
    university: 'Javeriana', role: 'seller', ref_code: '',
  });

  // ── Load data ──
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: w }, { data: sl }] = await Promise.all([
        supabase.from('solstice_seasons').select('*').eq('status', 'open').single(),
        supabase.from('solstice_weeks').select('*').order('start_date'),
        supabase.from('solstice_sellers').select('*').order('created_at'),
      ]);

      if (s) {
        setSeason(s as Season);
        setPhasesOn(!!s.phase1_price);
        setEarlyBirdOn(!!s.early_bird_price);
      } else {
        // Fallback mock
        setSeason({
          id: '', name: 'SOLSTICE 2026', status: 'open',
          tagline: 'SELECTED BEATS. PRIVATE SUNSET.',
          entry_price: 40000, combo_total: 400000, installments: 5,
          phase1_price: null, phase1_limit: null, phase2_price: null,
          early_bird_price: null, early_bird_deadline: null,
          penalty_catamaran_at: 1, warning_days_before: 15,
          commission_pct: 10, manager_commission_pct: 3,
        });
      }

      if (w?.length) setWeeks(w as Week[]);
      else setWeeks([
        { id: 'w1', season_id: '', university: 'Javeriana',  start_date: '2026-09-14', end_date: '2026-09-20', capacity: 120 },
        { id: 'w2', season_id: '', university: 'Los Andes',  start_date: '2026-09-28', end_date: '2026-10-03', capacity: 120 },
        { id: 'w3', season_id: '', university: 'CESA',        start_date: '2026-10-05', end_date: '2026-10-11', capacity: 80  },
      ]);

      // Enrich sellers with promoter names
      if (sl?.length) {
        const enriched = await Promise.all(sl.map(async (seller: any) => {
          const { data: p } = await supabase
            .from('promoters').select('name, email, total_sales')
            .eq('user_id', seller.user_id).maybeSingle();
          return { ...seller, name: p?.name, email: p?.email, sales: p?.total_sales };
        }));
        setSellers(enriched as Seller[]);
      }
    } catch { /* tables might not exist yet */ }
    finally { setLoading(false); }
  };

  // ── Save handlers ──
  const saveSeason = async () => {
    if (!season) return;
    setSaving(true);
    const payload = {
      ...season,
      phase1_price: phasesOn ? season.phase1_price : null,
      phase1_limit: phasesOn ? season.phase1_limit : null,
      phase2_price: phasesOn ? season.phase2_price : null,
      early_bird_price: earlyBirdOn ? season.early_bird_price : null,
      early_bird_deadline: earlyBirdOn ? season.early_bird_deadline : null,
    };
    const { error } = season.id
      ? await supabase.from('solstice_seasons').update(payload).eq('id', season.id)
      : await supabase.from('solstice_seasons').insert(payload);
    setSaving(false);
    if (error) toast.error('Error guardando: ' + error.message);
    else toast.success('Temporada guardada');
  };

  const saveWeeks = async () => {
    setSaving(true);
    for (const week of weeks) {
      const { error } = week.id && !week.id.startsWith('w')
        ? await supabase.from('solstice_weeks').update({
            university: week.university, start_date: week.start_date,
            end_date: week.end_date, capacity: week.capacity,
          }).eq('id', week.id)
        : await supabase.from('solstice_weeks').insert({
            season_id: season?.id, university: week.university,
            start_date: week.start_date, end_date: week.end_date, capacity: week.capacity,
          });
      if (error) { toast.error(`Error en semana ${week.university}`); setSaving(false); return; }
    }
    setSaving(false);
    toast.success('Semanas guardadas');
  };

  const toggleSellerStatus = async (seller: Seller) => {
    const next = seller.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('solstice_sellers').update({ status: next }).eq('id', seller.id);
    if (error) { toast.error('Error actualizando estado'); return; }
    setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, status: next } : s));
  };

  const copyLink = (refCode: string) => {
    navigator.clipboard.writeText(`https://midnightcorp.click/solstice?ref=${refCode}`);
    toast.success('Link copiado');
  };

  // ── Seller search ──
  const searchPromoters = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase
      .from('promoters').select('user_id, name, email, code')
      .ilike('name', `%${q}%`).limit(8);
    setSearchResults((data || []) as MidnightPromoter[]);
    setSearchLoading(false);
  };

  const selectPromoterForSeller = (p: MidnightPromoter) => {
    setNewSeller(prev => ({
      ...prev, user_id: p.user_id, name: p.name, email: p.email,
      ref_code: prev.ref_code || genRefCode(p.name),
    }));
    setSearchResults([]);
    setSearchQ(p.name);
  };

  const addSeller = async () => {
    if (!newSeller.user_id || !newSeller.ref_code) {
      toast.error('Selecciona un promotor y verifica el código');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('solstice_sellers').insert({
      user_id: newSeller.user_id,
      season_id: season?.id,
      university: newSeller.university,
      role: newSeller.role,
      ref_code: newSeller.ref_code,
      status: 'active',
    });
    setSaving(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Vendedor agregado');
    setAddSellerOpen(false);
    setNewSeller({ university: 'Javeriana', role: 'seller', ref_code: '' });
    setSearchQ('');
    loadAll();
  };

  // ── Update helpers ──
  const upSeason = (key: keyof Season, val: any) =>
    setSeason(prev => prev ? { ...prev, [key]: val } : prev);
  const upWeek = (idx: number, key: keyof Week, val: any) =>
    setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, [key]: val } : w));

  // ── Tabs config ──
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',     label: 'General',     icon: <Settings size={14} /> },
    { id: 'weeks',       label: 'Semanas',      icon: <Calendar size={14} /> },
    { id: 'prices',      label: 'Precios',      icon: <DollarSign size={14} /> },
    { id: 'commissions', label: 'Comisiones',   icon: <Percent size={14} /> },
    { id: 'penalties',   label: 'Penalidades',  icon: <Bell size={14} /> },
    { id: 'sellers',     label: 'Vendedores',   icon: <Users size={14} /> },
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
        <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>
          Administración
        </p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em' }}>
          Configuración de Temporada
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {season?.name || 'SOLSTICE 2026'} · {season?.status?.toUpperCase()}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto px-8 pt-4 gap-1" style={{ borderBottom: `1px solid ${C.gray}15` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-3 text-[10px] uppercase tracking-widest whitespace-nowrap transition-all relative"
            style={{ color: tab === t.id ? C.cream : `${C.gray}`, borderBottom: tab === t.id ? `2px solid ${C.red}` : '2px solid transparent' }}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-8 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── TAB: GENERAL ── */}
            {tab === 'general' && season && (
              <div className="space-y-6">
                <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Información de la temporada</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputRow label="Nombre" value={season.name} onChange={v => upSeason('name', v)} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Estado</label>
                    <select value={season.status} onChange={e => upSeason('status', e.target.value)}
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                      <option value="draft">Borrador</option>
                      <option value="open">Abierta</option>
                      <option value="closed">Cerrada</option>
                    </select>
                  </div>
                </div>
                <InputRow label="Tagline (visible en landing)" value={season.tagline} onChange={v => upSeason('tagline', v)} />
                <div className="pt-4">
                  <SaveBtn loading={saving} onClick={saveSeason} />
                </div>
              </div>
            )}

            {/* ── TAB: SEMANAS ── */}
            {tab === 'weeks' && (
              <div className="space-y-6">
                <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Semanas universitarias</h2>
                <div className="space-y-4">
                  {weeks.map((week, idx) => (
                    <div key={week.id} className="p-5" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                      <p className="text-xs uppercase font-bold mb-4" style={{ color: C.red, letterSpacing: '0.2em' }}>
                        {week.university}
                        {week.reserved !== undefined && (
                          <span className="ml-3 text-[9px]" style={{ color: C.gray }}>
                            {week.reserved}/{week.capacity} vendidos
                          </span>
                        )}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <InputRow label="Universidad" value={week.university} onChange={v => upWeek(idx, 'university', v)} />
                        <InputRow label="Fecha inicio" value={week.start_date} onChange={v => upWeek(idx, 'start_date', v)} type="date" />
                        <InputRow label="Fecha fin" value={week.end_date} onChange={v => upWeek(idx, 'end_date', v)} type="date" />
                        <InputRow label="Cupos" value={week.capacity} onChange={v => upWeek(idx, 'capacity', Number(v))} type="number" />
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setWeeks(prev => [...prev, {
                  id: `new-${Date.now()}`, season_id: season?.id || '', university: 'Nueva',
                  start_date: '2026-10-12', end_date: '2026-10-18', capacity: 100,
                }])}
                  className="flex items-center gap-2 text-xs uppercase tracking-widest transition-all"
                  style={{ color: `${C.gray}` }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                  <Plus size={14} /> Agregar semana
                </button>
                <div className="pt-2">
                  <SaveBtn loading={saving} onClick={saveWeeks} />
                </div>
              </div>
            )}

            {/* ── TAB: PRECIOS ── */}
            {tab === 'prices' && season && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Precios base</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputRow label="Precio de reserva (entrada)" value={season.entry_price} onChange={v => upSeason('entry_price', Number(v))} type="number" prefix="$" />
                    <InputRow label="Precio combo total" value={season.combo_total} onChange={v => upSeason('combo_total', Number(v))} type="number" prefix="$" />
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Número de cuotas</label>
                      <div className="px-3 py-2.5 text-xs flex items-center gap-2" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                        <input type="number" value={season.installments} onChange={e => upSeason('installments', Number(e.target.value))}
                          className="w-16 bg-transparent outline-none" style={{ color: C.cream }} />
                        <span style={{ color: C.gray }}>× ${Math.round(season.combo_total / season.installments / 1000)}K/mes</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <Toggle label="Sistema de fases de precio" active={phasesOn} onToggle={() => setPhasesOn(p => !p)} />
                  {phasesOn && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-2">
                      <InputRow label="Precio fase 1" value={season.phase1_price || ''} onChange={v => upSeason('phase1_price', Number(v))} type="number" prefix="$" />
                      <InputRow label="Límite cupos fase 1" value={season.phase1_limit || ''} onChange={v => upSeason('phase1_limit', Number(v))} type="number" />
                      <InputRow label="Precio fase 2" value={season.phase2_price || ''} onChange={v => upSeason('phase2_price', Number(v))} type="number" prefix="$" />
                    </div>
                  )}
                </div>

                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <Toggle label="Early bird" active={earlyBirdOn} onToggle={() => setEarlyBirdOn(p => !p)} />
                  {earlyBirdOn && (
                    <div className="grid grid-cols-2 gap-4 pl-2">
                      <InputRow label="Precio early bird" value={season.early_bird_price || ''} onChange={v => upSeason('early_bird_price', Number(v))} type="number" prefix="$" />
                      <InputRow label="Fecha límite early bird" value={season.early_bird_deadline?.split('T')[0] || ''} onChange={v => upSeason('early_bird_deadline', v)} type="date" />
                    </div>
                  )}
                </div>

                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Precios por día individual</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {['Llegada', 'Día libre', 'Catamarán', 'Playa privada', 'Cierre'].map((name, i) => (
                      <InputRow key={i} label={`Día ${i + 1} · ${name}`} value={dayPrices[i]}
                        onChange={v => setDayPrices(prev => prev.map((p, pi) => pi === i ? Number(v) : p))}
                        type="number" prefix="$" />
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <SaveBtn loading={saving} onClick={saveSeason} />
                </div>
              </div>
            )}

            {/* ── TAB: COMISIONES ── */}
            {tab === 'commissions' && season && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Porcentajes de comisión</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InputRow label="Comisión vendedor (%)" value={season.commission_pct} onChange={v => upSeason('commission_pct', Number(v))} type="number" prefix="%" />
                    <InputRow label="Comisión gerente (%)" value={season.manager_commission_pct} onChange={v => upSeason('manager_commission_pct', Number(v))} type="number" prefix="%" />
                  </div>
                  <div className="p-4 text-xs space-y-1" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <p style={{ color: C.gray }}>
                      Por cada venta de combo completo (${Math.round(season.combo_total / 1000)}K):
                    </p>
                    <p>Comisión vendedor: <strong style={{ color: C.red }}>
                      ${Math.round(season.combo_total * season.commission_pct / 100 / 1000)}K
                    </strong></p>
                    <p>Comisión gerente: <strong style={{ color: C.red }}>
                      ${Math.round(season.combo_total * season.manager_commission_pct / 100 / 1000)}K
                    </strong></p>
                  </div>
                </div>

                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Criterio de devengo</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Por cuota recibida', sub: 'Comisión se acumula con cada pago' },
                      { label: 'Combo completado',   sub: 'Comisión se paga al finalizar todas las cuotas' },
                    ].map((opt, i) => (
                      <button key={i} className="p-4 text-left transition-all"
                        style={{ background: i === 0 ? `${C.red}12` : C.bgS, border: `1px solid ${i === 0 ? C.red + '50' : C.gray + '20'}` }}>
                        <p className="text-xs uppercase font-bold mb-1" style={{ letterSpacing: '0.12em', color: i === 0 ? C.red : C.cream }}>{opt.label}</p>
                        <p className="text-[10px]" style={{ color: C.gray }}>{opt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <SaveBtn loading={saving} onClick={saveSeason} />
                </div>
              </div>
            )}

            {/* ── TAB: PENALIDADES ── */}
            {tab === 'penalties' && season && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Recordatorios automáticos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputRow label="Días antes del vencimiento (primer aviso)" value={season.warning_days_before} onChange={v => upSeason('warning_days_before', Number(v))} type="number" />
                    <InputRow label="Días después para alertar al vendedor" value={7} onChange={() => {}} type="number" />
                  </div>
                </div>

                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>Penalidades por mora</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>
                        Cuotas pendientes para perder Catamarán (Día 3)
                      </label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                        <input type="number" value={season.penalty_catamaran_at}
                          onChange={e => upSeason('penalty_catamaran_at', Number(e.target.value))}
                          className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuota(s) en mora</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>
                        Cuotas pendientes para perder 2 eventos
                      </label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                        <input type="number" defaultValue={2}
                          className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuotas(s) en mora</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-[10px] leading-relaxed uppercase" style={{ background: C.bgS, border: `1px solid ${C.red}20`, color: C.gray, letterSpacing: '0.12em' }}>
                    Con {season.penalty_catamaran_at} cuota(s) en mora al llegar el evento, el comprador pierde acceso al Catamarán (Día 3). El sistema envía aviso {season.warning_days_before} días antes del evento.
                  </div>
                </div>

                <div className="pt-2">
                  <SaveBtn loading={saving} onClick={saveSeason} />
                </div>
              </div>
            )}

            {/* ── TAB: VENDEDORES ── */}
            {tab === 'sellers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm uppercase tracking-widest" style={{ color: C.gray }}>
                    Equipo de ventas · {sellers.length} activos
                  </h2>
                  <button onClick={() => setAddSellerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-black tracking-widest transition-all"
                    style={{ border: `1px solid ${C.red}40`, color: C.red }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${C.red}12`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                    <Plus size={13} /> Agregar vendedor
                  </button>
                </div>

                {sellers.length === 0 ? (
                  <div className="py-16 text-center" style={{ color: C.gray }}>
                    <Users size={32} className="mx-auto mb-4 opacity-30" />
                    <p className="text-xs uppercase tracking-widest">No hay vendedores asignados a SOLSTICE aún</p>
                  </div>
                ) : (
                  <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[9px] uppercase tracking-widest" style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                      <div className="col-span-3">Nombre</div>
                      <div className="col-span-2">Universidad</div>
                      <div className="col-span-2">Rol</div>
                      <div className="col-span-3">Código ref</div>
                      <div className="col-span-2 text-right">Acciones</div>
                    </div>
                    {sellers.map(seller => (
                      <div key={seller.id} className="grid grid-cols-12 gap-2 px-5 py-4 items-center"
                        style={{ borderBottom: `1px solid ${C.gray}08`, opacity: seller.status === 'inactive' ? 0.45 : 1 }}>
                        <div className="col-span-3">
                          <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.1em' }}>{seller.name || seller.user_id.slice(0, 8)}</p>
                          <p className="text-[9px]" style={{ color: C.gray }}>{seller.email}</p>
                        </div>
                        <div className="col-span-2 text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.1em' }}>
                          {seller.university}
                        </div>
                        <div className="col-span-2">
                          <span className="text-[9px] uppercase px-2 py-0.5 rounded-sm font-bold"
                            style={{ background: seller.role === 'manager' ? `${C.red}20` : `${C.gray}15`, color: seller.role === 'manager' ? C.red : C.gray }}>
                            {seller.role === 'manager' ? 'Gerente' : 'Vendedor'}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <code className="text-[10px] px-2 py-0.5" style={{ background: `${C.gray}15`, color: C.cream }}>
                            {seller.ref_code}
                          </code>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 justify-end">
                          <button onClick={() => copyLink(seller.ref_code)} title="Copiar link"
                            className="p-1.5 rounded transition-colors" style={{ color: C.gray }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => window.open(`https://midnightcorp.click/solstice?ref=${seller.ref_code}`, '_blank')}
                            title="Ver link" className="p-1.5 rounded transition-colors" style={{ color: C.gray }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                            onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                            <ExternalLink size={13} />
                          </button>
                          <button onClick={() => toggleSellerStatus(seller)} title={seller.status === 'active' ? 'Desactivar' : 'Activar'}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: seller.status === 'active' ? C.red : C.green }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                            {seller.status === 'active' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Add Seller Modal ── */}
      <AnimatePresence>
        {addSellerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm"
              onClick={() => setAddSellerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-lg p-8 space-y-5"
              style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.12em' }}>
                  Agregar vendedor
                </h3>
                <button onClick={() => setAddSellerOpen(false)} style={{ color: C.gray }}>
                  <X size={18} />
                </button>
              </div>

              {/* Search promoters */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>
                  Buscar promotor existente de Midnight
                </label>
                <div className="relative flex items-center" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                  <Search size={13} className="ml-3" style={{ color: C.gray }} />
                  <input placeholder="Nombre del promotor..." value={searchQ}
                    onChange={e => searchPromoters(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: C.cream }} />
                  {searchLoading && <Loader2 size={13} className="mr-3 animate-spin" style={{ color: C.gray }} />}
                </div>
                {searchResults.length > 0 && (
                  <div className="border" style={{ border: `1px solid ${C.gray}20`, background: C.bgT }}>
                    {searchResults.map(p => (
                      <button key={p.user_id} onClick={() => selectPromoterForSeller(p)}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors">
                        <div>
                          <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.08em' }}>{p.name}</p>
                          <p className="text-[9px]" style={{ color: C.gray }}>{p.email} · código: {p.code}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Universidad</label>
                  <select value={newSeller.university} onChange={e => setNewSeller(p => ({ ...p, university: e.target.value }))}
                    className="px-3 py-2.5 text-xs outline-none"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                    <option>Javeriana</option>
                    <option>Los Andes</option>
                    <option>CESA</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Rol</label>
                  <select value={newSeller.role} onChange={e => setNewSeller(p => ({ ...p, role: e.target.value as any }))}
                    className="px-3 py-2.5 text-xs outline-none"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                    <option value="seller">Vendedor</option>
                    <option value="manager">Gerente</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Código referido (editable)</label>
                <div className="flex gap-2">
                  <input value={newSeller.ref_code || ''} onChange={e => setNewSeller(p => ({ ...p, ref_code: e.target.value.toUpperCase() }))}
                    placeholder="SOL-NOMBRE-123" className="flex-1 px-3 py-2.5 text-xs outline-none font-mono"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }} />
                  <button onClick={() => setNewSeller(p => ({ ...p, ref_code: genRefCode(searchQ || 'VEND') }))}
                    className="px-3 text-[9px] uppercase" style={{ background: `${C.gray}15`, color: C.gray }}>
                    Auto
                  </button>
                </div>
              </div>

              {newSeller.ref_code && (
                <div className="p-3 text-[10px]" style={{ background: `${C.red}10`, border: `1px solid ${C.red}20` }}>
                  <span style={{ color: C.gray }}>Link: </span>
                  <span style={{ color: C.cream }}>midnightcorp.click/solstice?ref={newSeller.ref_code}</span>
                </div>
              )}

              <button onClick={addSeller} disabled={saving || !newSeller.user_id || !newSeller.ref_code}
                className="w-full py-3 text-xs uppercase font-black tracking-widest transition-all disabled:opacity-40"
                style={{ background: C.red, color: C.cream }}>
                {saving ? <Loader2 className="animate-spin mx-auto" size={14} /> : 'Agregar vendedor'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
