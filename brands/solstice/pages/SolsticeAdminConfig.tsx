import React, { useState, useEffect, useRef } from 'react';
import { useSolsticeLogo } from '../hooks/useSolsticeLogo';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Calendar, DollarSign, Percent, Bell, Users,
  Save, Plus, Loader2, Copy, ToggleLeft, ToggleRight,
  X, Search, ExternalLink, Image, Star, ChevronRight
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
  // enriched from profiles
  name?: string;
  email?: string;
  code?: string;
  midnight_role?: string;
  team_name?: string;
  squad_name?: string;
  // platform activity
  midnight_active?: boolean;   // has orders in Midnight
  solstice_sales?: number;     // registrations via ref_code in Solstice
}

interface MidnightProfile {
  id: string;
  full_name: string;
  email: string;
  code: string;
  role: string;
  sales_team_id?: string;
  super_squad_id?: string;
  team_name?: string;
  squad_name?: string;
}

type Tab = 'general' | 'weeks' | 'prices' | 'commissions' | 'penalties' | 'sellers' | 'branding';

// ── Team structure types ───────────────────────────────────────────────────────
interface MemberRow {
  profile_id: string;
  full_name: string;
  email: string;
  code: string;
  midnight_role: string;
  sales_team_id?: string;
  super_squad_id?: string;
  solstice_seller_id?: string;
  solstice_active: boolean;
  solstice_status?: string;
  solstice_ref_code?: string;
  solstice_role?: string;
}

interface TeamGroup {
  id: string;
  name: string;
  super_squad_id?: string;
  members: MemberRow[];
}

interface SquadGroup {
  id: string;
  name: string;
  teams: TeamGroup[];
  loose: MemberRow[]; // members in squad but no team
}

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
      <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>{label}</label>
      <div className="flex items-center" style={{
        background: 'rgba(255,255,255,0.05)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: '16px',
        transition: 'all 0.3s ease',
      }}>
        {prefix && <span className="px-3 text-xs shrink-0" style={{ color: C.gray, borderRight: '0.5px solid rgba(255,255,255,0.08)' }}>{prefix}</span>}
        <input
          type={type} value={value} placeholder={placeholder || ''}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-3 py-2.5 text-xs outline-none bg-transparent"
          style={{ color: C.cream, borderRadius: '16px' }}
          onFocus={e => {
            const parent = e.currentTarget.parentElement!;
            parent.style.borderColor = 'rgba(230,57,47,0.55)';
          }}
          onBlur={e => {
            const parent = e.currentTarget.parentElement!;
            parent.style.borderColor = 'rgba(255,255,255,0.10)';
          }}
        />
      </div>
    </div>
  );
}

function Toggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-3 py-2" style={{ transition: 'all 0.3s ease' }}>
      {active ? <ToggleRight size={22} style={{ color: C.green }} /> : <ToggleLeft size={22} style={{ color: C.gray }} />}
      <span className="text-xs uppercase tracking-widest" style={{ color: active ? C.cream : C.gray }}>{label}</span>
    </button>
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-40"
      style={{
        background: 'rgba(230,57,47,0.20)',
        border: '0.5px solid rgba(230,57,47,0.45)',
        borderRadius: '999px',
        color: C.cream,
        padding: '10px 20px',
        fontWeight: 500,
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      Guardar
    </button>
  );
}

