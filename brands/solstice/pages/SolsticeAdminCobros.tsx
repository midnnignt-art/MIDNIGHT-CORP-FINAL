import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageCircle, Check, Phone, Mail, RefreshCw,
  Loader2, ChevronDown, ChevronUp, AlertTriangle, Shield,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';
import { toast } from '../../../lib/toast';

const C = {
  bg: '#000', bgS: '#0d0d0d', bgT: '#111',
  red: '#E6392F', gray: '#606060', cream: '#F9F2D7',
  green: '#10b981', yellow: '#f59e0b',
};

interface Registration {
  id: string; order_number: string; customer_name: string;
  customer_email: string; customer_phone: string; customer_university: string;
  payment_mode: string; status: string; total_amount: number; amount_paid: number;
  seller_id: string | null; created_at: string;
}
interface Schedule {
  id: string; registration_id: string; installment_number: number;
  amount: number; due_date: string; status: 'pending' | 'paid' | 'overdue';
  payment_id?: string | null;
}
interface EnrichedReg extends Registration {
  schedules: Schedule[];
  overdueSchedules: Schedule[];
  totalOverdue: number;
  seller_name?: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
const fmtK = (n: number) => `$${Math.round(n / 1000)}K`;

export default function SolsticeAdminCobros() {
  const { currentUser, promoters } = useStore();
  const [regs, setRegs]       = useState<EnrichedReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [uniFilter, setUniFilter] = useState('all');
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [payingId, setPayingId]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Auto-flip pending → overdue for past due dates
      await supabase
        .from('solstice_payment_schedules')
        .update({ status: 'overdue' })
        .eq('status', 'pending')
        .lt('due_date', today);

      const [{ data: r }, { data: sc }] = await Promise.all([
        supabase.from('solstice_registrations')
          .select('*')
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase.from('solstice_payment_schedules')
          .select('*')
          .order('installment_number'),
      ]);

      const raw = (r || []) as Registration[];
      const schAll = (sc || []) as Schedule[];

      const enriched: EnrichedReg[] = raw.map(reg => {
        const schedules = schAll.filter(s => s.registration_id === reg.id);
        const overdueSchedules = schedules.filter(s => s.status === 'overdue');
        const totalOverdue = overdueSchedules.reduce((a, s) => a + s.amount, 0);
        const seller = promoters.find(p => p.user_id === reg.seller_id);
        return { ...reg, schedules, overdueSchedules, totalOverdue, seller_name: seller?.name };
      });

      setRegs(enriched);
    } catch { /* DB not ready */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Realtime: cuando un pago entra (webhook o admin), refresca el dashboard
  // automáticamente. Throttle con un timer para evitar reloads en cascada.
  useEffect(() => {
    let timer: any = null;
    const debouncedLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 500);
    };
    const channel = supabase
      .channel('solstice-admin-cobros')
      .on('postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'solstice_payment_schedules' },
        debouncedLoad,
      )
      .on('postgres_changes' as any,
        { event: '*', schema: 'public', table: 'solstice_registrations' },
        debouncedLoad,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const universities = useMemo(() => {
    return [...new Set(regs.map(r => r.customer_university))].sort();
  }, [regs]);

  const morosos = useMemo(() => {
    return regs
      .filter(r => r.overdueSchedules.length > 0)
      .filter(r => uniFilter === 'all' || r.customer_university === uniFilter)
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.customer_name.toLowerCase().includes(q) ||
          r.customer_phone.includes(q) ||
          r.order_number.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.totalOverdue - a.totalOverdue);
  }, [regs, uniFilter, search]);

  const stats = useMemo(() => {
    const all = regs.filter(r => r.overdueSchedules.length > 0);
    return {
      count: all.length,
      total: all.reduce((a, r) => a + r.totalOverdue, 0),
      cuotas: all.reduce((a, r) => a + r.overdueSchedules.length, 0),
    };
  }, [regs]);

  const markPaid = async (sch: Schedule, reg: EnrichedReg) => {
    if (!currentUser) return;
    setPayingId(sch.id);
    try {
      const { data: payment, error: pe } = await supabase
        .from('solstice_payments')
        .insert({
          registration_id: reg.id,
          amount: sch.amount,
          method: 'cash',
          status: 'completed',
          confirmed_by: currentUser.user_id,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (pe) throw new Error(pe.message);

      await supabase
        .from('solstice_payment_schedules')
        .update({ status: 'paid', payment_id: payment.id })
        .eq('id', sch.id);

      const newPaid = reg.amount_paid + sch.amount;
      const remaining = Math.max((reg as any).installments_remaining - 1, 0);
      await supabase
        .from('solstice_registrations')
        .update({
          amount_paid: newPaid,
          installments_remaining: remaining,
          status: remaining <= 0 ? 'completed' : 'active',
        })
        .eq('id', reg.id);

      toast.success(`Cuota ${sch.installment_number} cobrada — ${fmt(sch.amount)}`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPayingId(null);
    }
  };

  const sendWhatsApp = (reg: EnrichedReg) => {
    const phone = reg.customer_phone.replace(/\D/g, '');
    const count = reg.overdueSchedules.length;
    const plural = count > 1;
    const msg =
      `Hola ${reg.customer_name.split(' ')[0]} 👋\n\n` +
      `Te escribe el equipo *SOLSTICE 2026*.\n\n` +
      `Tienes *${count} cuota${plural ? 's' : ''} vencida${plural ? 's' : ''}* ` +
      `por un total de *${fmt(reg.totalOverdue)}*.\n\n` +
      `Por favor regulariza tu pago para mantener tu cupo activo 🔴\n\n` +
      `📋 Orden: ${reg.order_number}`;
    window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 size={28} className="animate-spin" style={{ color: C.red }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}>

      {/* Header */}
      <div className="px-8 pt-10 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.10)' }}>
        <div>
          <p className="text-[9px] uppercase mb-1"
            style={{ color: C.red, letterSpacing: '0.08em', fontWeight: 500 }}>Admin</p>
          <h1 className="text-3xl uppercase"
            style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '-0.02em', fontWeight: 300 }}>
            Cobros y Mora
          </h1>
          <p className="text-xs uppercase mt-1" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
            Gestión de clientes con pagos vencidos · actualización automática al cargar
          </p>
        </div>
        <RunCronButton onComplete={load} />
      </div>

      {/* KPI strip */}
      <div className="px-8 pt-8 grid grid-cols-3 gap-3 max-w-xl">
        {[
          { label: 'En mora',         value: String(stats.count),       color: C.red  },
          { label: 'Total vencido',   value: fmtK(stats.total),         color: C.yellow },
          { label: 'Cuotas vencidas', value: String(stats.cuotas),      color: C.cream },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(32px) saturate(180%)',
              border: '0.5px solid rgba(255,255,255,0.10)',
              borderRadius: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            }}>
            <p className="text-[9px] uppercase mb-1.5"
              style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>{label}</p>
            <p className="text-2xl" style={{ color, fontWeight: 600 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-8 pt-6 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-52 px-3 py-2"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '16px',
          }}>
          <Search size={13} style={{ color: C.gray }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nombre, teléfono u orden…"
            className="flex-1 text-xs outline-none bg-transparent"
            style={{ color: C.cream }}
          />
        </div>
        <select
          value={uniFilter} onChange={e => setUniFilter(e.target.value)}
          className="px-3 py-2 text-xs outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '16px',
            color: C.cream,
          }}>
          <option value="all">Todas las universidades</option>
          {universities.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          onClick={load}
          className="p-2 transition-all"
          style={{ color: C.gray, borderRadius: '999px', transition: 'all 0.3s ease' }}
          onMouseEnter={e => (e.currentTarget.style.color = C.cream)}
          onMouseLeave={e => (e.currentTarget.style.color = C.gray)}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      <div className="px-8 pt-5 pb-20 max-w-5xl">
        {morosos.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-12 h-12 flex items-center justify-center mx-auto"
              style={{
                background: 'rgba(16,185,129,0.15)',
                border: '0.5px solid rgba(16,185,129,0.30)',
                borderRadius: '999px',
              }}>
              <Check size={20} style={{ color: C.green }} />
            </div>
            <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
              {search || uniFilter !== 'all' ? 'Sin resultados' : 'Sin clientes en mora'}
            </p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(32px) saturate(180%)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          }}>
            {/* Table header */}
            <div className="grid grid-cols-12 px-5 py-2 text-[9px] uppercase"
              style={{ color: C.gray, borderBottom: '0.5px solid rgba(255,255,255,0.10)', letterSpacing: '0.08em', fontWeight: 500 }}>
              <div className="col-span-3">Cliente</div>
              <div className="col-span-2">Universidad</div>
              <div className="col-span-2 text-right">Cuotas</div>
              <div className="col-span-2 text-right">Vencido</div>
              <div className="col-span-2 text-right">Vendedor</div>
              <div className="col-span-1" />
            </div>

            {morosos.map(reg => (
              <div key={reg.id}>
                {/* Main row */}
                <div
                  className="grid grid-cols-12 px-5 py-4 items-center cursor-pointer"
                  style={{
                    borderBottom: expanded === reg.id ? 'none' : '0.5px solid rgba(255,255,255,0.08)',
                    background: expanded === reg.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => { if (expanded !== reg.id) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (expanded !== reg.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  onClick={() => setExpanded(expanded === reg.id ? null : reg.id)}>

                  <div className="col-span-3">
                    <p className="text-xs font-medium uppercase truncate">{reg.customer_name}</p>
                    <p className="text-[9px] font-mono" style={{ color: C.gray }}>{reg.order_number}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase truncate" style={{ color: C.gray }}>{reg.customer_university}</p>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className="text-[10px] px-2 py-0.5"
                      style={{
                        background: 'rgba(230,57,47,0.20)',
                        color: C.red,
                        border: '0.5px solid rgba(230,57,47,0.40)',
                        borderRadius: '999px',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                      }}>
                      {reg.overdueSchedules.length}
                    </span>
                  </div>
                  <div className="col-span-2 text-right text-xs font-medium" style={{ color: C.yellow }}>
                    {fmt(reg.totalOverdue)}
                  </div>
                  <div className="col-span-2 text-right text-[9px]" style={{ color: C.gray }}>
                    {reg.seller_name || '—'}
                  </div>
                  <div className="col-span-1 flex justify-end items-center gap-1.5"
                    onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => sendWhatsApp(reg)}
                      className="p-1.5 transition-all"
                      title="Recordatorio WhatsApp"
                      style={{ color: '#25D366', borderRadius: '999px', transition: 'all 0.3s ease' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#25D36618')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <MessageCircle size={14} />
                    </button>
                    {expanded === reg.id
                      ? <ChevronUp size={12} style={{ color: C.gray }} />
                      : <ChevronDown size={12} style={{ color: C.gray }} />}
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {expanded === reg.id && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
                      <div className="px-8 py-5 space-y-4"
                        style={{
                          background: 'rgba(8,0,0,0.88)',
                          backdropFilter: 'blur(40px)',
                        }}>

                        {/* Contact row */}
                        <div className="flex flex-wrap items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Phone size={11} style={{ color: C.gray }} />
                            <span className="text-[11px] font-mono">{reg.customer_phone || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={11} style={{ color: C.gray }} />
                            <span className="text-[11px] font-mono">{reg.customer_email || '—'}</span>
                          </div>
                          <button
                            onClick={() => sendWhatsApp(reg)}
                            className="flex items-center gap-2 px-6 py-3 text-[10px] uppercase tracking-widest transition-all ml-auto"
                            style={{
                              border: '0.5px solid rgba(37,211,102,0.40)',
                              color: '#25D366',
                              borderRadius: '999px',
                              fontWeight: 500,
                              transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = '#25D36612';
                              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                            }}>
                            <MessageCircle size={11} /> Enviar recordatorio
                          </button>
                        </div>

                        {/* Overdue installments */}
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase"
                            style={{ color: C.gray, letterSpacing: '0.08em', fontWeight: 500 }}>
                            Cuotas vencidas
                          </p>
                          {reg.overdueSchedules.map(sch => (
                            <div
                              key={sch.id}
                              className="flex items-center justify-between px-4 py-3"
                              style={{
                                background: 'rgba(230,57,47,0.08)',
                                border: '0.5px solid rgba(230,57,47,0.40)',
                                borderRadius: '16px',
                              }}>
                              <div className="flex items-center gap-3">
                                <AlertTriangle size={13} style={{ color: C.red }} />
                                <div>
                                  <p className="text-[11px] font-medium uppercase">Cuota {sch.installment_number}</p>
                                  <p className="text-[9px]" style={{ color: C.red }}>
                                    Venció {new Date(sch.due_date + 'T00:00:00').toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-medium">{fmt(sch.amount)}</span>
                                <button
                                  onClick={() => markPaid(sch, reg)}
                                  disabled={payingId === sch.id}
                                  className="flex items-center gap-1.5 px-4 py-2 text-[9px] uppercase tracking-widest disabled:opacity-40"
                                  style={{
                                    background: 'rgba(16,185,129,0.20)',
                                    border: '0.5px solid rgba(16,185,129,0.40)',
                                    color: C.green,
                                    borderRadius: '999px',
                                    fontWeight: 500,
                                    transition: 'all 0.3s ease',
                                  }}
                                  onMouseEnter={e => {
                                    if (payingId !== sch.id) {
                                      (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                                  }}>
                                  {payingId === sch.id
                                    ? <Loader2 size={10} className="animate-spin" />
                                    : <><Check size={10} /> Cobrado</>}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Paid installments (compact) */}
                        {reg.schedules.filter(s => s.status === 'paid').length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {reg.schedules.filter(s => s.status === 'paid').map(sch => (
                              <span key={sch.id}
                                className="text-[9px] px-2 py-1 font-mono"
                                style={{
                                  background: 'rgba(16,185,129,0.12)',
                                  color: C.green,
                                  border: '0.5px solid rgba(16,185,129,0.30)',
                                  borderRadius: '999px',
                                }}>
                                C{sch.installment_number} ✓
                              </span>
                            ))}
                            <span className="text-[9px] self-center" style={{ color: C.gray }}>pagadas</span>
                          </div>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Botón para disparar manualmente el job de cobros (envío de recordatorios) ──
function RunCronButton({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ markedOverdue: number; sentPre: number; sentOverdue: number } | null>(null);

  const run = async () => {
    if (!confirm('¿Disparar job de cobros ahora? Envía recordatorios a clientes con cuotas próximas + avisos a los que están en mora.')) return;
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('solstice-cobros-cron', { body: {} });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        setResult({
          markedOverdue: data.markedOverdue || 0,
          sentPre:       data.sentPre || 0,
          sentOverdue:   data.sentOverdue || 0,
        });
        toast.success(`Procesado · ${data.sentPre + data.sentOverdue} email(s) enviado(s)`);
        onComplete();
      } else {
        toast.error('Error: ' + (data?.error || 'unknown'));
      }
    } catch (err: any) {
      toast.error('Falló: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col items-start md:items-end gap-1.5">
      <button
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 px-5 py-3 text-[10px] uppercase"
        style={{
          background: 'rgba(230,57,47,0.18)',
          border: '0.5px solid rgba(230,57,47,0.50)',
          borderRadius: '999px',
          color: C.cream,
          letterSpacing: '0.25em',
          fontWeight: 600,
          opacity: running ? 0.5 : 1,
          cursor: running ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        Procesar cobros ahora
      </button>
      {result && (
        <p className="text-[9px] uppercase" style={{ color: C.gray, letterSpacing: '0.18em' }}>
          {result.markedOverdue} marcadas overdue · {result.sentPre} pre-aviso · {result.sentOverdue} aviso mora
        </p>
      )}
    </div>
  );
}
