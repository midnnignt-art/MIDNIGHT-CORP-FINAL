import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BedDouble, Loader2, Search, MessageCircle, Mail,
  CheckCircle2, ChevronDown, AlertTriangle, DollarSign, Clock, Hash,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981', orange: '#FFB48C' };

interface LodgingReservation {
  id: string;
  lodging_id: string;
  registration_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  nights: number;
  guests: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  // joined
  lodging?: { name: string; image_url: string | null; price_per_night: number; address: string | null } | null;
  registration?: { customer_phone: string | null; customer_university: string | null; order_number: string } | null;
}

type FilterStatus = 'all' | 'pending' | 'confirmed' | 'paid' | 'cancelled';

export default function SolsticeAdminLodgingReservations() {
  const [reservations, setReservations] = useState<LodgingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState('');
  const [filter, setFilter]   = useState<FilterStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: lr } = await supabase
        .from('solstice_lodging_reservations')
        .select('id, lodging_id, registration_id, customer_name, customer_email, nights, guests, total_amount, status, payment_method, notes, created_at')
        .order('created_at', { ascending: false });

      if (!lr || lr.length === 0) {
        setReservations([]);
        setLoading(false);
        return;
      }

      const lodgingIds = [...new Set(lr.map(r => r.lodging_id))];
      const { data: lodgings } = await supabase
        .from('solstice_lodgings')
        .select('id, name, image_url, price_per_night, address')
        .in('id', lodgingIds);
      const lodgeMap = new Map((lodgings || []).map(l => [l.id, l]));

      const regIds = lr.map(r => r.registration_id).filter(Boolean) as string[];
      let regMap = new Map<string, any>();
      if (regIds.length > 0) {
        const { data: regs } = await supabase
          .from('solstice_registrations')
          .select('id, customer_phone, customer_university, order_number')
          .in('id', regIds);
        regMap = new Map((regs || []).map(r => [r.id, r]));
      }

      setReservations(lr.map(r => ({
        ...r,
        lodging: lodgeMap.get(r.lodging_id) as any || null,
        registration: r.registration_id ? regMap.get(r.registration_id) as any || null : null,
      })) as LodgingReservation[]);
    } catch (err: any) {
      toast.error('Error al cargar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return reservations.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      const text = [
        r.customer_name || '',
        r.customer_email || '',
        r.lodging?.name || '',
        r.registration?.customer_university || '',
        r.registration?.order_number || '',
      ].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [reservations, query, filter]);

  const stats = useMemo(() => ({
    total:     reservations.length,
    pending:   reservations.filter(r => r.status === 'pending').length,
    confirmed: reservations.filter(r => r.status === 'confirmed' || r.status === 'paid').length,
    revenue:   reservations.filter(r => r.status === 'paid').reduce((s, r) => s + (r.total_amount || 0), 0),
  }), [reservations]);

  const setStatus = async (id: string, status: LodgingReservation['status']) => {
    const labels: Record<typeof status, string> = {
      pending:   'pending',
      confirmed: 'confirmar',
      paid:      'marcar como pagada',
      cancelled: 'cancelar',
    };
    if (!confirm(`¿${labels[status]} esta reserva?`)) return;
    const { error } = await supabase
      .from('solstice_lodging_reservations')
      .update({ status })
      .eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Estado actualizado');
    load();
  };

  const card = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(28px) saturate(180%)',
    border: '0.5px solid rgba(255,255,255,0.10)',
    borderRadius: '24px',
  };

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} style={{ color: C.orange }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-4 md:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.orange, fontWeight: 600 }}>
            Solstice · Operaciones
          </p>
          <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Reservas de hospedaje
          </h1>
          <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            {stats.total} reserva(s) · {stats.pending} pendiente(s) de confirmar
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Total reservas"  value={stats.total.toString()} />
          <StatBlock label="Pendientes"      value={stats.pending.toString()}    accent={stats.pending > 0} />
          <StatBlock label="Confirmadas"     value={stats.confirmed.toString()} />
          <StatBlock label="Revenue pagado"  value={`$${Math.round(stats.revenue / 1000)}K`} accent />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.gray }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar cliente, hospedaje, universidad u orden"
              style={{
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                color: C.cream,
                padding: '12px 16px 12px 38px',
                width: '100%',
                outline: 'none',
                fontSize: '13px',
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'confirmed', 'paid', 'cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-2 text-[10px] uppercase whitespace-nowrap"
                style={{
                  background: filter === s ? 'rgba(255,180,140,0.18)' : 'rgba(255,255,255,0.04)',
                  border: filter === s ? '0.5px solid rgba(255,180,140,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                  color: filter === s ? C.orange : C.gray,
                  letterSpacing: '0.2em',
                  borderRadius: '999px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s === 'all' ? 'Todas' : statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="py-20 text-center" style={card}>
              <BedDouble size={32} style={{ color: `${C.gray}80`, margin: '0 auto 12px' }} />
              <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                Sin reservas {filter !== 'all' ? statusLabel(filter as any).toLowerCase() : ''}
              </p>
            </div>
          )}

          {filtered.map(r => {
            const isExpanded = expanded === r.id;
            const dateShort = new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

            return (
              <motion.div key={r.id} layout style={card} className="overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="w-full p-5 flex items-center gap-4 text-left"
                  style={{ background: 'transparent', cursor: 'pointer' }}
                >
                  {r.lodging?.image_url ? (
                    <img src={r.lodging.image_url} alt={r.lodging.name} className="w-14 h-14 object-cover flex-shrink-0"
                      style={{ borderRadius: '12px' }} />
                  ) : (
                    <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center"
                      style={{ borderRadius: '12px', background: `${C.orange}20`, color: C.orange }}>
                      <BedDouble size={22} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm uppercase" style={{ color: C.cream, letterSpacing: '0.08em', fontWeight: 600 }}>
                        {r.lodging?.name || '—'}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="text-[11px] uppercase" style={{ color: C.gray, letterSpacing: '0.1em' }}>
                      {r.customer_name || '—'} · {r.nights} {r.nights === 1 ? 'noche' : 'noches'} · ${Math.round((r.total_amount || 0) / 1000)}K
                    </p>
                    <p className="text-[9px] uppercase mt-0.5" style={{ color: `${C.gray}80`, letterSpacing: '0.15em' }}>
                      Reservada el {dateShort}
                    </p>
                  </div>

                  <ChevronDown
                    size={16}
                    style={{
                      color: C.gray,
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 0.3s ease',
                      flexShrink: 0,
                    }}
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="px-5 pb-5 pt-2 space-y-4" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                        {/* Datos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                          <Detail label="Cliente"     value={r.customer_name || '—'} />
                          <Detail label="Email"       value={r.customer_email || '—'} small />
                          <Detail label="Universidad" value={r.registration?.customer_university || '—'} />
                          <Detail label="Teléfono"    value={r.registration?.customer_phone || '—'} />
                          <Detail label="Noches"      value={`${r.nights}`} />
                          <Detail label="Personas"    value={`${r.guests}`} />
                          <Detail label="Por noche"   value={`$${Math.round((r.lodging?.price_per_night || 0) / 1000)}K`} />
                          <Detail label="Total"       value={`$${Math.round((r.total_amount || 0) / 1000)}K`} accent />
                          {r.registration?.order_number && (
                            <Detail label="Orden" value={r.registration.order_number} mono small />
                          )}
                          {r.lodging?.address && (
                            <Detail label="Dirección hospedaje" value={r.lodging.address} small className="col-span-2" />
                          )}
                        </div>

                        {r.notes && (
                          <div
                            className="p-3"
                            style={{
                              background: 'rgba(255,255,255,0.025)',
                              border: '0.5px solid rgba(255,255,255,0.06)',
                              borderRadius: '12px',
                            }}
                          >
                            <p className="text-[9px] uppercase mb-1" style={{ color: C.gray, letterSpacing: '0.3em', fontWeight: 600 }}>
                              Nota
                            </p>
                            <p className="text-[11px]" style={{ color: C.cream, lineHeight: 1.5 }}>{r.notes}</p>
                          </div>
                        )}

                        {/* Acciones */}
                        <div className="flex flex-wrap gap-2">
                          {r.registration?.customer_phone && (
                            <ActionBtn
                              icon={<MessageCircle size={11} />}
                              label="WhatsApp cliente"
                              color={C.green}
                              onClick={() => {
                                const phone = (r.registration!.customer_phone || '').replace(/[^0-9+]/g, '');
                                const name = (r.customer_name || '').split(' ')[0];
                                const msg = `Hola ${name}, te escribo desde Solstice por tu reserva en ${r.lodging?.name || 'el hospedaje'} (${r.nights} noches) 🌅`;
                                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                              }}
                            />
                          )}
                          {r.customer_email && (
                            <ActionBtn
                              icon={<Mail size={11} />}
                              label="Email"
                              onClick={() => window.open(`mailto:${r.customer_email}`, '_blank')}
                            />
                          )}
                          {r.status === 'pending' && (
                            <ActionBtn icon={<CheckCircle2 size={11} />} label="Confirmar disponibilidad" color={C.green}
                              onClick={() => setStatus(r.id, 'confirmed')} />
                          )}
                          {(r.status === 'pending' || r.status === 'confirmed') && (
                            <ActionBtn icon={<DollarSign size={11} />} label="Marcar como pagada" color={C.orange}
                              onClick={() => setStatus(r.id, 'paid')} />
                          )}
                          {r.status !== 'cancelled' && (
                            <ActionBtn icon={<AlertTriangle size={11} />} label="Cancelar" color={C.red}
                              onClick={() => setStatus(r.id, 'cancelled')} />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: 'pending' | 'confirmed' | 'paid' | 'cancelled') {
  return ({ pending: 'Pendientes', confirmed: 'Confirmadas', paid: 'Pagadas', cancelled: 'Canceladas' })[s];
}

function StatusPill({ status }: { status: 'pending' | 'confirmed' | 'paid' | 'cancelled' }) {
  const config: Record<typeof status, { bg: string; fg: string; label: string }> = {
    pending:   { bg: 'rgba(255,180,140,0.15)',  fg: C.orange, label: 'Pendiente' },
    confirmed: { bg: 'rgba(34,211,238,0.15)',   fg: '#22d3ee', label: 'Confirmada' },
    paid:      { bg: 'rgba(16,185,129,0.15)',   fg: C.green,  label: 'Pagada' },
    cancelled: { bg: 'rgba(230,57,47,0.15)',    fg: C.red,    label: 'Cancelada' },
  };
  const c = config[status];
  return (
    <span
      className="text-[9px] uppercase px-2 py-0.5"
      style={{
        background: c.bg, color: c.fg, letterSpacing: '0.25em', borderRadius: '999px', fontWeight: 600,
      }}
    >
      {c.label}
    </span>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="p-4"
      style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.035)',
        border: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      <p className="text-[9px] uppercase mb-2" style={{ color: accent ? C.orange : C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
        {label}
      </p>
      <p className="text-2xl tabular-nums" style={{ color: accent ? C.orange : C.cream, fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value, accent, small, mono, className = '' }: {
  label: string; value: string; accent?: boolean; small?: boolean; mono?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[9px] uppercase mb-1" style={{ color: C.gray, letterSpacing: '0.25em', fontWeight: 500 }}>{label}</p>
      <p
        className={mono ? 'font-mono' : ''}
        style={{
          color: accent ? C.orange : C.cream,
          fontSize: small ? 11 : 13,
          fontWeight: accent ? 600 : 500,
          letterSpacing: small ? '0.02em' : '0.05em',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color }: {
  icon: React.ReactNode; label: string; onClick: () => void; color?: string;
}) {
  const c = color || C.cream;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${c}40`,
        borderRadius: '999px',
        color: c,
        letterSpacing: '0.2em',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${c}15`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      {icon}
      {label}
    </button>
  );
}
