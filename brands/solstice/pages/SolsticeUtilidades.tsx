import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, TrendingUp, ArrowDownCircle, ArrowUpCircle, Percent, CreditCard, Calendar, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

// ── Configuración de fees por pasarela ─────────────────────────────────────
// Defaults aproximados — el admin puede ajustarlos en localStorage si su
// contrato con la pasarela difiere. Wompi cobra 2.99% + $900 COP por TX;
// Bold ronda 3.50% + $900 COP por TX (varían por volumen). Estos valores
// se aplican SOLO a transacciones cobradas (active/completed), no a las
// que están pendientes.
type ProviderKey = 'wompi' | 'bold';
const DEFAULT_PROVIDER_FEES: Record<ProviderKey, { pct: number; fixed: number; label: string }> = {
  wompi: { pct: 2.99, fixed: 900,  label: 'Wompi' },
  bold:  { pct: 3.50, fixed: 900,  label: 'Bold'  },
};

// El owner pidió un fee de plataforma del 5% que se descuenta del bruto
// que recibe Midnight (el cliente NO ve este fee — paga el precio nominal).
const PLATFORM_FEE_PCT = 5;

const C = { red: '#E6392F', cream: '#F9F2D7', gray: '#606060', green: '#10b981', amber: '#FFB48C' };

interface Registration {
  id: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  payment_mode: string;
  payment_provider: string | null;
  created_at: string;
}

