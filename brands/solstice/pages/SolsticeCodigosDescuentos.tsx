import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag, Gift, Users as UsersIcon, Plus, Trash2, Copy, Loader2,
  Calendar, Sparkles, X, Search, Power, Download,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981', orange: '#FFB48C' };

interface Campaign {
  id: string;
  season_id: string | null;
  week_id: string | null;
  type: 'guest_list' | 'discount_code' | 'wheel';
  label: string;
  code: string | null;
  discount_pct: number;
  discount_amount: number;
  benefits: any[];
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  status: 'draft' | 'active' | 'paused' | 'expired' | 'archived';
  created_at: string;
}

interface Participant {
  id: string;
  campaign_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  benefit_label: string | null;
  redeemed_at: string | null;
  joined_at: string;
}

type Tab = 'all' | 'guest_list' | 'discount_code' | 'wheel';

export default function SolsticeCodigosDescuentos() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Campaign | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('solstice_campaigns').select('*').order('created_at', { ascending: false }),
        supabase.from('solstice_campaign_participants').select('*').order('joined_at', { ascending: false }),
      ]);
      setCampaigns((c || []) as Campaign[]);
      setParticipants((p || []) as Participant[]);
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (tab === 'all') return campaigns;
    return campaigns.filter(c => c.type === tab);
  }, [campaigns, tab]);

  const stats = useMemo(() => ({
    total:        campaigns.length,
    active:       campaigns.filter(c => c.status === 'active').length,
    participants: participants.length,
    redeemed:     participants.filter(p => p.redeemed_at).length,
  }), [campaigns, participants]);

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-4 md:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
              Solstice · Marketing
            </p>
            <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
              Códigos y descuentos
            </h1>
            <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
              Guest list · Códigos de descuento · Ruleta
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-5 py-3 text-[11px] uppercase"
            style={{
              background: C.red, color: '#fff',
              letterSpacing: '0.25em', fontWeight: 600,
              borderRadius: '999px', cursor: 'pointer',
              boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
            }}
          >
            <Plus size={13} /> Nueva campaña
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Campañas totales" value={stats.total.toString()} />
          <Stat label="Activas" value={stats.active.toString()} accent />
          <Stat label="Participantes" value={stats.participants.toString()} />
          <Stat label="Redimidos" value={stats.redeemed.toString()} accent />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            ['all', 'Todas', null],
            ['guest_list', 'Guest List', <UsersIcon size={11} />],
            ['discount_code', 'Códigos', <Tag size={11} />],
            ['wheel', 'Ruleta', <Sparkles size={11} />],
          ] as const).map(([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] uppercase whitespace-nowrap"
              style={{
                background: tab === key ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                border: tab === key ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                color: tab === key ? C.red : C.gray,
                letterSpacing: '0.2em',
                borderRadius: '999px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="py-20 text-center" style={{
              background: 'rgba(255,255,255,0.025)',
              border: '0.5px solid rgba(255,255,255,0.08)',
              borderRadius: '24px',
            }}>
              <Gift size={32} style={{ color: `${C.gray}80`, margin: '0 auto 12px' }} />
              <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                Sin campañas {tab !== 'all' ? typeLabel(tab as any).toLowerCase() : ''} todavía
              </p>
              <button
                onClick={() => setCreating(true)}
                className="mt-4 text-[10px] uppercase"
                style={{ color: C.red, letterSpacing: '0.25em', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}
              >
                Crear la primera
              </button>
            </div>
          )}

          {filtered.map(c => {
            const cp = participants.filter(p => p.campaign_id === c.id);
            return (
              <CampaignCard
                key={c.id}
                campaign={c}
                participantsCount={cp.length}
                onView={() => setViewing(c)}
                onToggle={() => toggleStatus(c)}
                onDelete={() => deleteCampaign(c.id)}
                onCopyLink={() => copyLink(c)}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {creating && (
          <NewCampaignModal onClose={() => setCreating(false)} onCreated={load} />
        )}
        {viewing && (
          <CampaignParticipantsModal
            campaign={viewing}
            participants={participants.filter(p => p.campaign_id === viewing.id)}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );

  function copyLink(c: Campaign) {
    const url = c.type === 'guest_list'
      ? `${window.location.origin}/sol/gl/${c.code}`
      : `${window.location.origin}/sol?promo=${c.code}`;
    navigator.clipboard?.writeText(url);
    toast.success('Link copiado');
  }

  async function toggleStatus(c: Campaign) {
    const next = c.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('solstice_campaigns').update({ status: next, updated_at: new Date().toISOString() }).eq('id', c.id);
    if (error) { toast.error('Error'); return; }
    toast.success(`Campaña ${next === 'active' ? 'activada' : 'pausada'}`);
    load();
  }

  async function deleteCampaign(id: string) {
    if (!confirm('¿Eliminar esta campaña? Los participantes ya registrados se borran también.')) return;
    const { error } = await supabase.from('solstice_campaigns').delete().eq('id', id);
    if (error) { toast.error('Error'); return; }
    toast.success('Eliminada');
    load();
  }
}

function typeLabel(t: 'guest_list' | 'discount_code' | 'wheel'): string {
  return { guest_list: 'Guest List', discount_code: 'Códigos', wheel: 'Ruleta' }[t];
}

// ─── Card por campaña ────────────────────────────────────────────────────

function CampaignCard({ campaign, participantsCount, onView, onToggle, onDelete, onCopyLink }: {
  campaign: Campaign;
  participantsCount: number;
  onView: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  const typeIcon = {
    guest_list:    <UsersIcon size={14} />,
    discount_code: <Tag size={14} />,
    wheel:         <Sparkles size={14} />,
  }[campaign.type];

  const statusColor = {
    active:   C.green,
    paused:   C.orange,
    draft:    C.gray,
    expired:  C.red,
    archived: C.gray,
  }[campaign.status];

  const usagePct = campaign.max_uses ? (campaign.used_count / campaign.max_uses) * 100 : 0;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: '20px',
      padding: '20px',
      backdropFilter: 'blur(20px)',
    }}>
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: `${C.red}18`, color: C.red }}
        >
          {typeIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-base" style={{ color: C.cream, fontWeight: 600, letterSpacing: '0.04em' }}>
              {campaign.label}
            </span>
            <span
              className="text-[9px] uppercase px-2 py-0.5"
              style={{
                background: `${statusColor}20`,
                color: statusColor,
                letterSpacing: '0.25em',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              {campaign.status}
            </span>
            <span className="text-[9px] uppercase px-2 py-0.5"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                color: C.gray, letterSpacing: '0.2em', borderRadius: '999px',
              }}>
              {typeLabel(campaign.type)}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-[10px]" style={{ color: C.gray, letterSpacing: '0.1em' }}>
            {campaign.code && (
              <span className="font-mono uppercase" style={{ color: C.red, letterSpacing: '0.2em', fontWeight: 600 }}>
                {campaign.code}
              </span>
            )}
            {campaign.discount_pct > 0 && (
              <span>{campaign.discount_pct}% off</span>
            )}
            {campaign.discount_amount > 0 && (
              <span>${Math.round(campaign.discount_amount / 1000)}K off</span>
            )}
            <span>{participantsCount} participante(s)</span>
            {campaign.max_uses && (
              <span>{campaign.used_count}/{campaign.max_uses} usos</span>
            )}
          </div>
          {campaign.max_uses && (
            <div className="w-full max-w-xs mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div style={{
                width: `${usagePct}%`,
                height: '100%',
                background: usagePct >= 100 ? C.red : usagePct >= 80 ? C.orange : C.green,
                transition: 'width 0.6s ease',
              }} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <IconBtn icon={<UsersIcon size={11} />} onClick={onView} title="Ver participantes" />
          <IconBtn icon={<Copy size={11} />}      onClick={onCopyLink} title="Copiar link" />
          <IconBtn icon={<Power size={11} />}     onClick={onToggle} color={statusColor} title="Pausar/Activar" />
          <IconBtn icon={<Trash2 size={11} />}    onClick={onDelete} color={C.red} title="Eliminar" />
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick, color, title }: { icon: React.ReactNode; onClick: () => void; color?: string; title: string }) {
  const c = color || C.gray;
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${c}30`,
        color: c, cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  );
}

// ─── Modal: crear campaña ────────────────────────────────────────────────

function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<Campaign['type']>('guest_list');
  const [label, setLabel] = useState('');
  const [code, setCode]   = useState('');
  const [maxUses, setMaxUses] = useState<number | ''>('');
  const [discountPct, setDiscountPct] = useState<number | ''>('');
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');
  const [endsAt, setEndsAt] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!label.trim()) { toast.error('Falta el nombre'); return; }
    setSaving(true);
    try {
      const { data: season } = await supabase.from('solstice_seasons').select('id').eq('status', 'open').maybeSingle();
      const { error } = await supabase.from('solstice_campaigns').insert({
        season_id: season?.id ?? null,
        type, label,
        code: code ? code.toUpperCase().replace(/\W/g, '') : null,
        discount_pct: discountPct || 0,
        discount_amount: discountAmount || 0,
        max_uses: maxUses || null,
        ends_at: endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : null,
        status: 'active',
      });
      if (error) throw new Error(error.message);
      toast.success('Campaña creada');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-md p-8 space-y-5"
        style={{
          background: 'rgba(8,0,0,0.94)',
          backdropFilter: 'blur(40px) saturate(160%)',
          border: '0.5px solid rgba(230,57,47,0.30)',
          borderRadius: '28px',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Nueva campaña
          </h3>
          <button onClick={onClose} style={{ color: C.gray, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([
            ['guest_list', 'Guest List', <UsersIcon size={14} />],
            ['discount_code', 'Código', <Tag size={14} />],
            ['wheel', 'Ruleta', <Sparkles size={14} />],
          ] as const).map(([k, label, icon]) => (
            <button
              key={k}
              onClick={() => setType(k as any)}
              className="flex flex-col items-center gap-1.5 py-3 text-[10px] uppercase"
              style={{
                background: type === k ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                border: type === k ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                color: type === k ? C.red : C.gray,
                letterSpacing: '0.15em',
                borderRadius: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        <Field label="Nombre" value={label} onChange={setLabel} placeholder="Ej: VIP Halloween" />
        {(type === 'discount_code' || type === 'guest_list') && (
          <Field label="Código" value={code} onChange={v => setCode(v.toUpperCase().replace(/\W/g, ''))} placeholder="VIP20" />
        )}
        {type === 'discount_code' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="% descuento" type="number" value={String(discountPct)} onChange={v => setDiscountPct(v === '' ? '' : Number(v))} placeholder="20" />
            <Field label="$ descuento (COP)" type="number" value={String(discountAmount)} onChange={v => setDiscountAmount(v === '' ? '' : Number(v))} placeholder="50000" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Máximo usos" type="number" value={String(maxUses)} onChange={v => setMaxUses(v === '' ? '' : Number(v))} placeholder="100" />
          <Field label="Vence (opcional)" type="date" value={endsAt} onChange={setEndsAt} />
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full py-3.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
          style={{
            background: C.red, color: '#fff', borderRadius: '999px',
            fontWeight: 600, opacity: saving ? 0.5 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 12px 32px rgba(230,57,47,0.45)',
          }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Crear campaña
        </button>
      </motion.div>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[9px] uppercase block mb-1.5" style={{ letterSpacing: '0.25em', color: C.gray, fontWeight: 600 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          borderRadius: '12px',
          color: C.cream, padding: '11px 14px',
          width: '100%', outline: 'none', fontSize: '13px',
        }}
      />
    </div>
  );
}

// ─── Modal: ver participantes de una campaña ─────────────────────────────

function CampaignParticipantsModal({ campaign, participants, onClose }: {
  campaign: Campaign; participants: Participant[]; onClose: () => void;
}) {
  const exportCsv = () => {
    const headers = ['Nombre', 'Email', 'Teléfono', 'Beneficio', 'Joined', 'Redeemed'];
    const rows = participants.map(p => [
      p.customer_name || '', p.customer_email || '', p.customer_phone || '',
      p.benefit_label || '', new Date(p.joined_at).toLocaleString('es-CO'),
      p.redeemed_at ? new Date(p.redeemed_at).toLocaleString('es-CO') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solstice-${campaign.label.replace(/\W/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[310] w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 space-y-5"
        style={{
          background: 'rgba(8,0,0,0.95)',
          backdropFilter: 'blur(40px) saturate(160%)',
          border: '0.5px solid rgba(230,57,47,0.30)',
          borderRadius: '28px',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase mb-1" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
              {typeLabel(campaign.type)}
            </p>
            <h3 className="text-2xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
              {campaign.label}
            </h3>
            <p className="text-xs mt-1" style={{ color: C.gray }}>
              {participants.length} participante(s)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '0.5px solid rgba(255,255,255,0.12)',
                color: C.gray, letterSpacing: '0.2em',
                borderRadius: '999px', fontWeight: 600, cursor: 'pointer',
              }}>
              <Download size={11} /> CSV
            </button>
            <button onClick={onClose} style={{ color: C.gray, cursor: 'pointer' }}><X size={18} /></button>
          </div>
        </div>

        {participants.length === 0 ? (
          <p className="text-xs uppercase py-12 text-center" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            Sin participantes todavía
          </p>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3"
                style={{ background: 'rgba(255,255,255,0.025)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: C.cream, fontWeight: 600 }}>{p.customer_name || '—'}</p>
                  <p className="text-[10px]" style={{ color: C.gray }}>{p.customer_email || ''} {p.customer_phone ? `· ${p.customer_phone}` : ''}</p>
                </div>
                {p.benefit_label && (
                  <span className="text-[9px] uppercase px-2 py-0.5"
                    style={{ background: 'rgba(255,180,140,0.15)', color: '#FFB48C', letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600 }}>
                    {p.benefit_label}
                  </span>
                )}
                {p.redeemed_at ? (
                  <span className="text-[9px] uppercase px-2 py-0.5"
                    style={{ background: 'rgba(16,185,129,0.15)', color: C.green, letterSpacing: '0.2em', borderRadius: '999px', fontWeight: 600 }}>
                    Redimido
                  </span>
                ) : (
                  <span className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                    {new Date(p.joined_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-4" style={{
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.035)',
      border: '0.5px solid rgba(255,255,255,0.08)',
    }}>
      <p className="text-[9px] uppercase mb-2" style={{ color: accent ? C.red : C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>{label}</p>
      <p className="text-2xl tabular-nums" style={{
        color: accent ? C.red : C.cream,
        fontFamily: "'Poiret One', sans-serif", fontWeight: 300,
      }}>{value}</p>
    </div>
  );
}
