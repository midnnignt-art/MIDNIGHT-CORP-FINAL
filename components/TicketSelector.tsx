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

  const getAvailable = (tier: TicketTier) => tier.quantity - (tier.sold || 0);

  return (
    <div className={cn('rounded-2xl border border-moonlight/10 overflow-hidden divide-y divide-moonlight/[0.06]', className)}>
      {tiers.map((tier) => {
        const available = getAvailable(tier);
        const selected  = selectedTiers[tier.id] || 0;
        const isSelected = selected > 0;
        const isSoldOut  = available <= 0;

        return (
          <div
            key={tier.id}
            className={cn(
              'flex items-center justify-between px-4 py-3.5 transition-colors',
              isSelected ? 'bg-moonlight/[0.04]' : 'bg-transparent',
              isSoldOut && 'opacity-30 pointer-events-none'
            )}
          >
            {/* Left: info */}
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
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
              <p className="text-base font-black text-moonlight tabular-nums leading-none">
                ${tier.price.toLocaleString()}
                <span className="text-[9px] text-moonlight/30 font-light ml-1 tracking-widest">COP</span>
              </p>
            </div>

            {/* Right: controls */}
            {isSoldOut ? (
              <span className="text-[9px] text-moonlight/30 uppercase tracking-widest font-bold flex-shrink-0">Agotado</span>
            ) : (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  className="w-7 h-7 rounded-full border border-moonlight/15 flex items-center justify-center text-moonlight/40 hover:text-moonlight hover:border-moonlight/40 transition-all disabled:opacity-20"
                  onClick={() => handleQuantityChange(tier.id, -1)}
                  disabled={selected <= 0}
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-4 text-center font-black text-moonlight text-sm tabular-nums">{selected}</span>
                <button
                  className="w-7 h-7 rounded-full border border-moonlight/15 flex items-center justify-center text-moonlight/40 hover:text-moonlight hover:border-moonlight/40 transition-all disabled:opacity-20"
                  onClick={() => handleQuantityChange(tier.id, 1)}
                  disabled={selected >= Math.min(10, available)}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
