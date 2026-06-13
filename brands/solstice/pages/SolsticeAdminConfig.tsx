import React, { useState, useEffect, useRef } from 'react';
import { useSolsticeLogo } from '../hooks/useSolsticeLogo';
import { useSolsticeLogoSize } from '../hooks/useSolsticeLogoSize';
import { SolsticeLogoAlign, useSolsticeLogoLayout } from '../hooks/useSolsticeLogoLayout';
import { useSolsticeLogoPosition } from '../hooks/useSolsticeLogoPosition';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Calendar, DollarSign, Percent, Bell, Users,
  Save, Plus, Loader2, Copy, ToggleLeft, ToggleRight,
  X, Search, ExternalLink, Image, Star, ChevronRight,
  AlignLeft, AlignCenter, AlignRight,
  Ship, BedDouble, Trash2, Upload
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
  days?: number[];        // días activos de esta semana (ej. [1,2,3,4])
  combo_total?: number;   // precio del combo de esta semana (con descuento)
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

type Tab = 'general' | 'weeks' | 'prices' | 'commissions' | 'penalties' | 'sellers' | 'boats' | 'lodgings' | 'branding';

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
  { day_number: 3, title: 'Lanchas + Beach Club',     subtitle: 'DJ · AYCD · Bahía privada', price: 130000, price_cash: 135000, price_combo: 130000, price_monthly: 130000, image_url: '', highlight: true  },
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

