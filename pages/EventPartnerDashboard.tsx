import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { supabase } from '../lib/supabase';

/**
 * Vista de SOCIO EVENTO — solo lectura, enlazada a UN evento.
 * Muestra el resumen (ventas + control de acceso + progreso por etapa) SIN el
 * ranking ni controles de admin. Aislada del Dashboard/AdminEvents para no
 * afectar nada del flujo existente.
 */
export const EventPartnerDashboard: React.FC = () => {
  const { events, orders, tiers, currentUser, getEventTiers, logout } = useStore();
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);

  // El evento del socio: profiles.partner_event_id; si no hay, el próximo evento.
  useEffect(() => {
    (async () => {
      let evId: string | null = null;
      if (currentUser?.user_id) {
        const { data } = await supabase.from('profiles').select('partner_event_id').eq('id', currentUser.user_id).maybeSingle();
        evId = (data as any)?.partner_event_id ?? null;
      }
      if (!evId) {
        const now = Date.now();
        const upcoming = [...events]
          .filter(e => new Date(e.event_date).getTime() > now && (e.status === 'published' || e.status === 'sold_out'))
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0];
        evId = upcoming?.id ?? events[0]?.id ?? null;
      }
      setLinkedEventId(evId);
    })();
  }, [currentUser, events]);

  const data = useMemo(() => {
    if (!linkedEventId) return null;
    const event = events.find(e => e.id === linkedEventId);
    if (!event) return null;
    const eventOrders = orders.filter(o => o.event_id === linkedEventId && o.status === 'completed');
    const salesOrders = eventOrders.filter(o => o.payment_method !== 'guest_list' && o.payment_method !== 'cortesia');
    const evTiers = getEventTiers(linkedEventId);

    const qtyOf = (o: any) => (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 1), 0);
    const soldTickets = eventOrders.reduce((a, o) => a + qtyOf(o), 0);
    const capacity = evTiers.reduce((a, t) => a + (Number(t.quantity) || 0), 0);
    const revenue = salesOrders.reduce((a, o) => a + (Number(o.total) || 0), 0);
    const pctSold = capacity > 0 ? Math.round((soldTickets / capacity) * 100) : 0;

    const scanned = eventOrders.filter(o => o.used).reduce((a, o) => a + qtyOf(o), 0);
    const occupancy = soldTickets > 0 ? Math.round((scanned / soldTickets) * 100) : 0;

    const tierStats = evTiers.map(t => {
      const sold = eventOrders.reduce((acc, o) =>
        acc + (o.items || []).filter((i: any) => i.tier_id === t.id).reduce((s: number, i: any) => s + (i.quantity || 1), 0), 0);
      return { ...t, realSold: sold };
    });
    const stageGroups = Array.from(new Set(evTiers.map((t: any) => t.stage))).map(stage => {
      const st = tierStats.filter((t: any) => t.stage === stage);
      const totalQty = st.reduce((a, t) => a + (Number(t.quantity) || 0), 0);
      const totalSold = st.reduce((a, t) => a + t.realSold, 0);
      return { stage, totalQty, totalSold, progress: totalQty > 0 ? (totalSold / totalQty) * 100 : 0 };
    });

    return { event, soldTickets, capacity, revenue, pctSold, scanned, occupancy, tierStats, stageGroups };
  }, [linkedEventId, events, orders, tiers, getEventTiers]);

  if (!data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Cargando resumen…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-5 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] text-neon-purple uppercase">Socio · Evento</p>
            <h1 className="text-2xl font-black uppercase tracking-tighter">{data.event.title}</h1>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors border border-white/10 rounded-full px-4 py-2">
            <LogOut size={13} /> Salir
          </button>
        </div>

        {/* GENERAL (ventas) */}
        <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl">
          <p className="text-[10px] font-black tracking-[0.25em] text-zinc-500 uppercase mb-2">General</p>
          <p className="text-5xl font-black tracking-tighter">{data.soldTickets} <span className="text-xl text-zinc-600">/ {data.capacity} boletos</span></p>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden my-4">
            <motion.div initial={{ width: 0 }} animate={{ width: `${data.pctSold}%` }} className="h-full bg-neon-purple rounded-full" />
          </div>
          <p className="text-2xl font-black text-neon-green">${data.revenue.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-500 font-bold">{data.pctSold}% vendido</p>
        </div>

        {/* CONTROL DE ACCESO */}
        <div className="bg-zinc-900 border border-[#490F7C]/30 p-6 md:p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-neon-purple rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">Live</span>
          </div>
          <h3 className="text-xl font-black mb-6 flex items-center gap-3"><ShieldCheck className="text-neon-purple" /> Control de Acceso</h3>
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-4xl font-black tracking-tighter">{data.scanned} <span className="text-xl text-zinc-600">/ {data.soldTickets}</span></p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Tickets Escaneados</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-neon-purple">{data.occupancy}%</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Ocupación</p>
            </div>
          </div>
          <div className="h-4 bg-[#161344] rounded-full overflow-hidden border border-white/5">
            <motion.div initial={{ width: 0 }} animate={{ width: `${data.occupancy}%` }} className="h-full bg-[#490F7C] rounded-full" />
          </div>
        </div>

        {/* PROGRESO POR ETAPA */}
        <div className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-3xl">
          <h3 className="text-xl font-black mb-6">Progreso Comercial por Etapa</h3>
          <div className="space-y-5">
            {data.stageGroups.map(stage => (
              <div key={stage.stage} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-bold uppercase tracking-widest">{String(stage.stage).replace('_', ' ')}</span>
                  <span className="text-xs font-mono text-zinc-400">{stage.totalSold} / {stage.totalQty}</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(stage.progress, 100)}%` }} className="h-full bg-white rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DETALLE POR TIER */}
        <div className="grid grid-cols-2 gap-4">
          {data.tierStats.map((t: any) => (
            <div key={t.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
              <p className="text-[10px] text-zinc-500 uppercase font-bold truncate">{t.name}</p>
              <p className="text-xl font-black mt-1">{t.realSold} <span className="text-xs font-normal text-zinc-600">vendidos</span></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventPartnerDashboard;
