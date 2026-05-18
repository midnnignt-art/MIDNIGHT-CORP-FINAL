import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ship, Users, Loader2, Search, MessageCircle, Mail, Phone,
  CheckCircle2, X, ChevronDown, Copy, Lock, AlertTriangle, Trash2
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from '../../../lib/toast';

const C = { bg: '#000', red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981' };

interface BoatReservation {
  id: string;
  boat_id: string;
  invite_code: string;
  leader_name: string | null;
  leader_email: string | null;
  total_capacity: number;
  slots_claimed: number;
  status: 'open' | 'full' | 'closed' | 'cancelled';
  closed_at: string | null;
  created_at: string;
  boat?: { name: string; image_url: string | null } | null;
  passengers: Passenger[];
}

interface Passenger {
  id: string;
  passenger_name: string;
  passenger_email: string | null;
  passenger_phone: string | null;
  is_leader: boolean;
  amount_paid: number;
  joined_at: string;
}

type FilterStatus = 'all' | 'open' | 'full' | 'closed' | 'cancelled';

export default function SolsticeAdminBoatReservations() {
  const [reservations, setReservations] = useState<BoatReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: bres } = await supabase
        .from('solstice_boat_reservations')
        .select('id, boat_id, invite_code, leader_name, leader_email, total_capacity, slots_claimed, status, closed_at, created_at')
        .order('created_at', { ascending: false });

      if (!bres || bres.length === 0) {
        setReservations([]);
        setLoading(false);
        return;
      }

      const boatIds = [...new Set(bres.map(b => b.boat_id))];
      const { data: boats } = await supabase
        .from('solstice_boats')
        .select('id, name, image_url')
        .in('id', boatIds);
      const boatMap = new Map((boats || []).map(b => [b.id, b]));

      const resIds = bres.map(b => b.id);
      const { data: pax } = await supabase
        .from('solstice_boat_passengers')
        .select('id, boat_reservation_id, passenger_name, passenger_email, passenger_phone, is_leader, amount_paid, joined_at')
        .in('boat_reservation_id', resIds)
        .order('is_leader', { ascending: false })
        .order('joined_at', { ascending: true });

      const paxByRes = new Map<string, Passenger[]>();
      (pax || []).forEach(p => {
        const arr = paxByRes.get(p.boat_reservation_id) || [];
        arr.push(p as any);
        paxByRes.set(p.boat_reservation_id, arr);
      });

      setReservations(bres.map(b => ({
        ...b,
        boat: boatMap.get(b.boat_id) as any || null,
        passengers: paxByRes.get(b.id) || [],
      })) as BoatReservation[]);
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
        r.invite_code,
        r.leader_name || '',
        r.leader_email || '',
        r.boat?.name || '',
        ...r.passengers.map(p => `${p.passenger_name} ${p.passenger_email}`),
      ].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [reservations, query, filter]);

  const stats = useMemo(() => {
    const totalRes = reservations.length;
    const openRes  = reservations.filter(r => r.status === 'open').length;
    const fullRes  = reservations.filter(r => r.status === 'full').length;
    const totalPax = reservations.reduce((s, r) => s + r.slots_claimed, 0);
    const totalCap = reservations.reduce((s, r) => s + r.total_capacity, 0);
    return { totalRes, openRes, fullRes, totalPax, totalCap };
  }, [reservations]);

  const closeReservation = async (id: string) => {
    if (!confirm('¿Cerrar esta reserva? Ya no se podrán sumar más invitados.')) return;
    const { error } = await supabase
      .from('solstice_boat_reservations')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Error al cerrar'); return; }
    toast.success('Reserva cerrada');
    load();
  };

  const cancelReservation = async (id: string) => {
    if (!confirm('¿Cancelar reserva? Esto NO devuelve plata automáticamente, solo cambia el estado a cancelled.')) return;
    const { error } = await supabase
      .from('solstice_boat_reservations')
      .update({ status: 'cancelled', closed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Error al cancelar'); return; }
    toast.success('Reserva cancelada');
    load();
  };

  const removePassenger = async (resId: string, paxId: string, isLeader: boolean) => {
    if (isLeader) {
      toast.error('No se puede sacar al líder · cancela la reserva en su lugar');
      return;
    }
    if (!confirm('¿Sacar a este pasajero de la lancha?')) return;
    const { error } = await supabase.from('solstice_boat_passengers').delete().eq('id', paxId);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Pasajero eliminado');
    load();
  };

  const copyInvite = (code: string) => {
    const url = `${window.location.origin}/sol/i/${code}`;
    navigator.clipboard?.writeText(url);
    toast.success('Link copiado');
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
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }} className="px-4 md:px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
            Solstice · Operaciones
          </p>
          <h1 className="text-3xl md:text-4xl uppercase" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
            Reservas de lancha
          </h1>
          <p className="text-xs uppercase mt-2" style={{ color: C.gray, letterSpacing: '0.2em' }}>
            {reservations.length} reserva(s) activa(s) · {stats.totalPax} pasajeros a bordo
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock label="Reservas activas" value={stats.openRes.toString()} accent />
          <StatBlock label="Llenas" value={stats.fullRes.toString()} />
          <StatBlock label="Pasajeros" value={`${stats.totalPax} / ${stats.totalCap}`} />
          <StatBlock label="Ocupación" value={stats.totalCap > 0 ? `${Math.round((stats.totalPax / stats.totalCap) * 100)}%` : '0%'} accent />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex-1 relative">
            <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.gray }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar código, líder, lancha o pasajero"
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
            {(['all', 'open', 'full', 'closed', 'cancelled'] as FilterStatus[]).map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-3 py-2 text-[10px] uppercase whitespace-nowrap"
                style={{
                  background: filter === s ? 'rgba(230,57,47,0.18)' : 'rgba(255,255,255,0.04)',
                  border: filter === s ? '0.5px solid rgba(230,57,47,0.50)' : '0.5px solid rgba(255,255,255,0.10)',
                  color: filter === s ? C.red : C.gray,
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
              <Ship size={32} style={{ color: `${C.gray}80`, margin: '0 auto 12px' }} />
              <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
                Sin reservas {filter !== 'all' ? statusLabel(filter as any).toLowerCase() : ''}
              </p>
            </div>
          )}

          {filtered.map(r => {
            const isExpanded = expanded === r.id;
            const occupancyPct = (r.slots_claimed / r.total_capacity) * 100;
            return (
              <motion.div key={r.id} layout style={card} className="overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="w-full p-5 flex items-center gap-4 text-left"
                  style={{ background: 'transparent', cursor: 'pointer' }}
                >
                  {r.boat?.image_url ? (
                    <img src={r.boat.image_url} alt={r.boat.name} className="w-14 h-14 object-cover flex-shrink-0"
                      style={{ borderRadius: '12px' }} />
                  ) : (
                    <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center"
                      style={{ borderRadius: '12px', background: `${C.red}15`, color: C.red }}>
                      <Ship size={22} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm uppercase" style={{ color: C.cream, letterSpacing: '0.08em', fontWeight: 600 }}>
                        {r.boat?.name || '—'}
                      </span>
                      <StatusPill status={r.status} />
                    </div>
                    <p className="text-[11px] uppercase" style={{ color: C.gray, letterSpacing: '0.1em' }}>
                      Líder: {r.leader_name || '—'} · {r.passengers.length}/{r.total_capacity} a bordo
                    </p>
                    <div className="mt-2 w-full max-w-xs h-1 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{
                        width: `${occupancyPct}%`,
                        height: '100%',
                        background: occupancyPct >= 100 ? C.green : C.red,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>

                  <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-[10px] uppercase font-mono" style={{ color: C.red, letterSpacing: '0.25em', fontWeight: 600 }}>
                      {r.invite_code}
                    </span>
                    <ChevronDown
                      size={16}
                      style={{
                        color: C.gray,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                  </div>
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
                        {/* Acciones globales */}
                        <div className="flex flex-wrap gap-2">
                          <ActionBtn icon={<Copy size={11} />} label="Copiar link" onClick={() => copyInvite(r.invite_code)} />
                          {r.leader_email && (
                            <ActionBtn
                              icon={<Mail size={11} />}
                              label="Email al líder"
                              onClick={() => window.open(`mailto:${r.leader_email}`, '_blank')}
                            />
                          )}
                          {r.status === 'open' && (
                            <ActionBtn
                              icon={<Lock size={11} />}
                              label="Cerrar reserva"
                              onClick={() => closeReservation(r.id)}
                              color={C.gray}
                            />
                          )}
                          {r.status !== 'cancelled' && (
                            <ActionBtn
                              icon={<AlertTriangle size={11} />}
                              label="Cancelar"
                              onClick={() => cancelReservation(r.id)}
                              color={C.red}
                            />
                          )}
                        </div>

                        {/* Lista de pasajeros */}
                        <div>
                          <p className="text-[10px] uppercase mb-2" style={{ color: C.red, letterSpacing: '0.3em', fontWeight: 600 }}>
                            Pasajeros ({r.passengers.length})
                          </p>
                          <div className="space-y-2">
                            {r.passengers.length === 0 && (
                              <p className="text-[11px] uppercase py-3 text-center" style={{ color: C.gray, letterSpacing: '0.15em' }}>
                                Sin pasajeros aún
                              </p>
                            )}
                            {r.passengers.map(p => (
                              <div
                                key={p.id}
                                className="flex items-center gap-3 p-3"
                                style={{
                                  borderRadius: '14px',
                                  background: p.is_leader ? 'rgba(230,57,47,0.08)' : 'rgba(255,255,255,0.025)',
                                  border: p.is_leader ? '0.5px solid rgba(230,57,47,0.30)' : '0.5px solid rgba(255,255,255,0.06)',
                                }}
                              >
                                <div
                                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                                  style={{
                                    background: p.is_leader ? C.red : `${C.gray}30`,
                                    color: p.is_leader ? '#fff' : C.cream,
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  {(p.passenger_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm" style={{ color: C.cream, fontWeight: 600 }}>
                                      {p.passenger_name}
                                    </p>
                                    {p.is_leader && (
                                      <span className="text-[8px] uppercase px-2 py-0.5"
                                        style={{
                                          background: C.red, color: '#fff',
                                          letterSpacing: '0.25em', borderRadius: '999px', fontWeight: 700,
                                        }}>
                                        Líder
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px]" style={{ color: C.gray }}>
                                    {p.passenger_email || '—'}{p.passenger_phone ? ` · ${p.passenger_phone}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {p.passenger_phone && (
                                    <IconBtn
                                      icon={<MessageCircle size={12} />}
                                      onClick={() => {
                                        const phone = (p.passenger_phone || '').replace(/[^0-9+]/g, '');
                                        const msg = `Hola ${p.passenger_name?.split(' ')[0] || ''}, te escribo desde Solstice por tu reserva en la lancha ${r.boat?.name || ''} 🌅`;
                                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                                      }}
                                      color="#10b981"
                                    />
                                  )}
                                  {p.passenger_email && (
                                    <IconBtn
                                      icon={<Mail size={12} />}
                                      onClick={() => window.open(`mailto:${p.passenger_email}`, '_blank')}
                                    />
                                  )}
                                  {!p.is_leader && (
                                    <IconBtn
                                      icon={<Trash2 size={12} />}
                                      onClick={() => removePassenger(r.id, p.id, p.is_leader)}
                                      color={C.red}
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
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

function statusLabel(s: 'open' | 'full' | 'closed' | 'cancelled') {
  return ({ open: 'Abierta', full: 'Llena', closed: 'Cerrada', cancelled: 'Cancelada' })[s];
}

function StatusPill({ status }: { status: 'open' | 'full' | 'closed' | 'cancelled' }) {
  const config: Record<typeof status, { bg: string; fg: string; label: string }> = {
    open:      { bg: 'rgba(16,185,129,0.15)', fg: '#10b981', label: 'Abierta' },
    full:      { bg: 'rgba(255,180,140,0.15)', fg: '#FFB48C', label: 'Llena' },
    closed:    { bg: 'rgba(96,96,96,0.20)', fg: '#a0a0a8', label: 'Cerrada' },
    cancelled: { bg: 'rgba(230,57,47,0.15)', fg: C.red, label: 'Cancelada' },
  };
  const c = config[status];
  return (
    <span
      className="text-[9px] uppercase px-2 py-0.5"
      style={{
        background: c.bg,
        color: c.fg,
        letterSpacing: '0.25em',
        borderRadius: '999px',
        fontWeight: 600,
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
      <p className="text-[9px] uppercase mb-2" style={{ color: accent ? C.red : C.gray, letterSpacing: '0.3em', fontWeight: 500 }}>
        {label}
      </p>
      <p className="text-2xl tabular-nums" style={{ color: accent ? C.red : C.cream, fontFamily: "'Poiret One', sans-serif", fontWeight: 300 }}>
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
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({ icon, onClick, color }: {
  icon: React.ReactNode; onClick: () => void; color?: string;
}) {
  const c = color || C.gray;
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `0.5px solid ${c}40`,
        color: c,
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = `${c}20`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      {icon}
    </button>
  );
}
