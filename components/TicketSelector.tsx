import React from 'react';
import { motion as _motion } from 'framer-motion';
import { Minus, Plus, Sparkles, Check } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { TicketTier } from '../types';

const motion = _motion as any;

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
    <div className={cn("space-y-3", className)}>
      {tiers.map((tier, index) => {
        const available = getAvailable(tier);
        const selected = selectedTiers[tier.id] || 0;
        const isSelected = selected > 0;
        const isSoldOut = available <= 0;

        return (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              "relative p-4 rounded-2xl border-2 transition-all duration-300",
              isSelected 
                ? "border-white bg-white/10 shadow-lg shadow-white/5" 
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700",
              isSoldOut && "opacity-50 pointer-events-none"
            )}
          >
            {/* Stage badge */}
            {tier.stage === 'early_bird' && (
              <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-black flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                EARLY BIRD
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              {/* Tier info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{tier.name}</h3>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-black" />
                    </motion.div>
                  )}
                </div>
                
                {tier.description && (
                  <p className="text-sm text-zinc-400 mt-1">{tier.description}</p>
                )}

                {tier.perks?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tier.perks.slice(0, 3).map((perk, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400">
                        {perk}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-zinc-500 mt-2">
                  {isSoldOut ? 'Sold Out' : `${available} disponibles`}
                </p>
              </div>

              {/* Price & quantity */}
              <div className="text-right flex flex-col items-end gap-3">
                <div>
                  <p className="text-2xl font-bold text-white">
                    ${tier.price.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase font-black">COP</p>
                </div>

                {!isSoldOut && (
                  <div className="flex items-center gap-2 bg-zinc-800 rounded-full p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-zinc-700"
                      onClick={() => handleQuantityChange(tier.id, -1)}
                      disabled={selected <= 0}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-center font-semibold text-white">{selected}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-zinc-700"
                      onClick={() => handleQuantityChange(tier.id, 1)}
                      disabled={selected >= Math.min(10, available)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}