interface Schedule {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

type DateRange = 'all' | 'today' | '7d' | '30d' | 'season';

function fmt(n: number): string {
  return new Intl.NumberFormat('es-CO').format(Math.round(n));
}

function fmtK(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

function applyRange(regs: Registration[], range: DateRange): Registration[] {
  if (range === 'all' || range === 'season') return regs;
  const now = Date.now();
  const ms = range === 'today' ? 24 * 3600 * 1000
           : range === '7d'    ? 7 * 24 * 3600 * 1000
           : 30 * 24 * 3600 * 1000;
  return regs.filter(r => now - new Date(r.created_at).getTime() <= ms);
}

export default function SolsticeUtilidades() {
  const [regs, setRegs]         = useState<Registration[]>([]);
  const [schedules, setSch]     = useState<Schedule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [range, setRange]       = useState<DateRange>('season');
  const [fees, setFees]         = useState(DEFAULT_PROVIDER_FEES);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: r }, { data: s }] = await Promise.all([
          supabase.from('solstice_registrations')
            .select('id, total_amount, amount_paid, status, payment_mode, payment_provider, created_at'),
          supabase.from('solstice_payment_schedules')
            .select('id, amount, status, paid_at'),
        ]);
        setRegs((r || []) as Registration[]);
        setSch((s || []) as Schedule[]);
      } catch (err) {
        console.warn('Utilidades load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => applyRange(regs, range), [regs, range]);

  // ── Métricas core ────────────────────────────────────────────────────────
  const m = useMemo(() => {
    const active = filtered.filter(r => r.status === 'active' || r.status === 'completed');

    // Vendido = monto comprometido (total_amount) de reservas activas/completas
    const vendido = active.reduce((acc, r) => acc + (r.total_amount || 0), 0);

    // Cobrado = amount_paid de reservas activas/completas
    const cobrado = active.reduce((acc, r) => acc + (r.amount_paid || 0), 0);

    // Pendiente (cuotas todavía no cobradas)
    const pendiente = Math.max(0, vendido - cobrado);

    // Por pasarela — separamos las transacciones de pago real (one-shot)
    // de las cuotas. One-shot: una transacción única en la pasarela.
    // Cuotas: cada schedule pagado = una transacción en la pasarela.
    const byProvider: Record<string, { gross: number; tx: number; mode: string[] }> = {};

    for (const r of active) {
      const prov = r.payment_provider || (r.payment_mode === 'cash_to_seller' ? 'cash' : 'unknown');
      if (!byProvider[prov]) byProvider[prov] = { gross: 0, tx: 0, mode: [] };

      if (r.payment_mode === 'full_combo' || r.payment_mode === 'individual_days') {
        // One-shot: 1 TX por el total cobrado
        byProvider[prov].gross += r.amount_paid || 0;
        byProvider[prov].tx += r.amount_paid > 0 ? 1 : 0;
      } else {
        // Cuotas: la primera (entry_price) entra acá; las siguientes salen
        // de schedules. Para simplificar contamos solo lo cobrado.
        byProvider[prov].gross += r.amount_paid || 0;
        byProvider[prov].tx += r.amount_paid > 0 ? 1 : 0;
      }
      if (!byProvider[prov].mode.includes(r.payment_mode)) byProvider[prov].mode.push(r.payment_mode);
    }

    // Sumar también schedules pagados (cuotas adicionales tras el adelanto)
    // ASUMIMOS que el provider de las cuotas es 'bold' (auto/manual usan Bold).
    const paidSchedules = schedules.filter(sc => sc.status === 'paid');
    for (const sc of paidSchedules) {
      if (!byProvider.bold) byProvider.bold = { gross: 0, tx: 0, mode: [] };
      byProvider.bold.gross += sc.amount;
      byProvider.bold.tx += 1;
      if (!byProvider.bold.mode.includes('cuota')) byProvider.bold.mode.push('cuota');
    }

    // Fees de pasarela por proveedor
    const gatewayFees = Object.entries(byProvider).map(([key, v]) => {
      const cfg = (fees as any)[key] || { pct: 0, fixed: 0, label: key };
      const fee = (v.gross * (cfg.pct / 100)) + (v.tx * cfg.fixed);
      return { provider: key, label: cfg.label, gross: v.gross, tx: v.tx, fee, modes: v.mode };
    }).filter(g => g.gross > 0 || g.tx > 0);

    const totalGatewayFees = gatewayFees.reduce((acc, g) => acc + g.fee, 0);

    // Fee plataforma 5% sobre todo lo cobrado (no lo vendido — solo si entró plata)
    const platformFee = cobrado * (PLATFORM_FEE_PCT / 100);

    // Neto para Midnight = lo cobrado - fees pasarela - fee plataforma
    const netoMidnight = cobrado - totalGatewayFees - platformFee;

    // Proyección si TODO lo vendido se cobra
    const projectedGatewayFees = (() => {
      // Asumir distribución similar de providers para el pendiente
      if (cobrado === 0) return 0;
      const avgFeePct = totalGatewayFees / cobrado;
      return pendiente * avgFeePct;
    })();
    const projectedPlatformFee = vendido * (PLATFORM_FEE_PCT / 100);
    const projectedNet = vendido - projectedGatewayFees - totalGatewayFees - projectedPlatformFee;

    return {
      vendido, cobrado, pendiente,
      gatewayFees, totalGatewayFees,
      platformFee, netoMidnight,
      projectedNet, projectedPlatformFee, projectedGatewayFees: projectedGatewayFees + totalGatewayFees,
      activeCount: active.length,
    };
  }, [filtered, schedules, fees]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
      </div>
    );
  }

  const rangeOpts: { id: DateRange; label: string }[] = [
    { id: 'today',  label: 'Hoy' },
    { id: '7d',     label: '7 días' },
    { id: '30d',    label: '30 días' },
    { id: 'season', label: 'Toda la temporada' },
  ];

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: C.cream, fontFamily: "'Archivo', sans-serif" }}
      className="pt-24 pb-24 px-4 md:px-10 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] uppercase mb-2" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
          Administración
        </p>
        <h1 className="text-3xl md:text-5xl uppercase mb-2" style={{ fontFamily: "'Poiret One', sans-serif", letterSpacing: '0.04em', fontWeight: 300 }}>
          Utilidades
        </h1>
        <p className="text-xs uppercase" style={{ color: C.gray, letterSpacing: '0.2em' }}>
          {m.activeCount} reservas activas · Bruto, fees y neto a Midnight
        </p>
      </div>

      {/* Date range tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {rangeOpts.map(opt => (
          <button
            key={opt.id}
            onClick={() => setRange(opt.id)}
            className="px-4 py-2 text-[10px] uppercase"
            style={{
              background: range === opt.id ? `${C.red}25` : 'rgba(255,255,255,0.04)',
              border: `0.5px solid ${range === opt.id ? `${C.red}88` : 'rgba(255,255,255,0.10)'}`,
              borderRadius: '999px',
              color: range === opt.id ? C.cream : C.gray,
              letterSpacing: '0.2em',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label="Vendido"
          value={fmtK(m.vendido)}
          sub={`${m.activeCount} reservas`}
          icon={<TrendingUp size={16} />}
          color={C.cream}
        />
        <KpiCard
          label="Cobrado"
          value={fmtK(m.cobrado)}
          sub={`Plata entrada hoy a las pasarelas`}
          icon={<ArrowDownCircle size={16} />}
          color={C.green}
        />
        <KpiCard
          label="Pendiente"
          value={fmtK(m.pendiente)}
          sub={m.pendiente > 0 ? 'Cuotas por cobrar' : 'Sin saldo pendiente'}
          icon={<ArrowUpCircle size={16} />}
          color={m.pendiente > 0 ? C.amber : C.gray}
        />
      </div>

      {/* Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-8 mb-6" style={{
          borderRadius: '24px',
          background: 'rgba(255,255,255,0.025)',
          border: '0.5px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px)',
        }}>

        <p className="text-[10px] uppercase mb-5" style={{ letterSpacing: '0.4em', color: C.red, fontWeight: 600 }}>
          Desglose · {rangeOpts.find(o => o.id === range)?.label}
        </p>

        {/* Gross */}
        <BreakdownRow
          label="Bruto cobrado"
          amount={m.cobrado}
          color={C.cream}
          big
        />

        <div className="my-4" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }} />

        {/* Per-provider gateway fees */}
        <p className="text-[9px] uppercase mb-3" style={{ letterSpacing: '0.3em', color: C.gray, fontWeight: 600 }}>
          Fees pasarelas de pago
        </p>
        {m.gatewayFees.length === 0 ? (
          <p className="text-xs italic mb-3" style={{ color: C.gray }}>Sin transacciones cobradas todavía</p>
        ) : (
          m.gatewayFees.map(g => (
            <ProviderRow
              key={g.provider}
              providerKey={g.provider}
              label={g.label}
              gross={g.gross}
              tx={g.tx}
              fee={g.fee}
              fees={fees}
              onChange={(pct, fixed) => setFees(prev => ({ ...prev, [g.provider]: { ...((prev as any)[g.provider] || {}), pct, fixed, label: g.label } }))}
            />
          ))
        )}

        <BreakdownRow
          label="Total fees pasarela"
          amount={-m.totalGatewayFees}
          color={C.red}
          negative
        />

        <div className="my-4" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }} />

        {/* Platform fee */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Percent size={14} style={{ color: C.amber }} />
            <div>
              <p className="text-xs uppercase" style={{ letterSpacing: '0.2em', fontWeight: 600 }}>
                Fee plataforma · {PLATFORM_FEE_PCT}%
              </p>
              <p className="text-[10px]" style={{ color: C.gray }}>
                Descuento aplicado al bruto a Midnight cada vez
              </p>
            </div>
          </div>
          <p className="text-base tabular-nums" style={{ color: C.red, fontWeight: 500 }}>
            -${fmt(m.platformFee)}
          </p>
        </div>

        <div className="my-4" style={{ borderTop: `0.5px solid ${C.red}55` }} />

        {/* Net */}
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm uppercase" style={{ letterSpacing: '0.2em', fontWeight: 600, color: C.cream }}>
              Neto a Midnight
            </p>
            <p className="text-[10px]" style={{ color: C.gray }}>
              Después de fees pasarela + 5% plataforma
            </p>
          </div>
          <p className="text-2xl md:text-3xl tabular-nums" style={{ color: C.green, fontWeight: 300, fontFamily: "'Poiret One', sans-serif" }}>
            ${fmt(m.netoMidnight)}
          </p>
        </div>
      </motion.div>

      {/* Projection card */}
      {m.pendiente > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="p-6 md:p-8 mb-6" style={{
            borderRadius: '24px',
            background: 'rgba(255,180,140,0.04)',
            border: '0.5px solid rgba(255,180,140,0.25)',
          }}>
          <div className="flex items-start gap-3 mb-4">
            <Calendar size={16} style={{ color: C.amber }} />
            <div>
              <p className="text-[10px] uppercase" style={{ letterSpacing: '0.3em', color: C.amber, fontWeight: 600 }}>
                Proyección si todo se cobra
              </p>
              <p className="text-[10px] mt-1" style={{ color: C.gray }}>
                Asumimos que los {m.activeCount} clientes pagan sus cuotas hasta el final
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] uppercase" style={{ letterSpacing: '0.25em', color: C.gray }}>
                Bruto proyectado
              </p>
              <p className="text-xl tabular-nums" style={{ color: C.cream, fontWeight: 300 }}>
                ${fmt(m.vendido)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase" style={{ letterSpacing: '0.25em', color: C.gray }}>
                Neto proyectado Midnight
              </p>
              <p className="text-xl tabular-nums" style={{ color: C.green, fontWeight: 300 }}>
                ${fmt(m.projectedNet)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Help line */}
      <div className="flex items-start gap-2 px-2 mt-6 text-[10px]" style={{ color: C.gray, lineHeight: 1.5 }}>
        <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Los fees de pasarela son aproximaciones — ajustá los porcentajes haciendo click en cada fila si tu contrato con Bold/Wompi difiere de los defaults. Los valores quedan guardados en tu navegador (no en la base de datos).
        </span>
      </div>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="p-5" style={{
      borderRadius: '20px',
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(20px)',
    }}>
      <div className="flex items-center gap-2 mb-3" style={{ color: C.gray }}>
        {icon}
        <span className="text-[9px] uppercase" style={{ letterSpacing: '0.3em', fontWeight: 600 }}>{label}</span>
      </div>
      <p className="text-3xl tabular-nums" style={{ color, fontWeight: 300, fontFamily: "'Poiret One', sans-serif" }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: C.gray, letterSpacing: '0.05em' }}>{sub}</p>
    </div>
  );
}

