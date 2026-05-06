import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Calendar, DollarSign, Percent, Bell, Users,
  Save, Plus, Loader2, Copy, ToggleLeft, ToggleRight,
  X, Search, ExternalLink, Image, Star
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', bgS: '#0d0d0d', bgT: '#111', red: '#E6392F', gray: '#606060', cream: '#F9F2D7', green: '#10b981' };

// ── Types ──────────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed';
  tagline: string;
  entry_price: number;
  // Combo completo
  combo_total: number;
  installments: number;
  combo_days: number[];
  // Combo 1
  combo1_total: number;
  combo1_installments: number;
  combo1_days: number[];
  // Fases de precio
  phase1_limit: number | null;
  phase_increment: number | null;
  phase_increment_type: 'fixed' | 'percent';
  // Early bird (legacy, keep for compat)
  phase1_price: number | null;
  phase2_price: number | null;
  early_bird_price: number | null;
  early_bird_deadline: string | null;
  // Penalidades
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

interface ProgramDay {
  id: string;
  season_id: string;
  day_number: number;
  title: string;
  subtitle: string;
  price: number;           // digital / base
  price_cash: number;      // efectivo al vendedor
  price_combo: number;     // aporte al combo
  price_monthly: number;   // aporte mensual
  image_url: string;
  highlight: boolean;
}

interface Seller {
  id: string;
  user_id: string;
  university: string;
  role: 'seller' | 'manager';
  ref_code: string;
  status: 'active' | 'inactive';
  sales_team_id?: string;
  super_squad_id?: string;
  // enriched
  name?: string;
  email?: string;
  team_name?: string;
  squad_name?: string;
}

interface MidnightPromoter {
  user_id: string;
  name: string;
  email: string;
  code: string;
  sales_team_id?: string;
  super_squad_id?: string;
  team_name?: string;
  squad_name?: string;
}

type Tab = 'general' | 'weeks' | 'prices' | 'commissions' | 'penalties' | 'sellers';

// ── Default days ───────────────────────────────────────────────────────────────

const DEFAULT_DAYS: Omit<ProgramDay, 'id' | 'season_id'>[] = [
  { day_number: 1, title: 'Llegada',       subtitle: 'Apertura nocturna',         price: 70000,  price_cash: 70000,  price_combo: 70000,  price_monthly: 70000,  image_url: '', highlight: false },
  { day_number: 2, title: 'Día libre',     subtitle: 'Fiesta nocturna',           price: 70000,  price_cash: 70000,  price_combo: 70000,  price_monthly: 70000,  image_url: '', highlight: false },
  { day_number: 3, title: 'Catamarán',     subtitle: '50 p · DJ · AYCD · Bahía', price: 130000, price_cash: 135000, price_combo: 130000, price_monthly: 130000, image_url: '', highlight: true  },
  { day_number: 4, title: 'Playa privada', subtitle: 'All you can drink',         price: 100000, price_cash: 105000, price_combo: 100000, price_monthly: 100000, image_url: '', highlight: false },
  { day_number: 5, title: 'Cierre',        subtitle: 'Última noche',              price: 70000,  price_cash: 70000,  price_combo: 70000,  price_monthly: 70000,  image_url: '', highlight: false },
];

// ── Sanitizers ─────────────────────────────────────────────────────────────────
const toInt = (v: any): number => { const n = parseInt(String(v), 10); return isNaN(n) ? 0 : n; };
const toIntOrNull = (v: any): number | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
};
const toDateOrNull = (v: any): string | null =>
  (!v || String(v).trim() === '') ? null : String(v);
const toStrOrNull = (v: any): string | null =>
  (!v || String(v).trim() === '') ? null : String(v);

// ── Helpers ───────────────────────────────────────────────────────────────────

function genRefCode(name: string): string {
  const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  return `SOL-${base}-${Math.floor(Math.random() * 900 + 100)}`;
}

