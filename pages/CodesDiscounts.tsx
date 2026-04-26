import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Users, Percent, Plus, X, Copy, Check, Loader2, ToggleLeft, ToggleRight, ExternalLink, ChevronDown, ChevronUp, Printer, Trash2 } from 'lucide-react';
import { RuletaAdmin } from '../components/RuletaAdmin';
import { supabase } from '../lib/supabase';
import { useStore } from '../context/StoreContext';

type Tab = 'campañas' | 'ruleta';
type CampaignType = 'guest_list' | 'discount' | 'ruleta';

interface Benefit { id: number; label: string; color: string; prob: number; }
interface Campaign { id: string; code: string; type: CampaignType; label: string; event_id: string; active: boolean; free_until: string | null; discount_pct: number | null; tier_id: string | null; tier_name: string | null; benefits: Benefit[] | null; benefit_valid_hours: number; created_at: string; }

const TYPE_META: Record<CampaignType, { label: string; icon: React.ReactNode; urlBase: string; color: string }> = {
  guest_list: { label: 'Guest List',  icon: <Users  size={12} />, urlBase: '/gl/',    color: '#4A9EFF' },
  discount:   { label: 'Descuento',   icon: <Percent size={12}/>, urlBase: '/d/',     color: '#4ADE80' },
  ruleta:     { label: 'Ruleta',      icon: <Tag    size={12} />, urlBase: '/promo/', color: '#C9A84C' },
};

const DEFAULT_BENEFITS: Benefit[] = [
  { id: 1, label: '2x1 en tragos',    color: '#C9A84C', prob: 30 },
  { id: 2, label: 'Shot gratis',       color: '#8B1A1A', prob: 25 },
  { id: 3, label: 'Mesa VIP 30 min',  color: '#1A1A4E', prob: 10 },
  { id: 4, label: 'Entrada sin fila', color: '#2D5A27', prob: 20 },
  { id: 5, label: 'Botella a mitad',  color: '#4A2060', prob:  5 },
  { id: 6, label: 'Trago de la casa', color: '#8B5A1A', prob: 10 },
];