// Procesa una imagen ANTES de subirla: la decodifica, la achica a máx 1920px y
// la re-exporta como JPEG. Esto (1) convierte el HEIC del iPhone a un formato que
// TODOS los navegadores muestran (Android/Chrome NO renderizan HEIC), y (2) baja
// el peso de fotos de 12-15MB a unos cientos de KB (subida más rápida y confiable
// en datos móviles). Si algo falla, devuelve el archivo original para no bloquear.
async function processImageForUpload(file: File): Promise<{ blob: Blob; contentType: string; ext: string }> {
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      // OJO: usamos createElement, no `new Image()`, porque `Image` está
      // importado de lucide-react (el ícono) y shadowea el constructor del DOM.
      const i = document.createElement('img');
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const MAX = 1920;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > MAX || height > MAX) {
      const scale = MAX / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sin contexto canvas');
    ctx.drawImage(img, 0, 0, width, height);
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('toBlob devolvió null');
    return { blob, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    // Fallback: subir el archivo original tal cual (mejor algo que nada).
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    return { blob: file, contentType: file.type || 'image/jpeg', ext };
  }
}

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
  const { blob, contentType, ext } = await processImageForUpload(file);
  const path = `solstice/days/dia-${dayNumber}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('assets').upload(path, blob, { upsert: true, contentType });
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
  const [splashSize,  setSplashSize]  = useSolsticeLogoSize('splash');
  const [landingSize, setLandingSize] = useSolsticeLogoSize('landing');
  const [drawerSize,  setDrawerSize]  = useSolsticeLogoSize('drawer');
  const [triggerSize, setTriggerSize] = useSolsticeLogoSize('trigger');
  const [landingHeroLayout, setLandingHeroLayout] = useSolsticeLogoLayout('landingHero');

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
        days:       (week.days && week.days.length > 0) ? [...week.days].sort((a, b) => a - b) : [1, 2, 3, 4, 5],
        combo_total: week.combo_total ? toInt(week.combo_total) : null,
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
        // Un solo precio por día (individual). Los demás campos se igualan al
        // precio para no romper lógica vieja que aún los lea.
        price:         toInt(day.price),
        price_cash:    toInt(day.price),
        price_combo:   toInt(day.price),
        price_monthly: toInt(day.price),
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
    { id: 'boats',       label: 'Lanchas',     icon: <Ship size={14} /> },
    { id: 'lodgings',    label: 'Hospedaje',   icon: <BedDouble size={14} /> },
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
                      {/* Días de esta semana (para "días sueltos") + precio del combo */}
                      <div className="mt-3">
                        <label className="text-[9px] uppercase block mb-2" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 600 }}>
                          Días de esta semana (los que aparecen en "días sueltos")
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {days.map(d => {
                            const cur = week.days ?? [1, 2, 3, 4, 5];
                            const active = cur.includes(d.day_number);
                            return (
                              <button key={d.day_number} type="button"
                                onClick={() => upWeek(idx, 'days', active ? cur.filter(n => n !== d.day_number) : [...cur, d.day_number])}
                                className="px-3 py-2 text-[10px] uppercase"
                                style={{
                                  background: active ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                                  border: `0.5px solid ${active ? 'rgba(230,57,47,0.5)' : 'rgba(255,255,255,0.10)'}`,
                                  color: active ? C.red : C.gray, borderRadius: '12px', fontWeight: 600,
                                }}>
                                Día {d.day_number} · ${Math.round((d.price || 0) / 1000)}K
                              </button>
                            );
                          })}
                        </div>
                        <div className="max-w-xs">
                          <InputRow
                            label={`Precio combo de esta semana (${(week.days ?? [1, 2, 3, 4, 5]).length} días)`}
                            value={week.combo_total ?? ''}
                            onChange={v => upWeek(idx, 'combo_total', v === '' ? undefined : Number(v))}
                            type="number"
                          />
                          <p className="text-[9px] mt-1" style={{ color: C.gray }}>
                            Vacío = usa el combo general de la temporada. Es el precio CON descuento (no la suma de los días sueltos).
                          </p>
                        </div>
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
                      <div className="col-span-6">Día</div>
                      <div className="col-span-4 text-center">Precio por día</div>
                      <div className="col-span-2 text-right">★</div>
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
                        <div className="col-span-6">
                          <input value={day.title} onChange={e => upDay(idx, 'title', e.target.value)}
                            className="w-full bg-transparent text-xs font-medium uppercase outline-none mb-0.5"
                            style={{ color: day.highlight ? C.red : C.cream }}
                            onFocus={e => (e.currentTarget.style.borderBottom = `0.5px solid ${C.red}`)}
                            onBlur={e => (e.currentTarget.style.borderBottom = 'none')} />
                          <input value={day.subtitle} onChange={e => upDay(idx, 'subtitle', e.target.value)}
                            className="w-full bg-transparent text-[9px] outline-none"
                            style={{ color: C.gray }} placeholder="subtítulo" />
                        </div>
                        {/* Un solo precio por día (individual) */}
                        <div className="col-span-4">
                          <div className="flex items-center gap-1 px-3 py-1.5"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '0.5px solid rgba(255,255,255,0.08)',
                              borderRadius: '14px',
                              transition: 'all 0.3s ease',
                            }}>
                            <span className="text-[9px] shrink-0" style={{ color: C.gray }}>$</span>
                            <input
                              type="number"
                              value={day.price || ''}
                              onChange={e => upDay(idx, 'price', e.target.value)}
                              className="w-full bg-transparent text-xs outline-none text-right"
                              style={{ color: C.cream }}
                              onFocus={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(230,57,47,0.55)'; }}
                              onBlur={e => { (e.currentTarget.parentElement as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                            />
                          </div>
                        </div>
                        {/* Highlight toggle */}
                        <div className="col-span-2 flex justify-end">
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
              <PenaltiesAdmin season={season} upSeason={upSeason} saveSeason={saveSeason} saving={saving} />
            )}

            {/* ── LANCHAS ── */}
            {tab === 'boats' && <BoatsAdmin seasonId={season?.id ?? null} />}

            {/* ── HOSPEDAJE ── */}
            {tab === 'lodgings' && <LodgingsAdmin seasonId={season?.id ?? null} />}

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

              const LogoOrText = ({ h, mw }: { h: string; mw: string }) => (
                logoInput
                  ? <img src={logoInput} alt="SOLSTICE" style={{ height: h, maxWidth: mw, objectFit: 'contain', opacity: 0.92 }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
                  : <p style={{ fontFamily: "'Poiret One', sans-serif", fontSize: h, color: '#F9F2D7', letterSpacing: '0.1em', fontWeight: 300, opacity: 0.45 }}>S○LSTICE</p>
              );

              const logoJustify = (align: SolsticeLogoAlign) =>
                align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

              const alignOptions: { value: SolsticeLogoAlign; label: string; icon: React.ReactNode }[] = [
                { value: 'left', label: 'Izquierda', icon: <AlignLeft size={13} /> },
                { value: 'center', label: 'Centro', icon: <AlignCenter size={13} /> },
                { value: 'right', label: 'Derecha', icon: <AlignRight size={13} /> },
              ];

              return (
                <div className="space-y-8">

                  {/* Upload zone */}
                  <div className="p-5 space-y-5" style={{
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(24px)',
                    border: '0.5px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px',
                  }}>
                    <div>
                      <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: C.cream, fontWeight: 500, letterSpacing: '0.12em' }}>Logo de marca</h2>
                      <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.12em' }}>PNG o SVG con fondo transparente · mínimo 600 × 200 px</p>
                    </div>

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

                    {logoUrl && (
                      <p className="text-[9px] uppercase flex items-center gap-2" style={{ color: C.green, letterSpacing: '0.15em', fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', boxShadow: `0 0 6px ${C.green}` }} />
                        Logo activo en toda la app
                      </p>
                    )}

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
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
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

                  {/* Live previews */}
                  <div>
                    <p className="text-[9px] uppercase mb-4" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500 }}>Vista previa en contexto</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      <div style={{ background: '#000', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Pantalla de carga</p>
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <LogoOrText h="1.6rem" mw="140px" />
                          {!logoInput && <p style={{ fontSize: '7px', letterSpacing: '0.5em', color: 'rgba(230,57,47,0.7)', textTransform: 'uppercase', fontWeight: 500 }}>2026</p>}
                        </div>
                      </div>

                      <div style={{ background: '#000', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Landing · hero</p>
                        <div className="flex flex-col items-center justify-center py-10 gap-3 px-4">
                          <div
                            className="w-full flex"
                            style={{
                              justifyContent: logoJustify(landingHeroLayout.align),
                              transform: `translate(${landingHeroLayout.x / 4}px, ${landingHeroLayout.y / 4}px)`,
                              transition: 'transform 0.2s ease',
                            }}
                          >
                            {logoInput ? (
                              <img
                                src={logoInput}
                                alt="SOLSTICE"
                                style={{ height: `${Math.max(18, landingSize / 3)}px`, maxWidth: '160px', objectFit: 'contain', opacity: 0.92 }}
                                onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                              />
                            ) : (
                              <LogoOrText h="2.2rem" mw="160px" />
                            )}
                          </div>
                          <p style={{ fontSize: '7px', letterSpacing: '0.3em', color: 'rgba(230,57,47,0.8)', textTransform: 'uppercase', fontWeight: 300 }}>SELECTED BEATS. PRIVATE SUNSET.</p>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(10,0,0,0.9)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                        <p className="px-4 pt-3 pb-2 text-[8px] uppercase" style={{ color: C.gray, letterSpacing: '0.2em', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>Menú lateral</p>
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            <LogoOrText h="1.2rem" mw="90px" />
                            <p style={{ fontSize: '7px', letterSpacing: '0.15em', color: C.red, textTransform: 'uppercase', fontWeight: 500, marginTop: 2 }}>2026 · ADMIN</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Size controls */}
                  {(logoUrl || logoInput) && (
                    <div className="p-5 space-y-5" style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(24px)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '24px',
                    }}>
                      <div>
                        <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: C.cream, fontWeight: 500, letterSpacing: '0.12em' }}>Tamaño del logo</h2>
                        <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.12em' }}>Ajusta por separado en cada sección</p>
                      </div>

                      {([
                        { label: 'Pantalla de carga', context: 'splash',  val: splashSize,  set: setSplashSize,  min: 30,  max: 200 },
                        { label: 'Landing · hero',    context: 'landing', val: landingSize, set: setLandingSize, min: 40,  max: 260 },
                        { label: 'Menú lateral',      context: 'drawer',  val: drawerSize,  set: setDrawerSize,  min: 12,  max: 80  },
                        { label: 'Botón del menú',    context: 'trigger', val: triggerSize, set: setTriggerSize, min: 8,   max: 48  },
                      ] as const).map(row => (
                        <div key={row.context} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.1em' }}>{row.label}</label>
                            <span className="text-[9px]" style={{ color: C.cream, fontFamily: "'Space Mono', monospace" }}>{row.val}px</span>
                          </div>
                          <input
                            type="range"
                            min={row.min}
                            max={row.max}
                            value={row.val}
                            onChange={e => row.set(Number(e.target.value))}
                            className="w-full"
                            style={{ accentColor: C.red, cursor: 'pointer' }}
                          />
                          <div className="flex items-center justify-center py-2" style={{
                            background: 'rgba(0,0,0,0.40)',
                            border: '0.5px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
                            minHeight: '2.5rem',
                          }}>
                            <img
                              src={logoInput || logoUrl}
                              alt="preview"
                              style={{ height: `${row.val}px`, maxWidth: '100%', objectFit: 'contain', opacity: 0.9 }}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hero position controls */}
                  {(logoUrl || logoInput) && (
                    <div className="p-5 space-y-5" style={{
                      background: 'rgba(255,255,255,0.03)',
                      backdropFilter: 'blur(24px)',
                      border: '0.5px solid rgba(255,255,255,0.08)',
                      borderRadius: '24px',
                    }}>
                      <div>
                        <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: C.cream, fontWeight: 500, letterSpacing: '0.12em' }}>Posición en Landing · hero</h2>
                        <p className="text-[10px] uppercase" style={{ color: C.gray, letterSpacing: '0.12em' }}>Ajusta el logo principal sin tocar código</p>
                      </div>

                      <div className="relative h-52 overflow-hidden" style={{
                        borderRadius: '20px',
                        border: '0.5px solid rgba(255,255,255,0.08)',
                        background: '#000',
                      }}>
                        <img
                          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=900"
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ filter: 'grayscale(60%) brightness(0.42)' }}
                        />
                        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.64)' }} />
                        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
                          <div
                            className="w-full flex mb-4"
                            style={{
                              justifyContent: logoJustify(landingHeroLayout.align),
                              transform: `translate(${landingHeroLayout.x / 2}px, ${landingHeroLayout.y / 2}px)`,
                              transition: 'transform 0.2s ease',
                            }}
                          >
                            <img
                              src={logoInput || logoUrl}
                              alt="SOLSTICE hero preview"
                              style={{ height: `${Math.max(34, landingSize / 2)}px`, maxWidth: '80%', objectFit: 'contain', opacity: 0.95 }}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
                            />
                          </div>
                          <p className="text-center" style={{ fontSize: '8px', letterSpacing: '0.16em', color: C.red, fontWeight: 300 }}>SELECTED BEATS. PRIVATE SUNSET.</p>
                          <p className="text-center uppercase mt-2" style={{ fontSize: '7px', letterSpacing: '0.08em', color: C.gray, fontWeight: 500 }}>Santa Marta · Sep-Oct 2026</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.1em' }}>Alineación</label>
                          <div className="grid grid-cols-3 gap-2">
                            {alignOptions.map(opt => {
                              const active = landingHeroLayout.align === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setLandingHeroLayout({ align: opt.value })}
                                  className="flex items-center justify-center gap-2 py-2 text-[9px] uppercase tracking-wider"
                                  style={{
                                    background: active ? 'rgba(230,57,47,0.20)' : 'rgba(255,255,255,0.04)',
                                    border: `0.5px solid ${active ? 'rgba(230,57,47,0.55)' : 'rgba(255,255,255,0.08)'}`,
                                    borderRadius: '999px',
                                    color: active ? C.cream : C.gray,
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {opt.icon}
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {([
                          { label: 'Movimiento horizontal', key: 'x', value: landingHeroLayout.x, min: -160, max: 160 },
                          { label: 'Movimiento vertical', key: 'y', value: landingHeroLayout.y, min: -180, max: 180 },
                        ] as const).map(row => (
                          <div key={row.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] uppercase" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.1em' }}>{row.label}</label>
                              <span className="text-[9px]" style={{ color: C.cream, fontFamily: "'Space Mono', monospace" }}>{row.value}px</span>
                            </div>
                            <input
                              type="range"
                              min={row.min}
                              max={row.max}
                              value={row.value}
                              onChange={e => setLandingHeroLayout({ [row.key]: Number(e.target.value) })}
                              className="w-full"
                              style={{ accentColor: C.red, cursor: 'pointer' }}
                            />
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => setLandingHeroLayout({ align: 'center', x: 0, y: 0 })}
                          className="text-[10px] uppercase tracking-widest"
                          style={{
                            color: C.gray,
                            border: '0.5px solid rgba(255,255,255,0.10)',
                            borderRadius: '999px',
                            padding: '9px 16px',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.cream; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.gray; }}
                        >
                          Resetear posición del hero
                        </button>
                      </div>
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


            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Lanchas
// ─────────────────────────────────────────────────────────────────────────────

interface Boat {
  id: string;
  season_id: string | null;
  name: string;
  image_url: string | null;
  gallery: string[];          // URLs en orden, la primera es la portada
  capacity: number;
  price_per_person: number;
  description: string | null;
  status: 'active' | 'sold_out' | 'hidden' | 'archived';
  sort_order: number;
}

function BoatsAdmin({ seasonId }: { seasonId: string | null }) {
  const [boats, setBoats] = useState<Boat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  // Descripción general que se muestra ARRIBA de todas las lanchas en la vitrina.
  const [intro, setIntro] = useState('');
  const [introSaving, setIntroSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('solstice_boats')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      setBoats((data as Boat[]) ?? []);
      setLoading(false);
      const { data: cfg } = await supabase
        .from('solstice_config').select('value').eq('key', 'boats_intro').maybeSingle();
      if (cfg?.value) setIntro(typeof cfg.value === 'string' ? cfg.value : String(cfg.value));
    })();
  }, []);

  const saveIntro = async () => {
    setIntroSaving(true);
    try {
      await supabase.from('solstice_config').upsert(
        { key: 'boats_intro', value: intro, updated_at: new Date().toISOString() },
        { onConflict: 'key' });
      toast.success('Descripción guardada');
    } catch (e: any) { toast.error(e?.message || 'Error'); }
    finally { setIntroSaving(false); }
  };

  const addBoat = async () => {
    const newBoat = {
      season_id: seasonId,
      name: 'Nueva lancha',
      capacity: 50,
      price_per_person: 130000,
      description: '',
      status: 'active' as const,
      sort_order: boats.length,
      gallery: [],
    };
    const { data, error } = await supabase.from('solstice_boats').insert(newBoat).select().single();
    if (error) { toast.error('No se pudo crear la lancha'); return; }
    setBoats(prev => [...prev, data as Boat]);
    toast.success('Lancha creada');
  };

  const updateBoat = async (id: string, patch: Partial<Boat>) => {
    setBoats(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const saveBoat = async (boat: Boat) => {
    setSaving(boat.id);
    const { error } = await supabase.from('solstice_boats').update({
      name: boat.name,
      image_url: boat.image_url,
      gallery: boat.gallery ?? [],
      capacity: boat.capacity,
      price_per_person: boat.price_per_person,
      description: boat.description,
      status: boat.status,
      sort_order: boat.sort_order,
      updated_at: new Date().toISOString(),
    }).eq('id', boat.id);
    setSaving(null);
    if (error) toast.error('Error al guardar');
    else toast.success('Lancha guardada');
  };

  const deleteBoat = async (id: string) => {
    if (!confirm('¿Eliminar esta lancha? Las reservas existentes no se borran.')) return;
    const { error } = await supabase.from('solstice_boats').delete().eq('id', id);
    if (error) { toast.error('No se pudo eliminar (¿tiene reservas?)'); return; }
    setBoats(prev => prev.filter(b => b.id !== id));
    toast.success('Eliminada');
  };

  if (loading) return <div className="py-12 text-center text-xs uppercase" style={{ color: '#606060' }}><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '0.04em', color: '#F9F2D7' }}>
            Lanchas + Beach Club
          </h2>
          <p className="text-[10px] uppercase" style={{ color: '#606060', letterSpacing: '0.25em', fontWeight: 500 }}>
            Inventario para el Día 3 · Combos que incluyen lancha eligen su lancha aquí
          </p>
        </div>
        <button
          onClick={addBoat}
          className="inline-flex items-center gap-2 px-4 py-2 text-[10px] uppercase"
          style={{
            background: 'rgba(230,57,47,0.25)',
            border: '0.5px solid rgba(230,57,47,0.55)',
            borderRadius: '999px',
            color: '#F9F2D7',
            letterSpacing: '0.25em',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={12} /> Agregar lancha
        </button>
      </div>

      {/* Descripción general — se muestra arriba de todas las lanchas en la vitrina */}
      <div className="p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.10)', borderRadius: '16px' }}>
        <label className="text-[9px] uppercase block mb-2" style={{ color: '#606060', letterSpacing: '0.25em', fontWeight: 600 }}>
          Descripción arriba de todas las lanchas (vitrina)
        </label>
        <textarea
          value={intro}
          onChange={e => setIntro(e.target.value)}
          rows={3}
          placeholder="Ej: Todas las lanchas salen el Día 3 a la bahía privada con DJ y barra libre. Elegí la tuya según capacidad y vibra."
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs outline-none resize-y"
          style={{ color: '#F9F2D7' }}
        />
        <div className="flex justify-end mt-2">
          <button onClick={saveIntro} disabled={introSaving}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase"
            style={{ background: 'rgba(230,57,47,0.22)', border: '0.5px solid rgba(230,57,47,0.5)', borderRadius: '999px', color: '#F9F2D7', letterSpacing: '0.2em', fontWeight: 600, opacity: introSaving ? 0.5 : 1 }}>
            {introSaving ? 'Guardando…' : 'Guardar descripción'}
          </button>
        </div>
      </div>

      {boats.length === 0 ? (
        <div className="py-16 text-center" style={{
          border: '0.5px dashed rgba(255,255,255,0.10)',
          borderRadius: '24px',
          color: '#606060',
        }}>
          <Ship size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-xs uppercase" style={{ letterSpacing: '0.25em', fontWeight: 500 }}>Sin lanchas aún · Agregá la primera</p>
        </div>
      ) : (
        <div className="space-y-4">
          {boats.map(boat => (
            <BoatCard
              key={boat.id}
              boat={boat}
              saving={saving === boat.id}
              onChange={patch => updateBoat(boat.id, patch)}
              onSave={() => saveBoat(boat)}
              onDelete={() => deleteBoat(boat.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BoatCard({ boat, saving, onChange, onSave, onDelete }: {
  boat: Boat; saving: boolean;
  onChange: (p: Partial<Boat>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const gallery = boat.gallery ?? [];
  // Cover: primera foto de galería, si no hay caemos a image_url legacy
  const cover = gallery[0] || boat.image_url || null;

  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(Array.from(files).map(async (file) => {
        const { blob, contentType, ext } = await processImageForUpload(file);
        const rand = Math.random().toString(36).substring(2, 10);
        const path = `solstice/boats/${boat.id}/${Date.now()}-${rand}.${ext}`;
        const { error: upErr } = await supabase.storage.from('assets').upload(path, blob, {
          contentType,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('assets').getPublicUrl(path);
        return data.publicUrl;
      }));
      const newGallery = [...gallery, ...uploads];
      onChange({ gallery: newGallery, image_url: boat.image_url || uploads[0] });
      toast.success(`${uploads.length} ${uploads.length === 1 ? 'foto subida' : 'fotos subidas'} · acordate de guardar`);
    } catch (err: any) {
      toast.error('Error al subir: ' + (err?.message || 'desconocido'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    const newGallery = gallery.filter((_, i) => i !== idx);
    onChange({ gallery: newGallery });
  };

  const moveToCover = (idx: number) => {
    if (idx === 0) return;
    const newGallery = [...gallery];
    const [moved] = newGallery.splice(idx, 1);
    newGallery.unshift(moved);
    onChange({ gallery: newGallery });
  };

  return (
    <div
      className="p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: '24px',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5">
        <div className="aspect-square rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
          {cover ? (
            <img src={cover} alt={boat.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Ship size={24} style={{ color: '#606060' }} /></div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SolInput label="Nombre"          value={boat.name}              onChange={v => onChange({ name: v })} />
            <SolInput label="URL imagen portada (legacy)" value={boat.image_url ?? ''} onChange={v => onChange({ image_url: v || null })} placeholder="opcional — se usa si no hay galería" />
          </div>

          {/* ── Galería de fotos ────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[9px] uppercase" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>
                Galería · {gallery.length} {gallery.length === 1 ? 'foto' : 'fotos'}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[9px] uppercase"
                style={{
                  background: 'rgba(230,57,47,0.15)',
                  border: '0.5px solid rgba(230,57,47,0.45)',
                  borderRadius: '999px',
                  color: '#F9F2D7',
                  letterSpacing: '0.2em',
                  fontWeight: 600,
                  cursor: uploading ? 'wait' : 'pointer',
                  opacity: uploading ? 0.5 : 1,
                }}
              >
                {uploading ? <><Loader2 size={10} className="animate-spin" /> Subiendo…</> : <><Plus size={10} /> Subir fotos</>}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={e => handleFiles(e.target.files)}
              />
            </div>
            {gallery.length === 0 ? (
              <div className="py-6 text-center text-[10px] uppercase" style={{
                border: '0.5px dashed rgba(255,255,255,0.10)',
                borderRadius: '12px',
                color: '#606060',
                letterSpacing: '0.2em',
                fontWeight: 500,
              }}>
                Sin fotos · podés subir varias a la vez
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {gallery.map((url, idx) => (
                  <div key={url} className="relative group aspect-square rounded-lg overflow-hidden"
                    style={{ border: idx === 0 ? '1px solid rgba(230,57,47,0.55)' : '0.5px solid rgba(255,255,255,0.10)' }}>
                    <img src={url} alt={`Foto ${idx+1}`} className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[7px] uppercase"
                        style={{ background: 'rgba(230,57,47,0.85)', color: '#fff', borderRadius: '4px', letterSpacing: '0.15em', fontWeight: 700 }}>
                        Portada
                      </span>
                    )}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.6)' }}>
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => moveToCover(idx)}
                          title="Poner como portada"
                          className="p-1.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
                        >
                          <Star size={11} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        title="Eliminar"
                        className="p-1.5 rounded-full"
                        style={{ background: 'rgba(230,57,47,0.85)', color: '#fff' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SolInput label="Capacidad" type="number" value={String(boat.capacity)}         onChange={v => onChange({ capacity: Number(v) })} />
            <SolInput label="Precio/persona ($)" type="number" value={String(boat.price_per_person)} onChange={v => onChange({ price_per_person: Number(v) })} />
            <div>
              <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>Estado</label>
              <select
                value={boat.status}
                onChange={e => onChange({ status: e.target.value as Boat['status'] })}
                className="w-full text-xs"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  borderRadius: '12px',
                  color: '#F9F2D7',
                  padding: '10px 12px',
                  outline: 'none',
                }}
              >
                <option value="active">Activa</option>
                <option value="sold_out">Agotada</option>
                <option value="hidden">Oculta</option>
                <option value="archived">Archivada</option>
              </select>
            </div>
            <SolInput label="Orden" type="number" value={String(boat.sort_order)} onChange={v => onChange({ sort_order: Number(v) })} />
          </div>
          <div>
            <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>Descripción</label>
            <textarea
              value={boat.description ?? ''}
              onChange={e => onChange({ description: e.target.value })}
              rows={2}
              placeholder="DJ en altamar · All You Can Drink · Bahía privada"
              className="w-full text-xs"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '12px',
                color: '#F9F2D7',
                padding: '10px 12px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onDelete} className="p-2 rounded-full" style={{ border: '0.5px solid rgba(230,57,47,0.30)', color: '#E6392F' }} aria-label="Eliminar">
              <Trash2 size={14} />
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] uppercase"
              style={{
                background: saving ? 'rgba(230,57,47,0.15)' : 'rgba(230,57,47,0.25)',
                border: '0.5px solid rgba(230,57,47,0.55)',
                borderRadius: '999px',
                color: '#F9F2D7',
                letterSpacing: '0.25em',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Guardando' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Hospedaje
// ─────────────────────────────────────────────────────────────────────────────

interface Lodging {
  id: string;
  season_id: string | null;
  name: string;
  image_url: string | null;
  description: string | null;
  price_per_night: number;
  price_per_person: number;
  total_units: number;
  units_available: number;
  category: 'budget' | 'standard' | 'premium' | 'vip';
  status: 'active' | 'sold_out' | 'hidden' | 'archived';
  address: string | null;
  google_maps_url: string | null;
  sort_order: number;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
}

function LodgingsAdmin({ seasonId }: { seasonId: string | null }) {
  const [lodgings, setLodgings] = useState<Lodging[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('solstice_lodgings')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      setLodgings((data as Lodging[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const addLodging = async () => {
    const newL = {
      season_id: seasonId,
      name: 'Nuevo hospedaje',
      category: 'standard' as const,
      price_per_night: 80000,
      price_per_person: 0,
      total_units: 10,
      units_available: 10,
      status: 'active' as const,
      sort_order: lodgings.length,
    };
    const { data, error } = await supabase.from('solstice_lodgings').insert(newL).select().single();
    if (error) { toast.error('No se pudo crear'); return; }
    setLodgings(prev => [...prev, data as Lodging]);
    toast.success('Hospedaje creado');
  };

  const updateL = (id: string, patch: Partial<Lodging>) => {
    setLodgings(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const saveL = async (l: Lodging) => {
    setSaving(l.id);
    const { error } = await supabase.from('solstice_lodgings').update({
      name: l.name,
      image_url: l.image_url,
      description: l.description,
      price_per_night: l.price_per_night,
      price_per_person: l.price_per_person,
      total_units: l.total_units,
      units_available: l.units_available,
      category: l.category,
      status: l.status,
      address: l.address,
      google_maps_url: l.google_maps_url,
      sort_order: l.sort_order,
      owner_name: l.owner_name,
      owner_email: l.owner_email,
      owner_phone: l.owner_phone,
      updated_at: new Date().toISOString(),
    }).eq('id', l.id);
    setSaving(null);
    if (error) toast.error('Error al guardar');
    else toast.success('Guardado');
  };

  const deleteL = async (id: string) => {
    if (!confirm('¿Eliminar este hospedaje?')) return;
    const { error } = await supabase.from('solstice_lodgings').delete().eq('id', id);
    if (error) { toast.error('No se pudo eliminar'); return; }
    setLodgings(prev => prev.filter(l => l.id !== id));
    toast.success('Eliminado');
  };

  if (loading) return <div className="py-12 text-center"><Loader2 className="animate-spin mx-auto" style={{ color: '#606060' }} /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl uppercase mb-1" style={{ fontFamily: "'Poiret One', sans-serif", fontWeight: 300, letterSpacing: '0.04em', color: '#F9F2D7' }}>
            Hospedajes
          </h2>
          <p className="text-[10px] uppercase" style={{ color: '#606060', letterSpacing: '0.25em', fontWeight: 500 }}>
            Catálogo upsell post-compra · El cliente recibe el link después de pagar
          </p>
        </div>
        <button
          onClick={addLodging}
          className="inline-flex items-center gap-2 px-4 py-2 text-[10px] uppercase"
          style={{
            background: 'rgba(230,57,47,0.25)',
            border: '0.5px solid rgba(230,57,47,0.55)',
            borderRadius: '999px',
            color: '#F9F2D7',
            letterSpacing: '0.25em',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={12} /> Agregar hospedaje
        </button>
      </div>

      {lodgings.length === 0 ? (
        <div className="py-16 text-center" style={{
          border: '0.5px dashed rgba(255,255,255,0.10)',
          borderRadius: '24px',
          color: '#606060',
        }}>
          <BedDouble size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-xs uppercase" style={{ letterSpacing: '0.25em', fontWeight: 500 }}>Sin hospedajes aún · Agregá el primero</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lodgings.map(l => (
            <LodgingCard
              key={l.id}
              lodging={l}
              saving={saving === l.id}
              onChange={p => updateL(l.id, p)}
              onSave={() => saveL(l)}
              onDelete={() => deleteL(l.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LodgingCard({ lodging, saving, onChange, onSave, onDelete }: {
  lodging: Lodging; saving: boolean;
  onChange: (p: Partial<Lodging>) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="p-5"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(24px)',
        border: '0.5px solid rgba(255,255,255,0.10)',
        borderRadius: '24px',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-5">
        <div className="aspect-square rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.10)' }}>
          {lodging.image_url ? (
            <img src={lodging.image_url} alt={lodging.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><BedDouble size={24} style={{ color: '#606060' }} /></div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SolInput label="Nombre"     value={lodging.name}            onChange={v => onChange({ name: v })} />
            <SolInput label="URL imagen" value={lodging.image_url ?? ''} onChange={v => onChange({ image_url: v || null })} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SolInput label="Precio/noche ($)" type="number" value={String(lodging.price_per_night)}   onChange={v => onChange({ price_per_night: Number(v) })} />
            <SolInput label="Precio/persona ($)" type="number" value={String(lodging.price_per_person)} onChange={v => onChange({ price_per_person: Number(v) })} />
            <SolInput label="Total unidades" type="number" value={String(lodging.total_units)}        onChange={v => onChange({ total_units: Number(v) })} />
            <SolInput label="Disponibles" type="number" value={String(lodging.units_available)}       onChange={v => onChange({ units_available: Number(v) })} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>Categoría</label>
              <select
                value={lodging.category}
                onChange={e => onChange({ category: e.target.value as Lodging['category'] })}
                className="w-full text-xs"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  borderRadius: '12px',
                  color: '#F9F2D7',
                  padding: '10px 12px',
                  outline: 'none',
                }}
              >
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>Estado</label>
              <select
                value={lodging.status}
                onChange={e => onChange({ status: e.target.value as Lodging['status'] })}
                className="w-full text-xs"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  borderRadius: '12px',
                  color: '#F9F2D7',
                  padding: '10px 12px',
                  outline: 'none',
                }}
              >
                <option value="active">Activo</option>
                <option value="sold_out">Agotado</option>
                <option value="hidden">Oculto</option>
                <option value="archived">Archivado</option>
              </select>
            </div>
            <SolInput label="Orden" type="number" value={String(lodging.sort_order)} onChange={v => onChange({ sort_order: Number(v) })} />
          </div>
          <SolInput label="Dirección"        value={lodging.address ?? ''}         onChange={v => onChange({ address: v || null })} />
          <SolInput label="Google Maps URL"  value={lodging.google_maps_url ?? ''} onChange={v => onChange({ google_maps_url: v || null })} placeholder="https://maps.google.com/..." />

          {/* Datos del operador del hospedaje — para notificaciones automáticas */}
          <div className="pt-2 mt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] uppercase mb-3" style={{ letterSpacing: '0.3em', color: '#FFB48C', fontWeight: 600 }}>
              Contacto del operador (recibe email al reservarse)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SolInput label="Nombre"   value={lodging.owner_name  ?? ''} onChange={v => onChange({ owner_name:  v || null })} placeholder="Manager / dueño" />
              <SolInput label="Email"    type="email" value={lodging.owner_email ?? ''} onChange={v => onChange({ owner_email: v || null })} placeholder="ops@hotel.com" />
              <SolInput label="WhatsApp" type="tel"   value={lodging.owner_phone ?? ''} onChange={v => onChange({ owner_phone: v || null })} placeholder="+57 300 ..." />
            </div>
            <p className="text-[10px] mt-2" style={{ color: '#606060aa', lineHeight: 1.5 }}>
              Si dejás el email vacío, las notificaciones van al fallback ops (hospedaje@midnightcorp.click).
            </p>
          </div>
          <div>
            <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>Descripción</label>
            <textarea
              value={lodging.description ?? ''}
              onChange={e => onChange({ description: e.target.value })}
              rows={2}
              className="w-full text-xs"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '12px',
                color: '#F9F2D7',
                padding: '10px 12px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onDelete} className="p-2 rounded-full" style={{ border: '0.5px solid rgba(230,57,47,0.30)', color: '#E6392F' }} aria-label="Eliminar">
              <Trash2 size={14} />
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] uppercase"
              style={{
                background: saving ? 'rgba(230,57,47,0.15)' : 'rgba(230,57,47,0.25)',
                border: '0.5px solid rgba(230,57,47,0.55)',
                borderRadius: '999px',
                color: '#F9F2D7',
                letterSpacing: '0.25em',
                fontWeight: 600,
                cursor: 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Guardando' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PenaltiesAdmin: combina campos legacy de Season + tabla singleton solstice_penalties ──
interface PenaltyConfig {
  late_payment_pct: number;
  grace_period_days: number;
  lock_combo_after_overdue: number;
  no_show_penalty_pct: number;
  cancellation_refund_pct: number;
  cancellation_deadline_days: number;
  whatsapp_reminder_days_before: number;
}

function PenaltiesAdmin({ season, upSeason, saveSeason, saving }: {
  season: Season;
  upSeason: (k: keyof Season, v: any) => void;
  saveSeason: () => void;
  saving: boolean;
}) {
  const [pen, setPen]       = useState<PenaltyConfig | null>(null);
  const [savingPen, setSavingPen] = useState(false);

  useEffect(() => {
    supabase
      .from('solstice_penalties')
      .select('late_payment_pct, grace_period_days, lock_combo_after_overdue, no_show_penalty_pct, cancellation_refund_pct, cancellation_deadline_days, whatsapp_reminder_days_before')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPen(data as PenaltyConfig);
        else setPen({
          late_payment_pct: 5,
          grace_period_days: 7,
          lock_combo_after_overdue: 2,
          no_show_penalty_pct: 100,
          cancellation_refund_pct: 100,
          cancellation_deadline_days: 14,
          whatsapp_reminder_days_before: 3,
        });
      });
  }, []);

  const upPen = (k: keyof PenaltyConfig, v: any) => {
    if (!pen) return;
    setPen({ ...pen, [k]: v });
  };

  const savePen = async () => {
    if (!pen) return;
    setSavingPen(true);
    try {
      const { error } = await supabase
        .from('solstice_penalties')
        .upsert({ id: 1, ...pen, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
      toast.success('Penalidades guardadas');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSavingPen(false);
    }
  };

  if (!pen) {
    return <div className="text-xs uppercase py-12 text-center" style={{ color: C.gray, letterSpacing: '0.2em' }}>Cargando configuración...</div>;
  }

  const card = {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(24px)',
    border: '0.5px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
  } as const;

  return (
    <div className="space-y-8">
      {/* Bloque 1: Recordatorios automáticos */}
      <div className="space-y-4 p-5" style={card}>
        <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Recordatorios automáticos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputRow
            label="Días antes del cobro para avisar por WhatsApp"
            value={pen.whatsapp_reminder_days_before}
            onChange={v => upPen('whatsapp_reminder_days_before', Number(v))}
            type="number"
          />
          <InputRow
            label="Días antes del vencimiento (primer aviso email)"
            value={season.warning_days_before}
            onChange={v => upSeason('warning_days_before', Number(v))}
            type="number"
          />
        </div>
        <p className="text-[10px] uppercase leading-relaxed p-3" style={{
          background: 'rgba(16,185,129,0.06)', border: '0.5px solid rgba(16,185,129,0.20)',
          borderRadius: '12px', color: '#10b981', letterSpacing: '0.12em',
        }}>
          WhatsApp se manda {pen.whatsapp_reminder_days_before} día(s) antes de cada cobro · Email refuerza {season.warning_days_before} día(s) antes
        </p>
      </div>

      {/* Bloque 2: Mora y recargos */}
      <div className="space-y-4 p-5" style={card}>
        <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Mora y recargos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputRow
            label="% de recargo por pago tardío"
            value={pen.late_payment_pct}
            onChange={v => upPen('late_payment_pct', Number(v))}
            type="number"
          />
          <InputRow
            label="Días de gracia antes del recargo"
            value={pen.grace_period_days}
            onChange={v => upPen('grace_period_days', Number(v))}
            type="number"
          />
          <InputRow
            label="Cuotas en mora para bloquear combo"
            value={pen.lock_combo_after_overdue}
            onChange={v => upPen('lock_combo_after_overdue', Number(v))}
            type="number"
          />
        </div>
        <div className="p-4 text-[10px] leading-relaxed uppercase" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(230,57,47,0.20)',
          borderRadius: '16px',
          color: C.gray,
          letterSpacing: '0.12em',
        }}>
          Después de {pen.grace_period_days} días sin pago se aplica {pen.late_payment_pct}% de recargo.
          Con {pen.lock_combo_after_overdue} cuota(s) atrasada(s) el acceso al combo queda bloqueado.
        </div>
      </div>

      {/* Bloque 3: Penalidad Día 3 — Lanchas + Beach Club */}
      <div className="space-y-4 p-5" style={card}>
        <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Día 3 · Lanchas + Beach Club</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputRow
            label="Cuotas en mora para perder el Día 3"
            value={season.penalty_catamaran_at}
            onChange={v => upSeason('penalty_catamaran_at', Number(v))}
            type="number"
          />
        </div>
        <div className="p-4 text-[10px] leading-relaxed uppercase" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(230,57,47,0.20)',
          borderRadius: '16px',
          color: C.gray,
          letterSpacing: '0.12em',
        }}>
          Con {season.penalty_catamaran_at} cuota(s) en mora al llegar el evento, el comprador pierde acceso al Catamarán.
        </div>
      </div>

      {/* Bloque 4: No-show y cancelaciones */}
      <div className="space-y-4 p-5" style={card}>
        <h2 className="text-xs uppercase tracking-widest" style={{ color: C.gray, fontWeight: 500, letterSpacing: '0.06em' }}>Cancelaciones y no-show</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputRow
            label="% que se queda Solstice si no asiste"
            value={pen.no_show_penalty_pct}
            onChange={v => upPen('no_show_penalty_pct', Number(v))}
            type="number"
          />
          <InputRow
            label="% reembolso si cancela a tiempo"
            value={pen.cancellation_refund_pct}
            onChange={v => upPen('cancellation_refund_pct', Number(v))}
            type="number"
          />
          <InputRow
            label="Días mínimos antes del evento"
            value={pen.cancellation_deadline_days}
            onChange={v => upPen('cancellation_deadline_days', Number(v))}
            type="number"
          />
        </div>
        <div className="p-4 text-[10px] leading-relaxed uppercase" style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(230,57,47,0.20)',
          borderRadius: '16px',
          color: C.gray,
          letterSpacing: '0.12em',
        }}>
          Cancelaciones {pen.cancellation_deadline_days}+ días antes → reembolso del {pen.cancellation_refund_pct}%.
          No-show → Solstice retiene el {pen.no_show_penalty_pct}% de lo pagado.
        </div>
      </div>

      <div className="pt-2 flex gap-3">
        <SaveBtn loading={saving} onClick={saveSeason} />
        <button
          onClick={savePen}
          disabled={savingPen}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase"
          style={{
            background: 'rgba(230,57,47,0.18)',
            border: '0.5px solid rgba(230,57,47,0.50)',
            color: C.cream,
            letterSpacing: '0.2em',
            borderRadius: '999px',
            fontWeight: 600,
            opacity: savingPen ? 0.4 : 1,
            cursor: savingPen ? 'not-allowed' : 'pointer',
          }}
        >
          {savingPen ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar reglas globales
        </button>
      </div>
    </div>
  );
}

// Helper input reutilizable
function SolInput({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: '#606060', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: '12px',
          color: '#F9F2D7',
          padding: '10px 12px',
          outline: 'none',
        }}
      />
    </div>
  );
}