function InputRow({ label, value, onChange, type = 'text', prefix, placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; prefix?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>{label}</label>
      <div className="flex items-center" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
        {prefix && <span className="px-3 text-xs shrink-0" style={{ color: C.gray, borderRight: `1px solid ${C.gray}20` }}>{prefix}</span>}
        <input
          type={type} value={value} placeholder={placeholder || ''}
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
      {active ? <ToggleRight size={22} style={{ color: C.red }} /> : <ToggleLeft size={22} style={{ color: C.gray }} />}
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

function PriceSection({ title, subtitle, onSave, saving, children }: {
  title: string; subtitle: string; onSave: () => void; saving: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-8" style={{ borderBottom: `1px solid ${C.gray}12` }}>
      <div>
        <h2 className="text-sm uppercase font-black tracking-widest" style={{ color: C.cream, letterSpacing: '0.15em' }}>{title}</h2>
        <p className="text-[10px] uppercase mt-0.5" style={{ color: C.gray, letterSpacing: '0.18em' }}>{subtitle}</p>
      </div>
      <div>{children}</div>
      <div className="pt-1"><SaveBtn loading={saving} onClick={onSave} /></div>
    </div>
  );
}

function DaySelector({ selected, onChange, days }: {
  selected: number[]; onChange: (days: number[]) => void; days: ProgramDay[];
}) {
  const toggle = (n: number) => {
    if (selected.includes(n)) onChange(selected.filter(d => d !== n));
    else onChange([...selected, n].sort((a, b) => a - b));
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Días incluidos</label>
      <div className="flex flex-wrap gap-2">
        {days.map(day => {
          const active = selected.includes(day.day_number);
          return (
            <button key={day.day_number} type="button" onClick={() => toggle(day.day_number)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all"
              style={{
                background: active ? `${C.red}20` : `${C.gray}10`,
                border: `1px solid ${active ? C.red + '60' : C.gray + '20'}`,
                color: active ? C.red : C.gray,
              }}>
              <span className="font-black text-[9px]">D{day.day_number}</span>
              <span>{day.title}</span>
              {day.highlight && <span style={{ color: C.red }}>★</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[9px] uppercase" style={{ color: `${C.gray}60` }}>
        {selected.length} día{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── Image upload helper (Supabase Storage) ─────────────────────────────────────

async function uploadDayImage(file: File, dayNumber: number): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `solstice/days/dia-${dayNumber}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
  if (error) {
    // Storage bucket might not exist — return null, user can paste URL manually
    console.warn('Storage upload failed:', error.message);
    return null;
  }
  const { data } = supabase.storage.from('assets').getPublicUrl(path);
  return data.publicUrl;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SolsticeAdminConfig() {
  const [tab, setTab]         = useState<Tab>('general');
  const [season, setSeason]   = useState<Season | null>(null);
  const [weeks, setWeeks]     = useState<Week[]>([]);
  const [days, setDays]       = useState<ProgramDay[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [phasesOn, setPhasesOn]       = useState(false);
  const [earlyBirdOn, setEarlyBirdOn] = useState(false);

  // Seller modal
  const [addSellerOpen, setAddSellerOpen] = useState(false);
  const [searchQ, setSearchQ]             = useState('');
  const [searchResults, setSearchResults] = useState<MidnightPromoter[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [newSeller, setNewSeller]         = useState<Partial<Seller>>({
    university: 'Javeriana', role: 'seller', ref_code: '',
  });

  // Image upload refs
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: w }, { data: d }, { data: sl }] = await Promise.all([
        supabase.from('solstice_seasons').select('*').eq('status', 'open').single(),
        supabase.from('solstice_weeks').select('*').order('start_date'),
        supabase.from('solstice_program_days').select('*').order('day_number'),
        supabase.from('solstice_sellers').select('*').order('created_at'),
      ]);

      if (s) {
        setSeason({
          combo1_total: 300000, combo1_installments: 5, combo1_days: [1,2,4,5],
          combo_days: [1,2,3,4,5],
          phase_increment: null, phase_increment_type: 'fixed',
          ...s,
        } as Season);
        setPhasesOn(!!(s as any).phase1_limit);
        setEarlyBirdOn(!!s.early_bird_price);
      } else {
        setSeason({
          id: '', name: 'SOLSTICE 2026', status: 'open', tagline: 'SELECTED BEATS. PRIVATE SUNSET.',
          entry_price: 40000,
          combo_total: 400000,   installments: 5,      combo_days: [1,2,3,4,5],
          combo1_total: 300000,  combo1_installments: 5, combo1_days: [1,2,4,5],
          phase1_limit: null,    phase_increment: null, phase_increment_type: 'fixed',
          phase1_price: null,    phase2_price: null,
          early_bird_price: null, early_bird_deadline: null,
          penalty_catamaran_at: 1, warning_days_before: 15,
          commission_pct: 10, manager_commission_pct: 3,
        });
      }

      setWeeks(w?.length ? (w as Week[]) : [
        { id: 'w1', season_id: '', university: 'Javeriana',  start_date: '2026-09-14', end_date: '2026-09-20', capacity: 120 },
        { id: 'w2', season_id: '', university: 'Los Andes',  start_date: '2026-09-28', end_date: '2026-10-03', capacity: 120 },
        { id: 'w3', season_id: '', university: 'CESA',        start_date: '2026-10-05', end_date: '2026-10-11', capacity: 80 },
      ]);

      // Merge DB days with defaults so all 5 are always present
      const dbDays = (d || []) as ProgramDay[];
      const merged = DEFAULT_DAYS.map(def => {
        const found = dbDays.find(x => x.day_number === def.day_number);
        if (found) {
          return {
            ...found,
            price_cash:    found.price_cash    ?? def.price_cash,
            price_combo:   found.price_combo   ?? def.price_combo,
            price_monthly: found.price_monthly ?? def.price_monthly,
            image_url:     found.image_url     ?? '',
          };
        }
        return { ...def, id: `new-${def.day_number}`, season_id: s?.id || '' };
      });
      setDays(merged);

      // Enrich sellers with team/squad info
      if (sl?.length) {
        const [{ data: teams }, { data: squads }] = await Promise.all([
          supabase.from('sales_teams').select('id, name'),
          supabase.from('super_squads').select('id, name'),
        ]);
        const enriched = await Promise.all((sl as any[]).map(async (seller) => {
          const { data: p } = await supabase.from('promoters')
            .select('name, email').eq('user_id', seller.user_id).maybeSingle();
          const team  = (teams || []).find((t: any) => t.id === seller.sales_team_id);
          const squad = (squads || []).find((sq: any) => sq.id === seller.super_squad_id);
          return { ...seller, name: p?.name, email: p?.email, team_name: team?.name, squad_name: squad?.name };
        }));
        setSellers(enriched as Seller[]);
      }
    } catch { /* DB not migrated yet */ }
    finally { setLoading(false); }
  };

  // ── Save season ────────────────────────────────────────────────────────────────
  const saveSeason = async () => {
    if (!season) return;
    setSaving(true);
    const payload = {
      name:                    season.name,
      status:                  season.status,
      tagline:                 season.tagline,
      entry_price:             toInt(season.entry_price),
      combo_total:             toInt(season.combo_total),
      installments:            toInt(season.installments) || 1,
      combo1_total:            toInt(season.combo1_total),
      combo1_installments:     toInt(season.combo1_installments) || 1,
      commission_pct:          toInt(season.commission_pct),
      manager_commission_pct:  toInt(season.manager_commission_pct),
      penalty_catamaran_at:    toInt(season.penalty_catamaran_at),
      warning_days_before:     toInt(season.warning_days_before),
      phase1_limit:            phasesOn ? toIntOrNull(season.phase1_limit)      : null,
      phase_increment:         phasesOn ? toIntOrNull(season.phase_increment)   : null,
      phase_increment_type:    season.phase_increment_type || 'fixed',
      phase1_price:            null,
      phase2_price:            null,
      early_bird_price:        earlyBirdOn ? toIntOrNull(season.early_bird_price) : null,
      early_bird_deadline:     earlyBirdOn ? toDateOrNull(season.early_bird_deadline) : null,
    };
    const { error } = season.id
      ? await supabase.from('solstice_seasons').update(payload).eq('id', season.id)
      : await supabase.from('solstice_seasons').insert({ ...payload, status: 'open' });
    setSaving(false);
    if (error) toast.error('Error: ' + error.message);
    else toast.success('Temporada guardada');
  };

  // ── Save weeks ─────────────────────────────────────────────────────────────────
  const saveWeeks = async () => {
    setSaving(true);
    for (const week of weeks) {
      const isNew = !week.id || week.id.startsWith('new-') || week.id.length < 10;
      const payload = {
        season_id:  season?.id,
        university: week.university,
        start_date: toDateOrNull(week.start_date),
        end_date:   toDateOrNull(week.end_date),
        capacity:   toInt(week.capacity),
      };
      if (!payload.start_date || !payload.end_date) {
        toast.error(`Fechas inválidas en semana ${week.university}`); setSaving(false); return;
      }
      const { error } = isNew
        ? await supabase.from('solstice_weeks').insert(payload)
        : await supabase.from('solstice_weeks').update(payload).eq('id', week.id);
      if (error) { toast.error(`Error semana ${week.university}: ${error.message}`); setSaving(false); return; }
    }
    setSaving(false);
    toast.success('Semanas guardadas');
  };

  // ── Save program days ──────────────────────────────────────────────────────────
  const saveDays = async () => {
    if (!season?.id) { toast.error('Guarda la temporada primero'); return; }
    setSaving(true);
    for (const day of days) {
      const isNew = !day.id || day.id.startsWith('new-');
      const payload = {
        season_id:     season.id,
        day_number:    day.day_number,
        title:         day.title || `Día ${day.day_number}`,
        subtitle:      toStrOrNull(day.subtitle),
        price:         toInt(day.price),
        price_cash:    toIntOrNull(day.price_cash),
        price_combo:   toIntOrNull(day.price_combo),
        price_monthly: toIntOrNull(day.price_monthly),
        image_url:     toStrOrNull(day.image_url),
        highlight:     day.highlight,
      };
      const { error } = isNew
        ? await supabase.from('solstice_program_days').insert(payload)
        : await supabase.from('solstice_program_days').update(payload).eq('id', day.id);
      if (error) { toast.error(`Error día ${day.day_number}: ${error.message}`); setSaving(false); return; }
    }
    setSaving(false);
    await loadAll();
    toast.success('Programa guardado');
  };

  // ── Granular save helpers ──────────────────────────────────────────────────────
  const saveField = async (fields: Partial<Season>, label: string) => {
    if (!season) return;
    setSaving(true);
    const { error } = season.id
      ? await supabase.from('solstice_seasons').update(fields).eq('id', season.id)
      : await supabase.from('solstice_seasons').insert({ ...season, ...fields, status: 'open' });
    setSaving(false);
    if (error) toast.error(`${label}: ${error.message}`);
    else { toast.success(`${label} guardado`); loadAll(); }
  };

  const saveIndividualPrices = () => saveField({
    entry_price: toInt(season?.entry_price),
  }, 'Precio de reserva');

  const saveCombo1 = () => saveField({
    combo1_total:        toInt(season?.combo1_total),
    combo1_installments: toInt(season?.combo1_installments) || 1,
    combo1_days:         season?.combo1_days || [1,2,4,5],
  }, 'Combo 1');

  const saveComboCom = () => saveField({
    combo_total:  toInt(season?.combo_total),
    installments: toInt(season?.installments) || 1,
    combo_days:   season?.combo_days || [1,2,3,4,5],
  }, 'Combo completo');

  const savePhases = () => saveField({
    phase1_limit:         phasesOn ? toIntOrNull(season?.phase1_limit)    : null,
    phase_increment:      phasesOn ? toIntOrNull(season?.phase_increment) : null,
    phase_increment_type: season?.phase_increment_type || 'fixed',
  }, 'Sistema de etapas');

  // ── Image upload ──────────────────────────────────────────────────────────────
  const handleImageFile = async (idx: number, file: File) => {
    const url = await uploadDayImage(file, days[idx].day_number);
    if (url) {
      setDays(prev => prev.map((d, i) => i === idx ? { ...d, image_url: url } : d));
      toast.success('Imagen subida');
    } else {
      toast.error('No se pudo subir. Pega la URL directamente.');
    }
  };

  // ── Toggle seller status ───────────────────────────────────────────────────────
  const toggleSellerStatus = async (seller: Seller) => {
    const next = seller.status === 'active' ? 'inactive' : 'active';
    const { error } = await supabase.from('solstice_sellers').update({ status: next }).eq('id', seller.id);
    if (error) { toast.error('Error actualizando'); return; }
    setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, status: next } : s));
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://midnightcorp.click/solstice?ref=${code}`);
    toast.success('Link copiado');
  };

  // ── Search promoters ───────────────────────────────────────────────────────────
  const searchPromoters = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data: proms } = await supabase
      .from('promoters').select('user_id, name, email, code, sales_team_id, super_squad_id')
      .ilike('name', `%${q}%`).limit(8);

    if (proms?.length) {
      const teamIds   = [...new Set(proms.map((p: any) => p.sales_team_id).filter(Boolean))];
      const squadIds  = [...new Set(proms.map((p: any) => p.super_squad_id).filter(Boolean))];
      const [{ data: teams }, { data: squads }] = await Promise.all([
        teamIds.length  ? supabase.from('sales_teams').select('id, name').in('id', teamIds)  : Promise.resolve({ data: [] }),
        squadIds.length ? supabase.from('super_squads').select('id, name').in('id', squadIds) : Promise.resolve({ data: [] }),
      ]);
      setSearchResults(proms.map((p: any) => ({
        ...p,
        team_name:  (teams  || []).find((t: any) => t.id === p.sales_team_id)?.name,
        squad_name: (squads || []).find((sq: any) => sq.id === p.super_squad_id)?.name,
      })));
    } else {
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const selectPromoter = (p: MidnightPromoter) => {
    setNewSeller(prev => ({
      ...prev,
      user_id: p.user_id,
      name: p.name,
      email: p.email,
      sales_team_id: p.sales_team_id,
      super_squad_id: p.super_squad_id,
      ref_code: prev.ref_code || genRefCode(p.name),
    }));
    setSearchResults([]);
    setSearchQ(p.name);
  };

  const addSeller = async () => {
    if (!newSeller.user_id || !newSeller.ref_code) { toast.error('Selecciona un promotor y verifica el código'); return; }
    setSaving(true);
    const { error } = await supabase.from('solstice_sellers').insert({
      user_id:        newSeller.user_id,
      season_id:      season?.id,
      university:     newSeller.university,
      role:           newSeller.role,
      ref_code:       newSeller.ref_code,
      status:         'active',
      sales_team_id:  newSeller.sales_team_id || null,
      super_squad_id: newSeller.super_squad_id || null,
    });
    setSaving(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Vendedor agregado');
    setAddSellerOpen(false);
    setNewSeller({ university: 'Javeriana', role: 'seller', ref_code: '' });
    setSearchQ('');
    loadAll();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────────
  const upSeason = (key: keyof Season, val: any) => setSeason(prev => prev ? { ...prev, [key]: val } : prev);
  const upWeek   = (idx: number, key: keyof Week, val: any) => setWeeks(prev => prev.map((w, i) => i === idx ? { ...w, [key]: val } : w));
  const upDay    = (idx: number, key: keyof ProgramDay, val: any) => setDays(prev => prev.map((d, i) => i === idx ? { ...d, [key]: val } : d));

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',     label: 'General',    icon: <Settings size={14} /> },
    { id: 'weeks',       label: 'Semanas',     icon: <Calendar size={14} /> },
    { id: 'prices',      label: 'Precios',     icon: <DollarSign size={14} /> },
    { id: 'commissions', label: 'Comisiones',  icon: <Percent size={14} /> },
    { id: 'penalties',   label: 'Penalidades', icon: <Bell size={14} /> },
    { id: 'sellers',     label: 'Vendedores',  icon: <Users size={14} /> },
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
        <p className="text-[9px] uppercase font-bold mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>Administración</p>
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
            className="flex items-center gap-2 px-4 py-3 text-[10px] uppercase tracking-widest whitespace-nowrap transition-all"
            style={{ color: tab === t.id ? C.cream : C.gray, borderBottom: tab === t.id ? `2px solid ${C.red}` : '2px solid transparent' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="px-8 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── GENERAL ── */}
            {tab === 'general' && season && (
              <div className="space-y-6">
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Información de la temporada</h2>
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
                <div className="pt-2"><SaveBtn loading={saving} onClick={saveSeason} /></div>
              </div>
            )}

            {/* ── SEMANAS ── */}
            {tab === 'weeks' && (
              <div className="space-y-6">
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Semanas universitarias</h2>
                <div className="space-y-4">
                  {weeks.map((week, idx) => (
                    <div key={week.id} className="p-5" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                      <p className="text-xs uppercase font-bold mb-4" style={{ color: C.red, letterSpacing: '0.2em' }}>
                        {week.university}
                        {week.reserved !== undefined && <span className="ml-3 text-[9px]" style={{ color: C.gray }}>{week.reserved}/{week.capacity} vendidos</span>}
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
                <button onClick={() => setWeeks(prev => [...prev, { id: `new-${Date.now()}`, season_id: season?.id || '', university: 'Nueva', start_date: '2026-10-12', end_date: '2026-10-18', capacity: 100 }])}
                  className="flex items-center gap-2 text-xs uppercase tracking-widest transition-all" style={{ color: C.gray }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                  <Plus size={14} /> Agregar semana
                </button>
                <div className="pt-2"><SaveBtn loading={saving} onClick={saveWeeks} /></div>
              </div>
            )}

            {/* ── PRECIOS ── */}
            {tab === 'prices' && season && (
              <div className="space-y-10">

                {/* ── 1. Días individuales ── */}
                <PriceSection
                  title="Días individuales"
                  subtitle="Precios cuando el comprador elige días sueltos"
                  onSave={saveDays}
                  saving={saving}>
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="grid grid-cols-12 px-3 py-1.5 text-[8px] uppercase tracking-widest"
                      style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                      <div className="col-span-3">Día</div>
                      <div className="col-span-2 text-center">Digital</div>
                      <div className="col-span-2 text-center">Efectivo</div>
                      <div className="col-span-2 text-center">Aporte combo</div>
                      <div className="col-span-2 text-center">Aporte mensual</div>
                      <div className="col-span-1 text-right">★</div>
                    </div>
                    {days.map((day, idx) => (
                      <div key={day.day_number}
                        className="grid grid-cols-12 items-center gap-1 px-3 py-2"
                        style={{ background: day.highlight ? `${C.red}08` : `${C.gray}05`, border: `1px solid ${day.highlight ? C.red + '25' : C.gray + '12'}` }}>
                        {/* Name + subtitle */}
                        <div className="col-span-3">
                          <input value={day.title} onChange={e => upDay(idx, 'title', e.target.value)}
                            className="w-full bg-transparent text-xs font-bold uppercase outline-none mb-0.5"
                            style={{ color: day.highlight ? C.red : C.cream }}
                            onFocus={e => (e.currentTarget.style.borderBottom = `1px solid ${C.red}`)}
                            onBlur={e => (e.currentTarget.style.borderBottom = 'none')} />
                          <input value={day.subtitle} onChange={e => upDay(idx, 'subtitle', e.target.value)}
                            className="w-full bg-transparent text-[9px] outline-none"
                            style={{ color: C.gray }} placeholder="subtítulo" />
                        </div>
                        {/* Prices */}
                        {(['price', 'price_cash', 'price_combo', 'price_monthly'] as const).map(field => (
                          <div key={field} className="col-span-2">
                            <div className="flex items-center gap-1 px-2 py-1.5"
                              style={{ background: C.bgT, border: `1px solid ${C.gray}15` }}>
                              <span className="text-[9px] shrink-0" style={{ color: C.gray }}>$</span>
                              <input
                                type="number"
                                value={day[field] || ''}
                                onChange={e => upDay(idx, field, e.target.value)}
                                className="w-full bg-transparent text-xs outline-none text-right"
                                style={{ color: C.cream }}
                                onFocus={e => (e.currentTarget.parentElement!.style.borderColor = C.red)}
                                onBlur={e => (e.currentTarget.parentElement!.style.borderColor = `${C.gray}15`)}
                              />
                            </div>
                          </div>
                        ))}
                        {/* Highlight toggle */}
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => upDay(idx, 'highlight', !day.highlight)}
                            title={day.highlight ? 'Quitar destacado' : 'Destacar'}>
                            <Star size={14} fill={day.highlight ? C.red : 'none'} style={{ color: day.highlight ? C.red : `${C.gray}50` }} />
                          </button>
                        </div>
                        {/* Image URL */}
                        <div className="col-span-12 mt-1 flex gap-2 items-center">
                          <Image size={10} className="shrink-0" style={{ color: C.gray }} />
                          <input
                            type="url"
                            value={day.image_url || ''}
                            onChange={e => upDay(idx, 'image_url', e.target.value)}
                            placeholder="URL de imagen (opcional)"
                            className="flex-1 bg-transparent text-[10px] outline-none"
                            style={{ color: C.gray }}
                          />
                          <input ref={el => { fileRefs.current[idx] = el; }} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(idx, f); }} />
                          <button onClick={() => fileRefs.current[idx]?.click()}
                            className="text-[9px] uppercase px-2 py-1 transition-all"
                            style={{ background: `${C.gray}12`, color: C.gray, border: `1px solid ${C.gray}15` }}>
                            Subir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </PriceSection>

                {/* ── 2. Combo 1 ── */}
                <PriceSection
                  title="Combo 1"
                  subtitle={`${(season.combo1_days || []).length} días — personaliza cuáles incluir`}
                  onSave={saveCombo1}
                  saving={saving}>
                  <div className="space-y-4">
                    <DaySelector
                      selected={season.combo1_days || []}
                      onChange={v => upSeason('combo1_days', v)}
                      days={days}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <InputRow label="Precio total" value={season.combo1_total} onChange={v => upSeason('combo1_total', v)} type="number" prefix="$" />
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Cuotas mensuales</label>
                        <div className="flex items-center gap-2 px-3 py-2.5"
                          style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                          <input type="number" value={season.combo1_installments}
                            onChange={e => upSeason('combo1_installments', e.target.value)}
                            className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                          <span className="text-[10px]" style={{ color: C.gray }}>
                            × ${Math.round(season.combo1_total / (season.combo1_installments || 1) / 1000)}K/mes
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-end p-4 gap-1"
                        style={{ background: `${C.gray}08`, border: `1px solid ${C.gray}12` }}>
                        <p className="text-[8px] uppercase" style={{ color: C.gray }}>Reserva inicial</p>
                        <p className="text-xl font-black" style={{ color: C.cream }}>${Math.round(season.entry_price / 1000)}K</p>
                        <p className="text-[8px] uppercase" style={{ color: C.gray }}>+ {season.combo1_installments} cuotas de ${Math.round(season.combo1_total / (season.combo1_installments || 1) / 1000)}K</p>
                      </div>
                    </div>
                  </div>
                </PriceSection>

                {/* ── 3. Combo completo ── */}
                <PriceSection
                  title="Combo completo"
                  subtitle={`${(season.combo_days || []).length} días — personaliza cuáles incluir`}
                  onSave={saveComboCom}
                  saving={saving}>
                  <div className="space-y-4">
                    <DaySelector
                      selected={season.combo_days || []}
                      onChange={v => upSeason('combo_days', v)}
                      days={days}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <InputRow label="Precio total" value={season.combo_total} onChange={v => upSeason('combo_total', v)} type="number" prefix="$" />
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Cuotas mensuales</label>
                        <div className="flex items-center gap-2 px-3 py-2.5"
                          style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                          <input type="number" value={season.installments}
                            onChange={e => upSeason('installments', e.target.value)}
                            className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                          <span className="text-[10px]" style={{ color: C.gray }}>
                            × ${Math.round(season.combo_total / (season.installments || 1) / 1000)}K/mes
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-end p-4 gap-1"
                        style={{ background: `${C.red}08`, border: `1px solid ${C.red}20` }}>
                        <p className="text-[8px] uppercase" style={{ color: `${C.red}90` }}>Reserva inicial</p>
                        <p className="text-xl font-black" style={{ color: C.red }}>${Math.round(season.entry_price / 1000)}K</p>
                        <p className="text-[8px] uppercase" style={{ color: `${C.red}90` }}>+ {season.installments} cuotas de ${Math.round(season.combo_total / (season.installments || 1) / 1000)}K</p>
                      </div>
                    </div>
                  </div>
                </PriceSection>

                {/* ── 4. Sistema de etapas ── */}
                <PriceSection
                  title="Sistema de etapas"
                  subtitle="Sube automáticamente todos los precios después de X reservas. La reserva inicial ($40K) siempre fija."
                  onSave={savePhases}
                  saving={saving}>
                  <Toggle label="Activar sistema de etapas" active={phasesOn} onToggle={() => setPhasesOn(p => !p)} />
                  {phasesOn && (
                    <div className="space-y-4 mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputRow
                          label="Reservas en Fase 1 (límite)"
                          value={season.phase1_limit || ''}
                          onChange={v => upSeason('phase1_limit', v)}
                          type="number"
                          placeholder="ej. 50"
                        />
                        <InputRow
                          label="Incremento de precio"
                          value={season.phase_increment || ''}
                          onChange={v => upSeason('phase_increment', v)}
                          type="number"
                          prefix={season.phase_increment_type === 'percent' ? '%' : '$'}
                          placeholder="ej. 20000"
                        />
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Tipo de incremento</label>
                          <select value={season.phase_increment_type}
                            onChange={e => upSeason('phase_increment_type', e.target.value)}
                            className="px-3 py-2.5 text-xs outline-none"
                            style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                            <option value="fixed">Valor fijo ($)</option>
                            <option value="percent">Porcentaje (%)</option>
                          </select>
                        </div>
                      </div>
                      {season.phase1_limit && season.phase_increment && (
                        <div className="p-4 text-[10px] leading-relaxed uppercase"
                          style={{ background: `${C.red}08`, border: `1px solid ${C.red}20`, color: C.gray, letterSpacing: '0.12em' }}>
                          <span style={{ color: C.cream }}>Fase 1:</span> precio actual hasta {season.phase1_limit} reservas ·{' '}
                          <span style={{ color: C.red }}>
                            Fase 2: sube {season.phase_increment_type === 'percent'
                              ? `${season.phase_increment}%`
                              : `$${Math.round(season.phase_increment / 1000)}K`} en todos los combos e individuales
                          </span>
                          {' '}· La reserva inicial se mantiene en ${Math.round(season.entry_price / 1000)}K
                        </div>
                      )}
                    </div>
                  )}
                </PriceSection>

              </div>
            )}

            {/* ── COMISIONES ── */}
            {tab === 'commissions' && season && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Porcentajes de comisión</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InputRow label="Comisión vendedor (%)" value={season.commission_pct} onChange={v => upSeason('commission_pct', Number(v))} type="number" prefix="%" />
                    <InputRow label="Comisión gerente (%)" value={season.manager_commission_pct} onChange={v => upSeason('manager_commission_pct', Number(v))} type="number" prefix="%" />
                  </div>
                  <div className="p-4 text-xs space-y-1" style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <p style={{ color: C.gray }}>Por combo completo (${Math.round(season.combo_total / 1000)}K):</p>
                    <p>Comisión vendedor: <strong style={{ color: C.red }}>${Math.round(season.combo_total * season.commission_pct / 100 / 1000)}K</strong></p>
                    <p>Comisión gerente: <strong style={{ color: C.red }}>${Math.round(season.combo_total * season.manager_commission_pct / 100 / 1000)}K</strong></p>
                  </div>
                </div>
                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Criterio de devengo</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[['Por cuota recibida', 'Comisión acumulada con cada pago'], ['Combo completado', 'Se paga al cerrar todas las cuotas']].map(([lbl, sub], i) => (
                      <button key={i} className="p-4 text-left transition-all"
                        style={{ background: i === 0 ? `${C.red}12` : C.bgS, border: `1px solid ${i === 0 ? C.red + '50' : C.gray + '20'}` }}>
                        <p className="text-xs uppercase font-bold mb-1" style={{ letterSpacing: '0.12em', color: i === 0 ? C.red : C.cream }}>{lbl}</p>
                        <p className="text-[10px]" style={{ color: C.gray }}>{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pt-2"><SaveBtn loading={saving} onClick={saveSeason} /></div>
              </div>
            )}

            {/* ── PENALIDADES ── */}
            {tab === 'penalties' && season && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Recordatorios automáticos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputRow label="Días antes del vencimiento (primer aviso)" value={season.warning_days_before} onChange={v => upSeason('warning_days_before', Number(v))} type="number" />
                    <InputRow label="Días después sin pago para alertar vendedor" value={7} onChange={() => {}} type="number" />
                  </div>
                </div>
                <div className="space-y-4" style={{ borderTop: `1px solid ${C.gray}10`, paddingTop: '1.5rem' }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Penalidades por mora</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Cuotas en mora para perder Catamarán (Día 3)</label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                        <input type="number" value={season.penalty_catamaran_at} onChange={e => upSeason('penalty_catamaran_at', Number(e.target.value))}
                          className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuota(s)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Cuotas en mora para perder 2 eventos</label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                        <input type="number" defaultValue={2} className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuotas(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-[10px] leading-relaxed uppercase" style={{ background: C.bgS, border: `1px solid ${C.red}20`, color: C.gray, letterSpacing: '0.12em' }}>
                    Con {season.penalty_catamaran_at} cuota(s) en mora al llegar el evento, el comprador pierde acceso al Catamarán. El sistema envía aviso {season.warning_days_before} días antes.
                  </div>
                </div>
                <div className="pt-2"><SaveBtn loading={saving} onClick={saveSeason} /></div>
              </div>
            )}

            {/* ── VENDEDORES ── */}
            {tab === 'sellers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray }}>Equipo de ventas · {sellers.length} registrados</h2>
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
                    <p className="text-xs uppercase tracking-widest">Sin vendedores asignados a SOLSTICE</p>
                  </div>
                ) : (
                  <div style={{ background: C.bgS, border: `1px solid ${C.gray}15` }}>
                    <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[9px] uppercase tracking-widest" style={{ color: C.gray, borderBottom: `1px solid ${C.gray}10` }}>
                      <div className="col-span-3">Nombre</div>
                      <div className="col-span-2">Equipo / Squad</div>
                      <div className="col-span-2">Uni · Rol</div>
                      <div className="col-span-3">Código ref</div>
                      <div className="col-span-2 text-right">Acc.</div>
                    </div>
                    {sellers.map(seller => (
                      <div key={seller.id} className="grid grid-cols-12 gap-2 px-5 py-4 items-center"
                        style={{ borderBottom: `1px solid ${C.gray}08`, opacity: seller.status === 'inactive' ? 0.4 : 1 }}>
                        <div className="col-span-3">
                          <p className="text-xs font-bold uppercase truncate" style={{ letterSpacing: '0.08em' }}>{seller.name || '—'}</p>
                          <p className="text-[9px] truncate" style={{ color: C.gray }}>{seller.email}</p>
                        </div>
                        <div className="col-span-2">
                          {seller.team_name  && <p className="text-[9px] uppercase truncate" style={{ color: C.cream }}>{seller.team_name}</p>}
                          {seller.squad_name && <p className="text-[9px] truncate" style={{ color: C.gray }}>{seller.squad_name}</p>}
                          {!seller.team_name && !seller.squad_name && <span className="text-[9px]" style={{ color: `${C.gray}50` }}>—</span>}
                        </div>
                        <div className="col-span-2 space-y-1">
                          <p className="text-[9px] uppercase truncate" style={{ color: C.gray }}>{seller.university}</p>
                          <span className="text-[8px] uppercase px-1.5 py-0.5 rounded-sm font-bold"
                            style={{ background: seller.role === 'manager' ? `${C.red}20` : `${C.gray}15`, color: seller.role === 'manager' ? C.red : C.gray }}>
                            {seller.role === 'manager' ? 'Gerente' : 'Vendedor'}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <code className="text-[10px] px-2 py-0.5" style={{ background: `${C.gray}15`, color: C.cream }}>{seller.ref_code}</code>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 justify-end">
                          <button onClick={() => copyLink(seller.ref_code)} title="Copiar link" className="p-1.5 transition-colors" style={{ color: C.gray }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                            <Copy size={13} />
                          </button>
                          <button onClick={() => window.open(`https://midnightcorp.click/solstice?ref=${seller.ref_code}`, '_blank')} title="Ver link"
                            className="p-1.5 transition-colors" style={{ color: C.gray }}
                            onMouseEnter={e => (e.currentTarget.style.color = C.cream)} onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                            <ExternalLink size={13} />
                          </button>
                          <button onClick={() => toggleSellerStatus(seller)} title={seller.status === 'active' ? 'Desactivar' : 'Activar'}
                            style={{ color: seller.status === 'active' ? C.red : C.green }}>
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

      {/* ── Modal agregar vendedor ── */}
      <AnimatePresence>
        {addSellerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={() => setAddSellerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-lg p-8 space-y-5"
              style={{ background: C.bgS, border: `1px solid ${C.gray}20` }}>

              <div className="flex items-center justify-between">
                <h3 className="text-base uppercase font-black" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.12em' }}>Agregar vendedor</h3>
                <button onClick={() => setAddSellerOpen(false)} style={{ color: C.gray }}><X size={18} /></button>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Buscar promotor de Midnight</label>
                <div className="relative flex items-center" style={{ background: C.bgT, border: `1px solid ${C.gray}20` }}>
                  <Search size={13} className="ml-3" style={{ color: C.gray }} />
                  <input placeholder="Nombre del promotor..." value={searchQ} onChange={e => searchPromoters(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent" style={{ color: C.cream }} />
                  {searchLoading && <Loader2 size={13} className="mr-3 animate-spin" style={{ color: C.gray }} />}
                </div>
                {searchResults.length > 0 && (
                  <div style={{ border: `1px solid ${C.gray}20`, background: C.bgT }}>
                    {searchResults.map(p => (
                      <button key={p.user_id} onClick={() => selectPromoter(p)}
                        className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors">
                        <div>
                          <p className="text-xs font-bold uppercase" style={{ letterSpacing: '0.08em' }}>{p.name}</p>
                          <p className="text-[9px]" style={{ color: C.gray }}>{p.email}</p>
                        </div>
                        <div className="text-right">
                          {p.team_name  && <p className="text-[9px] uppercase" style={{ color: C.cream }}>{p.team_name}</p>}
                          {p.squad_name && <p className="text-[9px]" style={{ color: C.gray }}>{p.squad_name}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Show selected team/squad */}
                {newSeller.name && (newSeller.sales_team_id || newSeller.super_squad_id) && (
                  <div className="px-3 py-2 text-[10px] flex items-center gap-2" style={{ background: `${C.red}08`, border: `1px solid ${C.red}20` }}>
                    <span style={{ color: C.gray }}>Hereda estructura:</span>
                    <span style={{ color: C.red }}>
                      {searchResults.find(p => p.user_id === newSeller.user_id)?.team_name || 'Equipo asignado'}
                      {searchResults.find(p => p.user_id === newSeller.user_id)?.squad_name && ` · ${searchResults.find(p => p.user_id === newSeller.user_id)?.squad_name}`}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Universidad</label>
                  <select value={newSeller.university} onChange={e => setNewSeller(p => ({ ...p, university: e.target.value }))}
                    className="px-3 py-2.5 text-xs outline-none" style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                    <option>Javeriana</option><option>Los Andes</option><option>CESA</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Rol en Solstice</label>
                  <select value={newSeller.role} onChange={e => setNewSeller(p => ({ ...p, role: e.target.value as any }))}
                    className="px-3 py-2.5 text-xs outline-none" style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }}>
                    <option value="seller">Vendedor</option><option value="manager">Gerente</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-[0.25em]" style={{ color: C.gray }}>Código referido</label>
                <div className="flex gap-2">
                  <input value={newSeller.ref_code || ''} onChange={e => setNewSeller(p => ({ ...p, ref_code: e.target.value.toUpperCase() }))}
                    placeholder="SOL-NOMBRE-123" className="flex-1 px-3 py-2.5 text-xs outline-none font-mono"
                    style={{ background: C.bgT, border: `1px solid ${C.gray}20`, color: C.cream }} />
                  <button onClick={() => setNewSeller(p => ({ ...p, ref_code: genRefCode((p as any).name || searchQ || 'VEND') }))}
                    className="px-3 text-[9px] uppercase" style={{ background: `${C.gray}15`, color: C.gray }}>Auto</button>
                </div>
              </div>

              {newSeller.ref_code && (
                <div className="p-3 text-[10px]" style={{ background: `${C.red}10`, border: `1px solid ${C.red}20` }}>
                  <span style={{ color: C.gray }}>Link: </span>
                  <span style={{ color: C.cream }}>midnightcorp.click/solstice?ref={newSeller.ref_code}</span>
                </div>
              )}

              <button onClick={addSeller} disabled={saving || !newSeller.user_id || !newSeller.ref_code}
                className="w-full py-3 text-xs uppercase font-black tracking-widest disabled:opacity-40"
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
