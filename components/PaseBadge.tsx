import React, { useEffect, useState } from 'react';
import { motion as _motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { fetchPaseLevel, PaseLevel, TIER_META } from '../lib/paseLevel';

const motion = _motion as any;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

interface Props {
  email: string | null | undefined;
  variant?: 'compact' | 'full';
}

/**
 * Visual del nivel del Pase MIDNIGHT del cliente.
 *
 * - `compact`: chip pequeño con tier name + ícono (para usar en navbar/header)
 * - `full`: card con tier name + barra de progreso + beneficios
 */
export const PaseBadge: React.FC<Props> = ({ email, variant = 'full' }) => {
  const [pase, setPase] = useState<PaseLevel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!email) { setLoading(false); return; }
    fetchPaseLevel(email).then(result => {
      if (mounted) {
        setPase(result);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [email]);

  if (loading) {
    return variant === 'compact'
      ? <span className="inline-flex h-5 w-16 bg-moonlight/5 rounded-full animate-pulse" />
      : <div className="rounded-2xl border border-moonlight/10 bg-midnight/30 h-32 animate-pulse" />;
  }

  if (!pase) return null;

  const meta = TIER_META[pase.tier];

  if (variant === 'compact') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.25em]"
        style={{ borderColor: meta.color + '60', backgroundColor: meta.bg, color: meta.color }}
      >
        <Sparkles size={9} />
        {meta.label}
      </span>
    );
  }

  // FULL variant
  const progressPct = pase.next_tier_at?.events_left !== undefined && pase.next_tier_at.events_left > 0
    ? Math.round(((pase.events_count) / (pase.events_count + pase.next_tier_at.events_left)) * 100)
    : pase.tier === 'PLATINUM' ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="rounded-2xl border bg-midnight/30 p-5 md:p-6 relative overflow-hidden"
      style={{ borderColor: meta.color + '50' }}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${meta.color}30, transparent 60%)` }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[9px] font-bold tracking-[0.4em] text-moonlight/40 uppercase mb-1.5">Tu Pase MIDNIGHT</p>
            <h3
              className="text-2xl md:text-3xl font-black tracking-tighter uppercase"
              style={{ color: meta.color }}
            >
              {meta.label}
            </h3>
          </div>
          <Sparkles size={28} style={{ color: meta.color }} className="opacity-80" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-[9px] font-bold tracking-[0.3em] text-moonlight/35 uppercase">Eventos</p>
            <p className="text-2xl font-black text-moonlight tabular-nums">{pase.events_count}</p>
          </div>
          <div>
            <p className="text-[9px] font-bold tracking-[0.3em] text-moonlight/35 uppercase">Invertido</p>
            <p className="text-2xl font-black text-moonlight tabular-nums">${Math.round(Number(pase.total_spent) / 1000)}K</p>
          </div>
        </div>

        {pase.next_tier && pase.next_tier_at?.events_left !== undefined && pase.next_tier_at.events_left > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold tracking-[0.3em] text-moonlight/40 uppercase">
                Faltan {pase.next_tier_at.events_left} para {TIER_META[pase.next_tier].label}
              </p>
              <p className="text-[10px] font-black text-moonlight">{progressPct}%</p>
            </div>
            <div className="relative w-full h-1 bg-moonlight/10 overflow-hidden rounded-full">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progressPct / 100 }}
                transition={{ delay: 0.3, duration: 1, ease: EASE_OUT }}
                style={{ originX: 0, backgroundColor: meta.color }}
                className="absolute inset-y-0 left-0 right-0"
              />
            </div>
          </div>
        )}

        {pase.tier === 'PLATINUM' && (
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase mb-5" style={{ color: meta.color }}>
            ★ Nivel máximo alcanzado
          </p>
        )}

        <div className="border-t border-moonlight/5 pt-4">
          <p className="text-[9px] font-bold tracking-[0.3em] text-moonlight/35 uppercase mb-2.5">Beneficios</p>
          <ul className="space-y-1.5">
            {meta.benefits.map((b, i) => (
              <li key={i} className="text-[11px] text-moonlight/75 font-light flex items-start gap-2">
                <span className="text-moonlight/40 mt-0.5">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default PaseBadge;
