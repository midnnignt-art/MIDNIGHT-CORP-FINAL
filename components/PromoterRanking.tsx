import React from 'react';
import { motion as _motion } from 'framer-motion';
import { Trophy, Crown, Medal } from 'lucide-react';
import { Progress } from './ui/progress';
import { cn } from '../lib/utils';
import { Promoter } from '../types';

const motion = _motion as any;

interface PromoterRankingProps {
    promoters: Promoter[];
    className?: string;
    title?: string;
}

export default function PromoterRanking({ promoters = [], className, title = "Top Promotores" }: PromoterRankingProps) {
  // Fix: Create a copy before sorting to avoid mutating props/state
  const data = [...promoters].sort((a,b) => b.total_sales - a.total_sales);
  const maxSales = Math.max(...data.map(p => p.total_sales)) || 1;

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-amber-400" />;
    if (index === 1) return <Medal className="w-5 h-5 text-zinc-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm text-zinc-500">{index + 1}</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-3xl bg-zinc-900/50 border border-zinc-800 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="text-sm text-zinc-500">Ranking de Ventas</p>
            </div>
          </div>
          <div className="text-xs text-zinc-500">Tráfico vs Conversión</div>
        </div>
      </div>

      {/* Ranking list */}
      <div className="divide-y divide-zinc-800">
        {data.length === 0 && (
            <div className="p-6 text-center text-zinc-500">No hay promotores activos en esta vista.</div>
        )}
        {data.map((promoter, index) => (
          <motion.div
            key={promoter.user_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="p-4 hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="flex-shrink-0">
                {getRankIcon(index)}
              </div>

              {/* Avatar & Name */}
              <div className="flex-shrink-0">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                  index === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500 text-black" :
                  "bg-zinc-700 text-white"
                )}>
                  {promoter.name.split(' ').map(n => n[0]).join('')}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{promoter.name}</p>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-800 text-zinc-400 font-mono">
                    {promoter.code}
                  </span>
                </div>
                
                {/* Sales progress bar */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex-1">
                    <Progress 
                      value={(promoter.total_sales / maxSales) * 100} 
                      className="h-1.5 bg-zinc-800"
                    />
                  </div>
                  <span className="text-sm font-semibold text-white">
                    ${(promoter.total_sales / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}