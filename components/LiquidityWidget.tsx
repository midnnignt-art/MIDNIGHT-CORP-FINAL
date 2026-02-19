import React from 'react';
import { motion as _motion } from 'framer-motion';
import { Wallet, TrendingUp, ArrowUpRight, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { Wallet as WalletType } from '../types';

const motion = _motion as any;

interface LiquidityWidgetProps {
  wallets?: WalletType[];
  totalBalance?: number;
  availableBalance?: number;
  pendingBalance?: number;
  showAmounts?: boolean;
  onToggleAmounts?: () => void;
  onRefresh?: () => void;
  className?: string;
  title?: string;
}

export default function LiquidityWidget({ 
  wallets = [], 
  totalBalance = 0,
  availableBalance = 0,
  pendingBalance = 0,
  showAmounts = true,
  onToggleAmounts,
  onRefresh,
  className,
  title = "Liquidez Total"
}: LiquidityWidgetProps) {
  const formatCurrency = (amount: number) => {
    if (!showAmounts) return '••••••';
    return `$${amount.toLocaleString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900",
        "border border-zinc-700/50 p-6",
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
              <p className="text-xs text-zinc-500">Tiempo Real</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onToggleAmounts} className="h-8 w-8 text-zinc-400">
              {showAmounts ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8 text-zinc-400">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Total balance */}
        <div className="mb-6">
          <p className="text-4xl font-bold text-white tracking-tight">
            {formatCurrency(totalBalance)}
          </p>
          <p className="text-sm text-zinc-500 mt-1">COP (Bruto)</p>
        </div>

        {/* Balance breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Disponible</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(availableBalance)}</p>
            <p className="text-xs text-zinc-500 mt-1">Fondos Líquidos</p>
          </div>
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Pendiente</span>
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(pendingBalance)}</p>
            <p className="text-xs text-zinc-500 mt-1">En Proceso</p>
          </div>
        </div>

        {/* Wallets/Pockets */}
        {wallets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Bolsillos Inteligentes</p>
            {wallets.slice(0, 4).map((wallet, index) => (
              <motion.div
                key={wallet.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-8 rounded-full",
                    wallet.type === 'event' ? 'bg-purple-500' :
                    wallet.type === 'operational' ? 'bg-blue-500' :
                    wallet.type === 'commission' ? 'bg-amber-500' :
                    'bg-zinc-500'
                  )} />
                  <div>
                    <p className="text-sm font-medium text-white">{wallet.name}</p>
                    <p className="text-xs text-zinc-500 capitalize">{
                        wallet.type === 'event' ? 'Evento' :
                        wallet.type === 'operational' ? 'Operativo' :
                        wallet.type === 'commission' ? 'Comisiones' : 'General'
                    }</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white">{formatCurrency(wallet.balance)}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Quick action */}
        <Button 
          className="w-full mt-6 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
          onClick={() => alert("Solicitud de retiro procesada.")}
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          Retirar Fondos
        </Button>
      </div>
    </motion.div>
  );
}