function BreakdownRow({ label, amount, color, negative, big }: {
  label: string; amount: number; color: string; negative?: boolean; big?: boolean;
}) {
  const display = negative ? `-$${fmt(Math.abs(amount))}` : `$${fmt(amount)}`;
  return (
    <div className="flex items-center justify-between py-2">
      <p className={big ? 'text-sm uppercase' : 'text-xs uppercase'}
        style={{ letterSpacing: big ? '0.2em' : '0.15em', fontWeight: big ? 600 : 500, color: big ? C.cream : C.gray }}>
        {label}
      </p>
      <p className={big ? 'text-2xl tabular-nums' : 'text-base tabular-nums'}
        style={{ color, fontWeight: big ? 300 : 500, fontFamily: big ? "'Poiret One', sans-serif" : 'inherit' }}>
        {display}
      </p>
    </div>
  );
}

function ProviderRow({ providerKey, label, gross, tx, fee, fees, onChange }: {
  providerKey: string; label: string; gross: number; tx: number; fee: number;
  fees: Record<string, { pct: number; fixed: number; label: string }>;
  onChange: (pct: number, fixed: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const cfg = (fees as any)[providerKey] || { pct: 0, fixed: 0 };

  return (
    <div className="py-2.5 px-3 mb-1.5" style={{
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '0.5px solid rgba(255,255,255,0.06)',
    }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <CreditCard size={12} style={{ color: C.gray, flexShrink: 0 }} />
          <div className="min-w-0">
            <p className="text-xs uppercase" style={{ letterSpacing: '0.15em', fontWeight: 600 }}>
              {label}
            </p>
            <p className="text-[10px]" style={{ color: C.gray }}>
              ${fmt(gross)} bruto · {tx} {tx === 1 ? 'transacción' : 'transacciones'} · {cfg.pct}% + ${fmt(cfg.fixed)}/TX
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base tabular-nums" style={{ color: C.red, fontWeight: 500 }}>-${fmt(fee)}</p>
          <button onClick={() => setEditing(!editing)} className="text-[9px] uppercase"
            style={{ color: C.gray, letterSpacing: '0.15em', textDecoration: 'underline', fontWeight: 500 }}>
            {editing ? 'cerrar' : 'ajustar'}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 pt-3 grid grid-cols-2 gap-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div>
            <label className="text-[9px] uppercase block mb-1" style={{ letterSpacing: '0.2em', color: C.gray, fontWeight: 600 }}>
              % por TX
            </label>
            <input
              type="number"
              step="0.01"
              value={cfg.pct}
              onChange={e => onChange(Number(e.target.value), cfg.fixed)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '8px',
                color: C.cream,
                padding: '6px 10px',
                fontSize: '12px',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label className="text-[9px] uppercase block mb-1" style={{ letterSpacing: '0.2em', color: C.gray, fontWeight: 600 }}>
              Fijo COP/TX
            </label>
            <input
              type="number"
              step="100"
              value={cfg.fixed}
              onChange={e => onChange(cfg.pct, Number(e.target.value))}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: '8px',
                color: C.cream,
                padding: '6px 10px',
                fontSize: '12px',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
