import React from 'react';
import { Minus, Plus, Sparkles, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { TicketTier } from '../types';

interface TicketSelectorProps {
    tiers: TicketTier[];
    selectedTiers: { [key: string]: number };
    onSelect: (tiers: { [key: string]: number }) => void;
    className?: string;
}

export default function TicketSelector({ tiers, selectedTiers, onSelect, className }: TicketSelectorProps) {
  const handleQuantityChange = (tierId: string, delta: number) => {
    const current = selectedTiers[tierId] || 0;
    const newQty = Math.max(0, Math.min(10, current + delta));
    onSelect({ ...selectedTiers, [tierId]: newQty });
  };

  const getAvailable = (tier: TicketTier) => Math.max(0, (tier.quantity || 0) - (tier.sold || 0));

  // Orden lógico de etapas: de más barata a más cara (presale → taquilla).
  const orderedTiers = [...tiers].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

  return (
    <div className={cn('rounded-2xl border border-moonlight/10 overflow-hidden divide-y divide-moonlight/[0.06]', className)}>
      {orderedTiers.map((tier) => {
        const available = getAvailable(tier);
        const selected  = selectedTiers[tier.id] || 0;
        const isSelected = selected > 0;
        const isSoldOut  = available <= 0;
        const isLow      = available > 0 && available <= 10;

        return (
          <div
            key={tier.id}
            className={cn(
              'px-4 py-4 transition-colors',
              isSelected ? 'bg-moonlight/[0.04]' : 'bg-transparent',
              isSoldOut && 'opacity-40 pointer-events-none'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {tier.stage === 'early_bird' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-eclipse/70 rounded-full text-[8px] font-black text-moonlight/80 uppercase tracking-[0.15em]">
                      <Sparkles className="w-2.5 h-2.5" /> Early Bird
                    </span>
                  )}
                  <h3 className="text-sm font-black text-moonlight uppercase tracking-tight truncate">
                    {tier.name}
                  </h3>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-eclipse flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-moonlight" />
                    </span>
                  )}
                </div>

                {/* Description (1 line, truncated) */}
                {tier.description && (
                  <p className="text-[11px] text-moonlight/45 font-light leading-snug mb-1.5 line-clamp-2">
                    {tier.description}
                  </p>
                )}

                {/* Price + stock badge */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-base font-black text-moonlight tabular-nums leading-none">
                    ${tier.price.toLocaleString()}
                    <span className="text-[9px] text-moonlight/30 font-light ml-1 tracking-widest">COP</span>
                  </p>
                  {isSoldOut ? (
                    <span className="text-[9px] text-moonlight/40 uppercase tracking-[0.2em] font-bold">Agotado</span>
                  ) : isLow ? (
                    <span className="text-[9px] text-red-400 uppercase tracking-[0.2em] font-bold">Últimas {available}</span>
                  ) : (
                    <span className="text-[9px] text-emerald-500/70 uppercase tracking-[0.2em] font-bold">Disponible</span>
                  )}
                </div>

                {/* Perks */}
                {tier.perks && tier.perks.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1">
                    {tier.perks.slice(0, 3).map((perk, i) => (
                      <li key={i} className="text-[9px] tracking-[0.1em] uppercase text-moonlight/40 font-bold">
                        · {perk}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Right: controls */}
              {!isSoldOut && (
                <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                  <button
                    aria-label={`Restar una unidad de ${tier.name}`}
                    className="w-7 h-7 rounded-full border border-moonlight/15 flex items-center justify-center text-moonlight/40 hover:text-moonlight hover:border-moonlight/40 transition-all disabled:opacity-20"
                    onClick={() => handleQuantityChange(tier.id, -1)}
                    disabled={selected <= 0}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-4 text-center font-black text-moonlight text-sm tabular-nums">{selected}</span>
                  <button
                    aria-label={`Sumar una unidad de ${tier.name}`}
                    className="w-7 h-7 rounded-full border border-moonlight/15 flex items-center justify-center text-moonlight/40 hover:text-moonlight hover:border-moonlight/40 transition-all disabled:opacity-20"
                    onClick={() => handleQuantityChange(tier.id, 1)}
                    disabled={selected >= Math.min(10, available)}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