function genCode(type: CampaignType) {
  const p = type === 'guest_list' ? 'GL' : type === 'discount' ? 'DC' : 'PR';
  return `${p}-${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
}

export const CodesDiscounts: React.FC = () => {
  const { events, getEventTiers } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('campañas');

  // Campaign list
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [copiedCode,   setCopiedCode]   = useState<string | null>(null);

  // Create form
  const [showForm,     setShowForm]     = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [newType,      setNewType]      = useState<CampaignType>('guest_list');
  const [newLabel,     setNewLabel]     = useState('');
  const [newEventId,   setNewEventId]   = useState('');
  const [newFreeUntil, setNewFreeUntil] = useState('');
  const [newDiscPct,   setNewDiscPct]   = useState(20);
  const [newTierId,    setNewTierId]    = useState('');
  const [newBenefits,  setNewBenefits]  = useState<Benefit[]>(DEFAULT_BENEFITS);
  const [newValidHrs,  setNewValidHrs]  = useState(12);
  const [newBenLabel,  setNewBenLabel]  = useState('');
  const [newBenColor,  setNewBenColor]  = useState('#C9A84C');
  const [newBenProb,   setNewBenProb]   = useState(10);

  // Per-campaign leads accordion
  interface CampaignLead { id: string; name: string; email: string; benefit: string | null; benefit_color: string | null; registered_at: string; }
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [leadsCache,     setLeadsCache]     = useState<Record<string, CampaignLead[]>>({});
  const [loadingLeadsId, setLoadingLeadsId] = useState<string | null>(null);

  const toggleLeads = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (leadsCache[id]) return;
    setLoadingLeadsId(id);
    const { data } = await supabase
      .from('campaign_leads')
      .select('id, name, email, benefit, benefit_color, registered_at')
      .eq('campaign_id', id)
      .order('registered_at', { ascending: false });
    setLeadsCache(prev => ({ ...prev, [id]: (data ?? []) as CampaignLead[] }));
    setLoadingLeadsId(null);
  }, [expandedId, leadsCache]);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    setLoading(true);
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) || []);
    setLoading(false);
  }

  async function createCampaign() {
    if (!newLabel.trim() || !newEventId) return;
    setCreating(true);
    const code = genCode(newType);
    const payload: any = { code, type: newType, label: newLabel.trim(), event_id: newEventId, active: true };
    if (newType === 'guest_list') payload.free_until = newFreeUntil || null;
    if (newType === 'discount') {
      payload.discount_pct = newDiscPct;
      if (newTierId) {
        const t = getEventTiers(newEventId).find(t => t.id === newTierId);
        payload.tier_id   = newTierId;
        payload.tier_name = t?.name ?? null;
      }
    }
    if (newType === 'ruleta')     { payload.benefits = newBenefits; payload.benefit_valid_hours = newValidHrs; }
    const { error } = await supabase.from('campaigns').insert(payload);
    if (!error) { resetForm(); await loadCampaigns(); }
    setCreating(false);
  }

  function resetForm() {
    setShowForm(false); setNewLabel(''); setNewEventId(''); setNewFreeUntil('');
    setNewDiscPct(20); setNewTierId(''); setNewBenefits(DEFAULT_BENEFITS); setNewValidHrs(12); setNewBenLabel(''); setNewBenProb(10); setNewBenColor('#C9A84C');
  }

  async function deleteCampaign(id: string) {
    if (!window.confirm('¿Eliminar esta campaña permanentemente? Se borrarán también todos los participantes.')) return;
    await supabase.from('campaigns').delete().eq('id', id);
    setCampaigns(p => p.filter(c => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function toggleCampaign(id: string, active: boolean) {
    await supabase.from('campaigns').update({ active: !active }).eq('id', id);
    setCampaigns(p => p.map(c => c.id === id ? { ...c, active: !active } : c));
  }

  function copyLink(type: CampaignType, code: string) {
    const url = `https://midnightcorp.click${TYPE_META[type].urlBase}${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function addBenefit() {
    if (!newBenLabel.trim()) return;
    setNewBenefits(p => [...p, { id: Date.now(), label: newBenLabel.trim(), color: newBenColor, prob: newBenProb }]);
    setNewBenLabel(''); setNewBenProb(10); setNewBenColor('#C9A84C');
  }

  const totalProb = newBenefits.reduce((s, b) => s + b.prob, 0);
  const totalOk   = Math.abs(totalProb - 100) < 1;

  const tabBtn = (tab: Tab, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${activeTab === tab ? 'bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20' : 'text-white/25 hover:text-white/60'}`}
    >{icon}{label}</button>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-[#C9A84C]/60 mb-2">Admin</p>
        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Códigos & Descuentos</h1>
        <p className="text-white/25 text-xs font-light tracking-[0.2em] uppercase mt-2">Gestión de campañas, guest list y beneficios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-10 bg-white/[0.02] border border-white/5 rounded-xl p-1 w-fit">
        {tabBtn('campañas', 'Campañas', <Users size={13} />)}
        {tabBtn('ruleta',   'Ruleta',   <Tag   size={13} />)}
      </div>

      {/* ── TAB: CAMPAÑAS ── */}
      {activeTab === 'campañas' && (
        <div className="animate-in fade-in duration-500 space-y-6">

          {/* Create button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C9A84C] text-black font-black text-[10px] uppercase tracking-[0.25em] hover:opacity-90 transition-all"
            >
              <Plus size={14} strokeWidth={3} /> Nueva campaña
            </button>
          )}

          {/* Create form */}
          {showForm && (
            <div className="bg-white/[0.02] border border-white/8 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40" style={{ fontFamily: "'Space Mono',monospace" }}>Nueva campaña</p>
                <button onClick={resetForm} className="text-white/20 hover:text-white/60 transition-colors"><X size={16} /></button>
              </div>

              {/* Type selector */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-3" style={{ fontFamily: "'Space Mono',monospace" }}>Tipo</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(TYPE_META) as [CampaignType, typeof TYPE_META[CampaignType]][]).map(([t, m]) => (
                    <button key={t} onClick={() => setNewType(t)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.15em] border transition-all"
                      style={{ borderColor: newType === t ? m.color + '60' : 'rgba(255,255,255,0.08)', background: newType === t ? m.color + '15' : 'transparent', color: newType === t ? m.color : 'rgba(255,255,255,0.3)' }}
                    >{m.icon}{m.label}</button>
                  ))}
                </div>
              </div>

              {/* Common fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>Nombre de la campaña</p>
                  <input placeholder="Ej: Guest List Viernes" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#C9A84C]/40" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>Evento enlazado</p>
                  <select value={newEventId} onChange={e => setNewEventId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-sm text-white outline-none focus:border-[#C9A84C]/40">
                    <option value="">— Seleccionar —</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                  </select>
                </div>
              </div>

              {/* Guest list: free_until */}
              {newType === 'guest_list' && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>Entrada libre hasta</p>
                  <input type="datetime-local" value={newFreeUntil} onChange={e => setNewFreeUntil(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-sm text-white outline-none focus:border-[#C9A84C]/40 w-full sm:w-auto" />
                </div>
              )}

              {/* Discount: pct + tier */}
              {newType === 'discount' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>% de descuento</p>
                    <div className="flex items-center gap-3">
                      <input type="number" min={1} max={100} value={newDiscPct} onChange={e => setNewDiscPct(parseInt(e.target.value) || 1)} className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-[#C9A84C] text-center font-bold outline-none focus:border-[#C9A84C]/40" style={{ fontFamily: 'monospace' }} />
                      <span className="text-white/30 text-sm">%</span>
                    </div>
                  </div>
                  {newEventId && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>Aplicar a etapa / boleta</p>
                      <select
                        value={newTierId}
                        onChange={e => setNewTierId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-sm text-white outline-none focus:border-[#C9A84C]/40"
                      >
                        <option value="">— Todas las boletas —</option>
                        {getEventTiers(newEventId).map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {t.stage.replace('_', ' ')} · ${t.price.toLocaleString()}
                          </option>
                        ))}
                      </select>
                      {!newTierId && (
                        <p className="text-[9px] text-amber-400/60 mt-1.5" style={{ fontFamily: "'Space Mono',monospace" }}>
                          ⚠ Sin etapa seleccionada el descuento aplica a todas las boletas
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Ruleta: benefits + valid hours */}
              {newType === 'ruleta' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30" style={{ fontFamily: "'Space Mono',monospace" }}>Beneficios de la ruleta</p>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${totalOk ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' : 'text-red-400 border-red-500/20 bg-red-500/10'}`} style={{ fontFamily: "'Space Mono',monospace" }}>{totalProb}%</span>
                  </div>
                  <div className="space-y-2">
                    {newBenefits.map(b => (
                      <div key={b.id} className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                        <input type="color" value={b.color} onChange={e => setNewBenefits(p => p.map(x => x.id === b.id ? { ...x, color: e.target.value } : x))} className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent flex-shrink-0" style={{ padding: 0 }} />
                        <span className="flex-1 text-sm text-white/70 truncate min-w-0" style={{ fontFamily: "'Cormorant Garamond',serif" }}>{b.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input type="number" value={b.prob} min={1} max={100} onChange={e => setNewBenefits(p => p.map(x => x.id === b.id ? { ...x, prob: parseInt(e.target.value) || 1 } : x))} className="w-10 bg-black/40 border border-white/10 rounded-lg text-center text-[#C9A84C] text-xs outline-none py-1" style={{ fontFamily: 'monospace' }} />
                          <span className="text-white/20 text-xs">%</span>
                        </div>
                        <button onClick={() => setNewBenefits(p => p.filter(x => x.id !== b.id))} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0"><X size={12} /></button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 border border-dashed border-white/10 rounded-xl px-3 py-2">
                      <input type="color" value={newBenColor} onChange={e => setNewBenColor(e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent flex-shrink-0" style={{ padding: 0 }} />
                      <input placeholder="Nuevo beneficio..." value={newBenLabel} onChange={e => setNewBenLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBenefit()} className="flex-1 bg-transparent text-white/60 placeholder:text-white/20 text-sm outline-none min-w-0" style={{ fontFamily: "'Cormorant Garamond',serif" }} />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input type="number" value={newBenProb} min={1} max={100} onChange={e => setNewBenProb(parseInt(e.target.value) || 1)} className="w-10 bg-black/40 border border-white/10 rounded-lg text-center text-[#C9A84C] text-xs outline-none py-1" style={{ fontFamily: 'monospace' }} />
                        <span className="text-white/20 text-xs">%</span>
                      </div>
                      <button onClick={addBenefit} className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity" style={{ background: '#C9A84C', color: '#0A0A0A' }}><Plus size={12} strokeWidth={3} /></button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30 mb-2" style={{ fontFamily: "'Space Mono',monospace" }}>Horas para reclamar el beneficio</p>
                    <div className="flex items-center gap-3">
                      <input type="number" min={1} max={72} value={newValidHrs} onChange={e => setNewValidHrs(parseInt(e.target.value) || 1)} className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 h-11 text-[#C9A84C] text-center font-bold outline-none focus:border-[#C9A84C]/40" style={{ fontFamily: 'monospace' }} />
                      <span className="text-white/30 text-sm">horas desde el giro</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={createCampaign} disabled={creating || !newLabel.trim() || !newEventId || (newType === 'ruleta' && !totalOk)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C9A84C] text-black font-black text-[10px] uppercase tracking-[0.25em] disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />} Crear campaña
                </button>
                <button onClick={resetForm} className="px-5 py-3 rounded-xl border border-white/10 text-white/30 hover:text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] transition-all">Cancelar</button>
              </div>
            </div>
          )}

          {/* Campaign list */}
          {loading ? (
            <div className="flex items-center gap-3 py-12 justify-center text-white/20">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs uppercase tracking-widest font-bold">Cargando...</span>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-white/5 rounded-2xl bg-white/[0.01]">
              <Tag size={28} className="text-white/10 mb-4" />
              <p className="text-white/20 text-xs font-bold uppercase tracking-widest">No hay campañas todavía</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(c => {
                const meta = TYPE_META[c.type];
                const ev = events.find(e => e.id === c.event_id);
                const url = `https://midnightcorp.click${meta.urlBase}${c.code}`;
                return (
                  <div key={c.id} className={`bg-white/[0.02] border rounded-2xl overflow-hidden transition-all ${c.active ? 'border-white/8' : 'border-white/3 opacity-50'}`}>
                    {/* ─ Header row ─ */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-zinc-600'}`} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-white font-black text-sm truncate">{c.label}</span>
                            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0" style={{ color: meta.color, borderColor: meta.color + '30', background: meta.color + '10', fontFamily: "'Space Mono',monospace" }}>{meta.icon}{meta.label}</span>
                          </div>
                          <p className="text-white/30 text-[10px] truncate" style={{ fontFamily: "'Space Mono',monospace" }}>
                            {ev?.title ?? '—'}
                            {c.type === 'discount' && c.discount_pct && (
                              <span className="ml-2 text-[#4ADE80]">{c.discount_pct}% off{c.tier_name ? ` · ${c.tier_name}` : ''}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        {c.type !== 'discount' && (
                          <button
                            onClick={() => toggleLeads(c.id)}
                            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${expandedId === c.id ? 'bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/25' : 'bg-white/5 text-white/40 hover:text-white/70'}`}
                            style={{ fontFamily: "'Space Mono',monospace" }}
                          >
                            {expandedId === c.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            Participantes
                          </button>
                        )}
                        <div className="flex items-center gap-1.5 bg-black/30 border border-white/8 rounded-xl px-3 py-1.5 max-w-[180px] min-w-0">
                          <span className="text-[9px] text-white/30 truncate flex-1 min-w-0" style={{ fontFamily: "'Space Mono',monospace" }}>{url.replace('https://', '')}</span>
                          <a href={url} target="_blank" rel="noreferrer" className="text-white/20 hover:text-white/60 flex-shrink-0"><ExternalLink size={11} /></a>
                        </div>
                        <button onClick={() => copyLink(c.type, c.code)} className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex-shrink-0 ${copiedCode === c.code ? 'bg-emerald-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
                          {copiedCode === c.code ? <Check size={12} /> : <Copy size={12} />}
                          {copiedCode === c.code ? 'Copiado' : 'Copiar'}
                        </button>
                        <button onClick={() => toggleCampaign(c.id, c.active)} className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0">
                          {c.active ? <ToggleRight size={20} className="text-[#C9A84C]" /> : <ToggleLeft size={20} />}
                        </button>
                        <button onClick={() => deleteCampaign(c.id)} className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ─ Leads accordion ─ */}
                    {expandedId === c.id && (
                      <div className="border-t border-white/5 bg-black/20">
                        {loadingLeadsId === c.id ? (
                          <div className="flex justify-center py-8">
                            <Loader2 size={16} className="animate-spin text-[#C9A84C]" />
                          </div>
                        ) : (() => {
                          const leads = leadsCache[c.id] ?? [];
                          const printId = `print-leads-${c.id}`;
                          return (
                            <>
                              {/* Print-only CSS */}
                              <style>{`
                                @media print {
                                  body > *:not(#${printId}) { display: none !important; }
                                  #${printId} { display: block !important; position: fixed; inset: 0; padding: 32px; background: white; color: black; }
                                  #${printId} table { width: 100%; border-collapse: collapse; font-size: 12px; }
                                  #${printId} th, #${printId} td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
                                  #${printId} th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; font-weight: bold; }
                                  .no-print { display: none !important; }
                                }
                              `}</style>

                              <div id={printId}>
                                <div className="flex items-center justify-between px-5 py-3 no-print">
                                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ fontFamily: "'Space Mono',monospace" }}>
                                    {leads.length} participante{leads.length !== 1 ? 's' : ''}
                                  </p>
                                  {c.type === 'ruleta' && leads.length > 0 && (
                                    <button
                                      onClick={() => window.print()}
                                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A84C] hover:opacity-70 transition-opacity"
                                      style={{ fontFamily: "'Space Mono',monospace" }}
                                    >
                                      <Printer size={13} /> Imprimir
                                    </button>
                                  )}
                                </div>

                                {leads.length === 0 ? (
                                  <p className="text-center text-white/20 text-xs py-8 no-print" style={{ fontFamily: "'Space Mono',monospace" }}>
                                    Aún no hay participantes
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto px-5 pb-5">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-white/5">
                                          {['Nombre', 'Email', ...(c.type === 'ruleta' ? ['Beneficio'] : []), 'Fecha'].map(h => (
                                            <th key={h} className="text-left pb-2.5 pr-6 text-[9px] font-bold uppercase tracking-[0.3em] text-white/25" style={{ fontFamily: "'Space Mono',monospace" }}>{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {leads.map(l => (
                                          <tr key={l.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                                            <td className="py-2.5 pr-6 text-white/80" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15 }}>{l.name}</td>
                                            <td className="py-2.5 pr-6 text-white/35 text-[11px]" style={{ fontFamily: "'Space Mono',monospace" }}>{l.email}</td>
                                            {c.type === 'ruleta' && (
                                              <td className="py-2.5 pr-6">
                                                {l.benefit ? (
                                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: (l.benefit_color ?? '#C9A84C') + '22', color: l.benefit_color ?? '#C9A84C', fontFamily: "'Space Mono',monospace" }}>
                                                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.benefit_color ?? '#C9A84C' }} />
                                                    {l.benefit}
                                                  </span>
                                                ) : <span className="text-white/20 text-xs">—</span>}
                                              </td>
                                            )}
                                            <td className="py-2.5 text-white/20 text-[10px]" style={{ fontFamily: "'Space Mono',monospace" }}>
                                              {new Date(l.registered_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RULETA ── */}
      {activeTab === 'ruleta' && (
        <div className="animate-in fade-in duration-500">
          <RuletaAdmin />
        </div>
      )}
    </div>
  );
};