function PriceSection({ title, subtitle, onSave, saving, children }: {
  title: string; subtitle: string; onSave: () => void; saving: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-8" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
      <div>
        <h2 className="text-sm uppercase tracking-widest" style={{ color: C.cream, fontWeight: 300, letterSpacing: '-0.02em' }}>{title}</h2>
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
      <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Días incluidos</label>
      <div className="flex flex-wrap gap-2">
        {days.map(day => {
          const active = selected.includes(day.day_number);
          return (
            <button key={day.day_number} type="button" onClick={() => toggle(day.day_number)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider"
              style={{
                background: active ? 'rgba(230,57,47,0.20)' : 'rgba(255,255,255,0.04)',
                border: `0.5px solid ${active ? 'rgba(230,57,47,0.60)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '999px',
                color: active ? C.red : C.gray,
                transition: 'all 0.3s ease',
              }}>
              <span className="font-medium text-[9px]">D{day.day_number}</span>
              <span>{day.title}</span>
              {day.highlight && <span style={{ color: C.red }}>★</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[9px] uppercase" style={{ color: 'rgba(96,96,96,0.6)' }}>
        {selected.length} día{selected.length !== 1 ? 's' : ''} seleccionado{selected.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── Logo upload helper ─────────────────────────────────────────────────────────

async function uploadLogoImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `solstice/brand/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('assets').upload(path, file, { upsert: true });
  if (!error) {
    const { data } = supabase.storage.from('assets').getPublicUrl(path);
    return data.publicUrl;
  }
  // Fallback: base64 DataURL stored in localStorage (works without a bucket)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

  // Team structure (full Midnight org)
  const [squadGroups, setSquadGroups]         = useState<SquadGroup[]>([]);
  const [noSquadTeams, setNoSquadTeams]       = useState<TeamGroup[]>([]);
  const [unassigned, setUnassigned]           = useState<MemberRow[]>([]);
  const [expandedSquads, setExpandedSquads]   = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams]     = useState<Set<string>>(new Set());
  const [activating, setActivating]           = useState<Set<string>>(new Set());

  // Recruitment modal (espejo de Midnight)
  const [recruitOpen, setRecruitOpen]   = useState(false);
  const [recruitMode, setRecruitMode]   = useState<'create' | 'link'>('create');
  const [recruiting, setRecruiting]     = useState(false);
  // create mode
  const [rName,   setRName]   = useState('');
  const [rCode,   setRCode]   = useState('');
  const [rEmail,  setREmail]  = useState('');
  const [rTeamId, setRTeamId] = useState('');
  // link mode
  const [rLinkId,     setRLinkId]     = useState('');
  const [rLinkTeamId, setRLinkTeamId] = useState('');

  // Image upload refs
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Branding
  const [logoUrl, setLogoUrl] = useSolsticeLogo();
  const [logoInput, setLogoInput] = useState(() => localStorage.getItem('solstice_logo_url') || '');
  const [brandingLoading, setBrandingLoading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement | null>(null);

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

      // ── Build full Midnight org structure ────────────────────────────────────
      const [{ data: allProfs }, { data: allTeams }, { data: allSquads }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, code, role, sales_team_id, super_squad_id'),
        supabase.from('sales_teams').select('id, name, super_squad_id'),
        supabase.from('super_squads').select('id, name'),
      ]);

      const solList = (sl || []) as any[];

      // Map every Midnight profile to a MemberRow
      const memberRows: MemberRow[] = (allProfs || []).map((p: any) => {
        const ss = solList.find((x) => x.user_id === p.id);
        return {
          profile_id:         p.id,
          full_name:          p.full_name || '(sin nombre)',
          email:              p.email,
          code:               p.code,
          midnight_role:      p.role,
          sales_team_id:      p.sales_team_id,
          super_squad_id:     p.super_squad_id,
          solstice_seller_id: ss?.id,
          solstice_active:    !!ss && ss.status === 'active',
          solstice_status:    ss?.status,
          solstice_ref_code:  ss?.ref_code,
          solstice_role:      ss?.role,
        };
      });

      // Build squad → team → members tree
      const squadMap = new Map<string, SquadGroup>();
      for (const sq of (allSquads || [])) {
        squadMap.set(sq.id, { id: sq.id, name: sq.name, teams: [], loose: [] });
      }

      const teamMap = new Map<string, TeamGroup>();
      for (const t of (allTeams || [])) {
        const tg: TeamGroup = { id: t.id, name: t.name, super_squad_id: t.super_squad_id, members: [] };
        teamMap.set(t.id, tg);
      }

      const noSquad: TeamGroup[] = [];
      const unassignedList: MemberRow[] = [];

      for (const m of memberRows) {
        if (m.sales_team_id && teamMap.has(m.sales_team_id)) {
          teamMap.get(m.sales_team_id)!.members.push(m);
        } else if (m.super_squad_id && squadMap.has(m.super_squad_id)) {
          squadMap.get(m.super_squad_id)!.loose.push(m);
        } else {
          unassignedList.push(m);
        }
      }

      // Attach teams to squads (or to noSquad bucket)
      for (const t of (allTeams || [])) {
        const tg = teamMap.get(t.id)!;
        if (t.super_squad_id && squadMap.has(t.super_squad_id)) {
          squadMap.get(t.super_squad_id)!.teams.push(tg);
        } else {
          noSquad.push(tg);
        }
      }

      setSquadGroups(Array.from(squadMap.values()));
      setNoSquadTeams(noSquad);
      setUnassigned(unassignedList);

      // Keep flat sellers list for backward compat (other tabs)
      setSellers(memberRows.filter(m => m.solstice_seller_id) as any);

    } catch { /* DB not migrated yet */ }
    finally { setLoading(false); }
  };

  // ── Toggle Solstice activation for a Midnight member ──────────────────────────
  const toggleMemberSolstice = async (member: MemberRow) => {
    if (!season?.id) { toast.error('Guarda la temporada primero'); return; }
    setActivating(prev => new Set(prev).add(member.profile_id));
    try {
      if (member.solstice_seller_id) {
        const next = member.solstice_active ? 'inactive' : 'active';
        const { error } = await supabase.from('solstice_sellers')
          .update({ status: next }).eq('id', member.solstice_seller_id);
        if (error) throw error;
        toast.success(next === 'active' ? `${member.full_name} reactivado` : `${member.full_name} pausado en Solstice`);
      } else {
        const ref_code = genRefCode(member.full_name);
        const { error } = await supabase.from('solstice_sellers').insert({
          user_id:        member.profile_id,
          season_id:      season.id,
          ref_code,
          role:           'seller',
          status:         'active',
          university:     'General',
          sales_team_id:  member.sales_team_id  || null,
          super_squad_id: member.super_squad_id || null,
        });
        if (error) throw error;
        toast.success(`${member.full_name} activado para Solstice · ref: ${ref_code}`);
      }
      await loadAll();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setActivating(prev => { const s = new Set(prev); s.delete(member.profile_id); return s; });
    }
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

  // ── Recruitment helpers ────────────────────────────────────────────────────────
  const allTeamsFlat = [
    ...squadGroups.flatMap(sq => sq.teams),
    ...noSquadTeams,
  ];

  const resetRecruit = () => {
    setRName(''); setRCode(''); setREmail(''); setRTeamId('');
    setRLinkId(''); setRLinkTeamId('');
    setRecruitMode('create');
  };

  // Agrega al solstice_sellers si hay temporada activa
  const activateInSolstice = async (profileId: string, teamId?: string) => {
    if (!season?.id) return;
    const { data: team } = teamId
      ? await supabase.from('sales_teams').select('super_squad_id').eq('id', teamId).single()
      : { data: null };
    await supabase.from('solstice_sellers').insert({
      user_id:        profileId,
      season_id:      season.id,
      ref_code:       genRefCode(rName || 'VEND'),
      role:           'seller',
      status:         'active',
      university:     'General',
      sales_team_id:  teamId  || null,
      super_squad_id: (team as any)?.super_squad_id || null,
    });
  };

  // Modo "Nuevo Ingreso": crea perfil en Midnight + activa en Solstice
  const handleCreate = async () => {
    if (!rName || !rEmail) { toast.error('Nombre y email son obligatorios'); return; }
    if (!rEmail.includes('@')) { toast.error('Ingresa un email válido'); return; }
    const finalCode = (rCode || rEmail.split('@')[0]).replace(/\s/g, '').toUpperCase();
    if (!finalCode) { toast.error('El código no puede estar vacío'); return; }
    setRecruiting(true);
    try {
      const profileId = crypto.randomUUID();
      const teamRow = rTeamId ? allTeamsFlat.find(t => t.id === rTeamId) : null;
      const { error } = await supabase.from('profiles').insert({
        id:            profileId,
        full_name:     rName.trim(),
        code:          finalCode,
        email:         rEmail.toLowerCase().trim(),
        role:          'PROMOTER',
        sales_team_id: rTeamId || null,
        super_squad_id:(teamRow as any)?.super_squad_id || null,
      });
      if (error) throw error;
      await activateInSolstice(profileId, rTeamId || undefined);
      toast.success(`${rName} registrado${rTeamId ? ` en ${teamRow?.name}` : ''} · activado en Solstice`);
      setRecruitOpen(false); resetRecruit(); loadAll();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setRecruiting(false); }
  };

  // Modo "Vincular Existente": asigna equipo en Midnight + activa en Solstice
  const handleLink = async () => {
    if (!rLinkId) { toast.error('Selecciona un promotor'); return; }
    if (!rLinkTeamId) { toast.error('Selecciona un equipo de destino'); return; }
    setRecruiting(true);
    try {
      const teamRow = allTeamsFlat.find(t => t.id === rLinkTeamId);
      const { error } = await supabase.from('profiles').update({
        sales_team_id:  rLinkTeamId,
        super_squad_id: (teamRow as any)?.super_squad_id || null,
      }).eq('id', rLinkId);
      if (error) throw error;
      // Also activate in Solstice if not already
      const existing = unassigned.find(m => m.profile_id === rLinkId);
      if (existing && !existing.solstice_seller_id) {
        await activateInSolstice(rLinkId, rLinkTeamId);
      }
      const member = unassigned.find(m => m.profile_id === rLinkId);
      toast.success(`${member?.full_name || 'Promotor'} vinculado a ${teamRow?.name} · activado en Solstice`);
      setRecruitOpen(false); resetRecruit(); loadAll();
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally { setRecruiting(false); }
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
    { id: 'branding',    label: 'Branding',    icon: <Image size={14} /> },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <p className="text-[9px] uppercase font-medium mb-1" style={{ color: C.red, letterSpacing: '0.4em' }}>Administración</p>
        <h1 className="text-3xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.1em', fontWeight: 300 }}>
          Configuración de Temporada
        </h1>
        <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {season?.name || 'SOLSTICE 2026'} · {season?.status?.toUpperCase()}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto px-8 pt-4 gap-1" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-[10px] uppercase tracking-widest whitespace-nowrap"
            style={{
              color: tab === t.id ? C.cream : C.gray,
              background: tab === t.id ? 'rgba(230,57,47,0.15)' : 'transparent',
              border: tab === t.id ? '0.5px solid rgba(230,57,47,0.40)' : '0.5px solid transparent',
              borderRadius: '999px',
              transition: 'all 0.3s ease',
              marginBottom: '8px',
            }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="px-8 py-8 max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* ── GENERAL ── */}
            {tab === 'general' && season && (
              <div className="space-y-6 p-5" style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
              }}>
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Información de la temporada</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputRow label="Nombre" value={season.name} onChange={v => upSeason('name', v)} />
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Estado</label>
                    <select value={season.status} onChange={e => upSeason('status', e.target.value)}
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}>
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
                <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Semanas universitarias</h2>
                <div className="space-y-4">
                  {weeks.map((week, idx) => (
                    <div key={week.id} className="p-5" style={{
                      background: 'rgba(255,255,255,0.04)',
                      backdropFilter: 'blur(32px) saturate(180%)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '24px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
                    }}>
                      <p className="text-xs uppercase font-medium mb-4" style={{ color: C.red, letterSpacing: '0.2em' }}>
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
                  className="flex items-center gap-2 text-xs uppercase tracking-widest"
                  style={{
                    color: C.gray,
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: '999px',
                    padding: '10px 20px',
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
                      style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.08)', fontWeight: 500, letterSpacing: '0.06em' }}>
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
                        style={{
                          background: day.highlight ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.04)',
                          border: `0.5px solid ${day.highlight ? 'rgba(230,57,47,0.25)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: '16px',
                        }}>
                        {/* Name + subtitle */}
                        <div className="col-span-3">
                          <input value={day.title} onChange={e => upDay(idx, 'title', e.target.value)}
                            className="w-full bg-transparent text-xs font-medium uppercase outline-none mb-0.5"
                            style={{ color: day.highlight ? C.red : C.cream }}
                            onFocus={e => (e.currentTarget.style.borderBottom = `0.5px solid ${C.red}`)}
                            onBlur={e => (e.currentTarget.style.borderBottom = 'none')} />
                          <input value={day.subtitle} onChange={e => upDay(idx, 'subtitle', e.target.value)}
                            className="w-full bg-transparent text-[9px] outline-none"
                            style={{ color: C.gray }} placeholder="subtítulo" />
                        </div>
                        {/* Prices */}
                        {(['price', 'price_cash', 'price_combo', 'price_monthly'] as const).map(field => (
                          <div key={field} className="col-span-2">
                            <div className="flex items-center gap-1 px-2 py-1.5"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '0.5px solid rgba(255,255,255,0.08)',
                                borderRadius: '14px',
                                transition: 'all 0.3s ease',
                              }}>
                              <span className="text-[9px] shrink-0" style={{ color: C.gray }}>$</span>
                              <input
                                type="number"
                                value={day[field] || ''}
                                onChange={e => upDay(idx, field, e.target.value)}
                                className="w-full bg-transparent text-xs outline-none text-right"
                                style={{ color: C.cream }}
                                onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(230,57,47,0.55)'; }}
                                onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                              />
                            </div>
                          </div>
                        ))}
                        {/* Highlight toggle */}
                        <div className="col-span-1 flex justify-end">
                          <button onClick={() => upDay(idx, 'highlight', !day.highlight)}
                            title={day.highlight ? 'Quitar destacado' : 'Destacar'}
                            style={{ transition: 'all 0.3s ease' }}>
                            <Star size={14} fill={day.highlight ? C.red : 'none'} style={{ color: day.highlight ? C.red : 'rgba(96,96,96,0.5)' }} />
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
                            className="text-[9px] uppercase px-2 py-1"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: C.gray,
                              border: '0.5px solid rgba(255,255,255,0.12)',
                              borderRadius: '999px',
                              transition: 'all 0.3s ease',
                            }}>
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
                        <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Cuotas mensuales</label>
                        <div className="flex items-center gap-2 px-3 py-2.5"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '0.5px solid rgba(255,255,255,0.10)',
                            borderRadius: '16px',
                          }}>
                          <input type="number" value={season.combo1_installments}
                            onChange={e => upSeason('combo1_installments', e.target.value)}
                            className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                          <span className="text-[10px]" style={{ color: C.gray }}>
                            × ${Math.round(season.combo1_total / (season.combo1_installments || 1) / 1000)}K/mes
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-end p-4 gap-1"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '0.5px solid rgba(255,255,255,0.08)',
                          borderRadius: '16px',
                        }}>
                        <p className="text-[8px] uppercase" style={{ color: C.gray }}>Reserva inicial</p>
                        <p className="text-xl font-medium" style={{ color: C.cream }}>${Math.round(season.entry_price / 1000)}K</p>
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
                        <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Cuotas mensuales</label>
                        <div className="flex items-center gap-2 px-3 py-2.5"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '0.5px solid rgba(255,255,255,0.10)',
                            borderRadius: '16px',
                          }}>
                          <input type="number" value={season.installments}
                            onChange={e => upSeason('installments', e.target.value)}
                            className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                          <span className="text-[10px]" style={{ color: C.gray }}>
                            × ${Math.round(season.combo_total / (season.installments || 1) / 1000)}K/mes
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-end p-4 gap-1"
                        style={{
                          background: 'rgba(230,57,47,0.08)',
                          border: '0.5px solid rgba(230,57,47,0.20)',
                          borderRadius: '16px',
                        }}>
                        <p className="text-[8px] uppercase" style={{ color: 'rgba(230,57,47,0.9)' }}>Reserva inicial</p>
                        <p className="text-xl font-medium" style={{ color: C.red }}>${Math.round(season.entry_price / 1000)}K</p>
                        <p className="text-[8px] uppercase" style={{ color: 'rgba(230,57,47,0.9)' }}>+ {season.installments} cuotas de ${Math.round(season.combo_total / (season.installments || 1) / 1000)}K</p>
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
                          <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Tipo de incremento</label>
                          <select value={season.phase_increment_type}
                            onChange={e => upSeason('phase_increment_type', e.target.value)}
                            className="px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '0.5px solid rgba(255,255,255,0.10)',
                              borderRadius: '16px',
                              color: C.cream,
                              transition: 'all 0.3s ease',
                            }}>
                            <option value="fixed">Valor fijo ($)</option>
                            <option value="percent">Porcentaje (%)</option>
                          </select>
                        </div>
                      </div>
                      {season.phase1_limit && season.phase_increment && (
                        <div className="p-4 text-[10px] leading-relaxed uppercase"
                          style={{
                            background: 'rgba(230,57,47,0.08)',
                            border: '0.5px solid rgba(230,57,47,0.20)',
                            borderRadius: '16px',
                            color: C.gray,
                            letterSpacing: '0.12em',
                          }}>
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
                <div className="space-y-4 p-5" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Porcentajes de comisión</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <InputRow label="Comisión vendedor (%)" value={season.commission_pct} onChange={v => upSeason('commission_pct', Number(v))} type="number" prefix="%" />
                    <InputRow label="Comisión gerente (%)" value={season.manager_commission_pct} onChange={v => upSeason('manager_commission_pct', Number(v))} type="number" prefix="%" />
                  </div>
                  <div className="p-4 text-xs space-y-1" style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                  }}>
                    <p style={{ color: C.gray }}>Por combo completo (${Math.round(season.combo_total / 1000)}K):</p>
                    <p>Comisión vendedor: <strong style={{ color: C.red }}>${Math.round(season.combo_total * season.commission_pct / 100 / 1000)}K</strong></p>
                    <p>Comisión gerente: <strong style={{ color: C.red }}>${Math.round(season.combo_total * season.manager_commission_pct / 100 / 1000)}K</strong></p>
                  </div>
                </div>
                <div className="space-y-4 p-5" style={{
                  borderTop: '0.5px solid rgba(255,255,255,0.08)',
                  paddingTop: '1.5rem',
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Criterio de devengo</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[['Por cuota recibida', 'Comisión acumulada con cada pago'], ['Combo completado', 'Se paga al cerrar todas las cuotas']].map(([lbl, sub], i) => (
                      <button key={i} className="p-4 text-left"
                        style={{
                          background: i === 0 ? 'rgba(230,57,47,0.12)' : 'rgba(255,255,255,0.04)',
                          border: `0.5px solid ${i === 0 ? 'rgba(230,57,47,0.40)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: '16px',
                          transition: 'all 0.3s ease',
                        }}>
                        <p className="text-xs uppercase font-medium mb-1" style={{ letterSpacing: '0.12em', color: i === 0 ? C.red : C.cream }}>{lbl}</p>
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
                <div className="space-y-4 p-5" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Recordatorios automáticos</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputRow label="Días antes del vencimiento (primer aviso)" value={season.warning_days_before} onChange={v => upSeason('warning_days_before', Number(v))} type="number" />
                    <InputRow label="Días después sin pago para alertar vendedor" value={7} onChange={() => {}} type="number" />
                  </div>
                </div>
                <div className="space-y-4 p-5" style={{
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(24px)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                }}>
                  <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Penalidades por mora</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Cuotas en mora para perder Catamarán (Día 3)</label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                      }}>
                        <input type="number" value={season.penalty_catamaran_at} onChange={e => upSeason('penalty_catamaran_at', Number(e.target.value))}
                          className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuota(s)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Cuotas en mora para perder 2 eventos</label>
                      <div className="flex items-center gap-3 px-3 py-2.5" style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                      }}>
                        <input type="number" defaultValue={2} className="w-16 bg-transparent outline-none text-xs" style={{ color: C.cream }} />
                        <span className="text-[10px]" style={{ color: C.gray }}>cuotas(s)</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 text-[10px] leading-relaxed uppercase" style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(230,57,47,0.20)',
                    borderRadius: '16px',
                    color: C.gray,
                    letterSpacing: '0.12em',
                  }}>
                    Con {season.penalty_catamaran_at} cuota(s) en mora al llegar el evento, el comprador pierde acceso al Catamarán. El sistema envía aviso {season.warning_days_before} días antes.
                  </div>
                </div>
                <div className="pt-2"><SaveBtn loading={saving} onClick={saveSeason} /></div>
              </div>
            )}

            {/* ── VENDEDORES ── */}
            {tab === 'sellers' && (() => {
              const totalMidnight = squadGroups.reduce((a, sq) =>
                a + sq.teams.reduce((b, t) => b + t.members.length, 0) + sq.loose.length, 0)
                + noSquadTeams.reduce((a, t) => a + t.members.length, 0)
                + unassigned.length;
              const totalSolstice = sellers.length;

              const MemberRowItem = ({ m }: { m: MemberRow }) => {
                const busy = activating.has(m.profile_id);
                return (
                  <div className="flex items-center gap-3 px-4 py-2.5 group"
                    style={{
                      borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                      opacity: m.solstice_status === 'inactive' ? 0.4 : 1,
                      transition: 'all 0.3s ease',
                      borderRadius: '16px',
                    }}>
                    {/* Status dot */}
                    <span className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: m.solstice_active ? C.green : 'rgba(96,96,96,0.4)' }} />
                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium uppercase truncate" style={{ color: m.solstice_active ? C.cream : C.gray, letterSpacing: '0.08em' }}>
                        {m.full_name}
                      </p>
                      <p className="text-[9px] truncate" style={{ color: 'rgba(96,96,96,0.7)' }}>{m.midnight_role} · {m.email}</p>
                    </div>
                    {/* Ref code */}
                    {m.solstice_active && m.solstice_ref_code && (
                      <div className="flex items-center gap-1 shrink-0">
                        <code className="text-[9px] px-1.5 py-0.5" style={{
                          background: 'rgba(255,255,255,0.08)',
                          color: C.cream,
                          borderRadius: '999px',
                        }}>
                          {m.solstice_ref_code}
                        </code>
                        <button onClick={() => copyLink(m.solstice_ref_code!)}
                          className="p-1 opacity-0 group-hover:opacity-100" style={{ color: C.gray, transition: 'all 0.3s ease' }}
                          onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
                          onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
                          <Copy size={10} />
                        </button>
                      </div>
                    )}
                    {/* Toggle */}
                    <button onClick={() => toggleMemberSolstice(m)} disabled={busy}
                      className="shrink-0 disabled:opacity-40"
                      title={m.solstice_active ? 'Pausar en Solstice' : m.solstice_seller_id ? 'Reactivar' : 'Activar para Solstice'}
                      style={{ color: m.solstice_active ? C.green : 'rgba(96,96,96,0.5)', transition: 'all 0.3s ease' }}>
                      {busy
                        ? <Loader2 size={15} className="animate-spin" />
                        : m.solstice_active
                          ? <ToggleRight size={18} />
                          : <ToggleLeft size={18} />}
                    </button>
                  </div>
                );
              };

              const TeamBlock = ({ team }: { team: TeamGroup }) => {
                const open = expandedTeams.has(team.id);
                const active = team.members.filter(m => m.solstice_active).length;
                return (
                  <div style={{ borderLeft: '0.5px solid rgba(255,255,255,0.08)' }} className="ml-4">
                    <button onClick={() => setExpandedTeams(prev => {
                      const s = new Set(prev); s.has(team.id) ? s.delete(team.id) : s.add(team.id); return s;
                    })} className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                      style={{ borderRadius: '16px', transition: 'all 0.3s ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      <ChevronRight size={11} className="transition-transform shrink-0"
                        style={{ color: C.gray, transform: open ? 'rotate(90deg)' : 'none' }} />
                      <span className="text-[10px] uppercase tracking-widest flex-1" style={{ color: C.cream }}>{team.name}</span>
                      <span className="text-[9px]" style={{ color: active > 0 ? C.green : 'rgba(96,96,96,0.5)' }}>
                        {active}/{team.members.length} en Solstice
                      </span>
                    </button>
                    {open && team.members.map(m => <MemberRowItem key={m.profile_id} m={m} />)}
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>
                        Estructura Midnight → Solstice
                      </h2>
                      <p className="text-[9px] uppercase mt-1" style={{ color: 'rgba(96,96,96,0.6)', letterSpacing: '0.15em' }}>
                        {totalSolstice} activos en Solstice · {totalMidnight} en Midnight · toggle para activar/pausar
                      </p>
                    </div>
                    <button onClick={() => { resetRecruit(); setRecruitOpen(true); }}
                      className="flex items-center gap-2 text-[10px] uppercase font-medium tracking-widest"
                      style={{
                        border: '0.5px solid rgba(230,57,47,0.40)',
                        color: C.red,
                        background: 'transparent',
                        borderRadius: '999px',
                        padding: '10px 20px',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,47,0.12)';
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                      }}>
                      <Plus size={13} /> Reclutar
                    </button>
                  </div>

                  {/* Squads */}
                  {squadGroups.length === 0 && noSquadTeams.length === 0 && unassigned.length === 0 ? (
                    <div className="py-16 text-center" style={{ color: C.gray }}>
                      <Users size={32} className="mx-auto mb-4 opacity-30" />
                      <p className="text-xs uppercase tracking-widest">No hay staff registrado en Midnight</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Named squads */}
                      {squadGroups.map(sq => {
                        const open = expandedSquads.has(sq.id);
                        const allMembers = [...sq.teams.flatMap(t => t.members), ...sq.loose];
                        const active = allMembers.filter(m => m.solstice_active).length;
                        return (
                          <div key={sq.id} style={{
                            background: 'rgba(255,255,255,0.04)',
                            backdropFilter: 'blur(32px) saturate(180%)',
                            border: '0.5px solid rgba(255,255,255,0.08)',
                            borderRadius: '24px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
                          }}>
                            <button onClick={() => setExpandedSquads(prev => {
                              const s = new Set(prev); s.has(sq.id) ? s.delete(sq.id) : s.add(sq.id); return s;
                            })} className="w-full flex items-center gap-3 px-5 py-4 text-left"
                              style={{ borderRadius: '24px', transition: 'all 0.3s ease' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                              <ChevronRight size={13} className="transition-transform shrink-0"
                                style={{ color: C.gray, transform: open ? 'rotate(90deg)' : 'none' }} />
                              <div className="flex-1">
                                <p className="text-sm font-medium uppercase" style={{ color: C.cream, letterSpacing: '0.12em' }}>{sq.name}</p>
                                <p className="text-[9px] uppercase mt-0.5" style={{ color: C.gray }}>
                                  {sq.teams.length} equipo{sq.teams.length !== 1 ? 's' : ''} · {allMembers.length} personas
                                </p>
                              </div>
                              <span className="text-[10px] uppercase px-2 py-1"
                                style={{
                                  background: active > 0 ? 'rgba(16,185,129,0.20)' : 'rgba(255,255,255,0.04)',
                                  color: active > 0 ? C.green : C.gray,
                                  border: `0.5px solid ${active > 0 ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.08)'}`,
                                  borderRadius: '999px',
                                }}>
                                {active} en Solstice
                              </span>
                            </button>
                            {open && (
                              <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                                {sq.teams.map(t => <TeamBlock key={t.id} team={t} />)}
                                {sq.loose.map(m => <MemberRowItem key={m.profile_id} m={m} />)}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Teams without squad */}
                      {noSquadTeams.length > 0 && (
                        <div style={{
                          background: 'rgba(255,255,255,0.04)',
                          backdropFilter: 'blur(32px) saturate(180%)',
                          border: '0.5px solid rgba(255,255,255,0.08)',
                          borderRadius: '24px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
                        }}>
                          <div className="px-5 py-3 text-[9px] uppercase tracking-widest" style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.08)', fontWeight: 500, letterSpacing: '0.06em' }}>
                            Equipos sin squad
                          </div>
                          {noSquadTeams.map(t => <TeamBlock key={t.id} team={t} />)}
                        </div>
                      )}

                      {/* Unassigned */}
                      {unassigned.length > 0 && (
                        <div style={{
                          background: 'rgba(255,255,255,0.04)',
                          backdropFilter: 'blur(32px) saturate(180%)',
                          border: '0.5px solid rgba(255,255,255,0.08)',
                          borderRadius: '24px',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.20)',
                        }}>
                          <div className="px-5 py-3 text-[9px] uppercase tracking-widest" style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.08)', fontWeight: 500, letterSpacing: '0.06em' }}>
                            Sin equipo asignado · {unassigned.length}
                          </div>
                          {unassigned.map(m => <MemberRowItem key={m.profile_id} m={m} />)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Modal reclutamiento (espejo Midnight) ── */}
      <AnimatePresence>
        {recruitOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300]"
              style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
              onClick={() => setRecruitOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-lg p-8 space-y-5 overflow-y-auto max-h-[90vh]"
              style={{
                background: 'rgba(8,0,0,0.92)',
                backdropFilter: 'blur(40px) saturate(160%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '32px',
                boxShadow: '0 40px 80px rgba(0,0,0,0.60)',
              }}>

              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base uppercase font-medium" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.12em', color: C.cream, fontWeight: 300 }}>
                    Reclutar Staff
                  </h3>
                  <p className="text-[9px] uppercase mt-0.5" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                    Registra en Midnight + activa en Solstice automáticamente
                  </p>
                </div>
                <button onClick={() => setRecruitOpen(false)}
                  style={{
                    color: C.gray,
                    background: 'rgba(255,255,255,0.06)',
                    border: '0.5px solid rgba(255,255,255,0.12)',
                    borderRadius: '999px',
                    padding: '6px',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.cream; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}>
                  <X size={16} />
                </button>
              </div>

              {/* Mode tabs */}
              <div className="grid grid-cols-2 gap-1 p-1" style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '999px',
              }}>
                {(['create', 'link'] as const).map(mode => (
                  <button key={mode} onClick={() => setRecruitMode(mode)}
                    className="py-2.5 text-[10px] uppercase font-medium tracking-widest"
                    style={{
                      background: recruitMode === mode ? 'rgba(230,57,47,0.20)' : 'transparent',
                      color: recruitMode === mode ? C.cream : C.gray,
                      border: recruitMode === mode ? '0.5px solid rgba(230,57,47,0.45)' : '0.5px solid transparent',
                      borderRadius: '999px',
                      transition: 'all 0.3s ease',
                    }}>
                    {mode === 'create' ? 'Nuevo Ingreso' : 'Vincular Existente'}
                  </button>
                ))}
              </div>

              {/* ── NUEVO INGRESO ── */}
              {recruitMode === 'create' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Nombre completo</label>
                    <input value={rName} onChange={e => setRName(e.target.value)}
                      placeholder="Ej: Ana María López"
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.55)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Código de acceso</label>
                    <input value={rCode} onChange={e => setRCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                      placeholder="Ej: ANA2026"
                      className="px-3 py-2.5 text-xs outline-none font-mono tracking-widest text-center"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.55)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')} />
                    <p className="text-[9px]" style={{ color: 'rgba(96,96,96,0.6)' }}>Sin espacios · Si se deja vacío se genera del email</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Email (para inicio de sesión)</label>
                    <input type="email" value={rEmail} onChange={e => setREmail(e.target.value)}
                      placeholder="promotor@gmail.com"
                      className="px-3 py-2.5 text-xs outline-none font-mono"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'rgba(230,57,47,0.55)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')} />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Asignar a equipo</label>
                    <select value={rTeamId} onChange={e => setRTeamId(e.target.value)}
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}>
                      <option value="">— Independiente (sin equipo) —</option>
                      {squadGroups.map(sq => (
                        <optgroup key={sq.id} label={sq.name}>
                          {sq.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                      ))}
                      {noSquadTeams.length > 0 && (
                        <optgroup label="Sin squad">
                          {noSquadTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div className="p-3 text-[10px]" style={{
                    background: 'rgba(230,57,47,0.08)',
                    border: '0.5px solid rgba(230,57,47,0.20)',
                    borderRadius: '16px',
                    color: C.gray,
                  }}>
                    <span style={{ color: C.red }}>Nota: </span>
                    {rTeamId
                      ? `Se registrará en Midnight y se activará en Solstice con ref_code automático.`
                      : `Quedará independiente en Midnight, activado en Solstice sin equipo asignado.`}
                  </div>

                  <button onClick={handleCreate} disabled={recruiting || !rName || !rEmail}
                    className="w-full text-xs uppercase font-medium tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: 'rgba(230,57,47,0.20)',
                      border: '0.5px solid rgba(230,57,47,0.45)',
                      borderRadius: '999px',
                      color: C.cream,
                      padding: '14px 20px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
                    {recruiting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Registrar promotor
                  </button>
                </div>
              )}

              {/* ── VINCULAR EXISTENTE ── */}
              {recruitMode === 'link' && (
                <div className="space-y-4">
                  <div className="p-3 text-[10px]" style={{
                    background: 'rgba(168,85,247,0.08)',
                    border: '0.5px solid rgba(168,85,247,0.25)',
                    borderRadius: '16px',
                    color: '#a855f7',
                  }}>
                    Selecciona un promotor de Midnight sin equipo asignado para vincularlo a un squad.
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>
                      Promotor disponible · {unassigned.length} sin equipo
                    </label>
                    <select value={rLinkId} onChange={e => setRLinkId(e.target.value)}
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}>
                      <option value="">— Seleccionar promotor —</option>
                      {unassigned.map(m => (
                        <option key={m.profile_id} value={m.profile_id}>
                          {m.full_name} ({m.code}) {m.solstice_active ? '· ☀ Solstice' : ''}
                        </option>
                      ))}
                    </select>
                    {unassigned.length === 0 && (
                      <p className="text-[9px]" style={{ color: C.red }}>Todos los promotores ya tienen equipo asignado.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>Equipo de destino</label>
                    <select value={rLinkTeamId} onChange={e => setRLinkTeamId(e.target.value)}
                      className="px-3 py-2.5 text-xs outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '0.5px solid rgba(255,255,255,0.10)',
                        borderRadius: '16px',
                        color: C.cream,
                        transition: 'all 0.3s ease',
                      }}>
                      <option value="">— Seleccionar equipo —</option>
                      {squadGroups.map(sq => (
                        <optgroup key={sq.id} label={sq.name}>
                          {sq.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                      ))}
                      {noSquadTeams.length > 0 && (
                        <optgroup label="Sin squad">
                          {noSquadTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <button onClick={handleLink} disabled={recruiting || !rLinkId || !rLinkTeamId}
                    className="w-full text-xs uppercase font-medium tracking-widest disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{
                      background: 'rgba(168,85,247,0.20)',
                      border: '0.5px solid rgba(168,85,247,0.40)',
                      borderRadius: '999px',
                      color: C.cream,
                      padding: '14px 20px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}>
                    {recruiting ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
                    Vincular al equipo
                  </button>
                </div>
              )}

            {/* ── BRANDING ── */}
            {tab === 'branding' && (() => {
              const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBrandingLoading(true);
                try {
                  const url = await uploadLogoImage(file);
                  setLogoInput(url);
                } catch { toast.error('No se pudo cargar la imagen'); }
                finally { setBrandingLoading(false); }
              };

              const applyLogo = () => {
                const url = logoInput.trim();
                if (!url) return;
                setLogoUrl(url);
                toast.success('Logo aplicado en toda la app');
              };

              const clearLogo = () => {
                setLogoUrl('');
                setLogoInput('');
                toast.success('Logo eliminado');
              };

              const LogoOrText = ({ height, maxWidth }: { height: string; maxWidth: string }) => (
                logoInput
                  ? <img src={logoInput} alt="SOLSTICE" style={{ height, maxWidth, objectFit: 'contain', opacity: 0.92 }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                  : <p style={{ fontFamily: "'Poiret One', sans-serif", fontSize: height, color: '#F9F2D7', letterSpacing: '0.1em', fontWeight: 300, opacity: 0.5 }}>S○LSTICE</p>
              );

              return (
                <div className="space-y-8">

                  {/* ── Upload zone ── */}
                  <div className="p-5 space-y-5" style={{
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(24px)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px',
                  }}>
                    <div>
                      <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: C.cream, fontWeight: 500, letterSpacing: '0.12em' }}>Logo de marca</h2>
                      <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.12em' }}>PNG o SVG con fondo transparente. Recomendado: 600 × 200 px mínimo.</p>
                    </div>

                    {/* File drop button */}
                    <input ref={logoFileRef} type="file" accept="image/png,image/svg+xml,image/webp" onChange={handleLogoFile} className="hidden" />
                    <button
                      onClick={() => logoFileRef.current?.click()}
                      disabled={brandingLoading}
                      className="w-full flex flex-col items-center justify-center gap-3 py-8 disabled:opacity-50"
                      style={{
                        background: 'rgba(230,57,47,0.06)',
                        border: '0.5px dashed rgba(230,57,47,0.40)',
                        borderRadius: '20px',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,47,0.12)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(230,57,47,0.06)'; }}
                    >
                      {brandingLoading
                        ? <Loader2 size={22} className="animate-spin" style={{ color: C.red }} />
                        : <Image size={22} style={{ color: C.red, opacity: 0.7 }} />
                      }
                      <span className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em', fontWeight: 500 }}>
                        {brandingLoading ? 'Subiendo…' : 'Subir imagen'}
                      </span>
                    </button>

                    {/* URL input — alternative */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.08em' }}>O pega una URL directa</label>
                      <input
                        type="text"
                        value={logoInput}
                        onChange={e => setLogoInput(e.target.value)}
                        placeholder="https://…"
                        className="px-4 py-3 text-xs outline-none"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '0.5px solid rgba(255,255,255,0.12)',
                          borderRadius: '16px',
                          color: C.cream,
                          fontFamily: "'Space Mono', monospace",
                        }}
                      />
                    </div>

                    {/* Status */}
                    {logoUrl && (
                      <p className="text-[9px] uppercase flex items-center gap-2" style={{ color: C.green, letterSpacing: '0.15em', fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', boxShadow: `0 0 6px ${C.green}` }} />
                        Logo activo en toda la app
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={applyLogo}
                        disabled={!logoInput.trim() || brandingLoading}
                        className="flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-40"
                        style={{
                          background: 'rgba(230,57,47,0.20)',
                          border: '0.5px solid rgba(230,57,47,0.45)',
                          borderRadius: '999px',
                          color: C.cream,
                          padding: '10px 24px',
                          fontWeight: 500,
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(230,57,47,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                      >
                        <Image size={13} /> Aplicar logo
                      </button>
                      {logoUrl && (
                        <button
                          onClick={clearLogo}
                          className="flex items-center gap-2 text-xs uppercase tracking-widest"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '0.5px solid rgba(255,255,255,0.12)',
                            borderRadius: '999px',
                            color: C.gray,
                            padding: '10px 20px',
                            fontWeight: 500,
                            transition: 'all 0.3s ease',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.cream; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}
                        >
                          <X size={13} /> Quitar logo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Live previews ── */}
                  <div>
                    <p className="text-[9px] uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Vista previa en contexto</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {/* Splash preview */}
                      <div style={{ background: '#000', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Pantalla de carga</p>
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <LogoOrText height="1.6rem" maxWidth="140px" />
                          {!logoInput && <p style={{ fontSize: '7px', letterSpacing: '0.5em', color: 'rgba(230,57,47,0.7)', textTransform: 'uppercase', fontWeight: 500 }}>2026</p>}
                        </div>
                      </div>

                      {/* Landing hero preview */}
                      <div style={{ background: '#000', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Landing · hero</p>
                        <div className="flex flex-col items-center justify-center py-10 gap-3" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, #000 100%)' }}>
                          <LogoOrText height="2.2rem" maxWidth="160px" />
                          <p style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(230,57,47,0.8)', textTransform: 'uppercase', fontWeight: 300 }}>SELECTED BEATS. PRIVATE SUNSET.</p>
                        </div>
                      </div>

                      {/* Nav drawer preview */}
                      <div style={{ background: 'rgba(10,0,0,0.9)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Menú lateral</p>
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <LogoOrText height="1.2rem" maxWidth="90px" />
                            <p style={{ fontSize: '7px', letterSpacing: '0.15em', color: C.red, textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>2026 · ADMIN</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              );
            })()}


            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
