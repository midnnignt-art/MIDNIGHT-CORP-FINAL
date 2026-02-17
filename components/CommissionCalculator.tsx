import React, { useState } from 'react';
import { motion as _motion } from 'framer-motion';
import { Calculator, DollarSign, Percent, ArrowRight, PiggyBank, Briefcase } from 'lucide-react';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
import { cn } from '../lib/utils';

const motion = _motion as any;

interface CommissionCalculatorProps {
  defaultTicketPrice?: number;
  defaultOperationalPercent?: number;
  defaultCommissionPercent?: number;
  className?: string;
}

export default function CommissionCalculator({ 
  defaultTicketPrice = 100,
  defaultOperationalPercent = 5,
  defaultCommissionPercent = 10,
  className 
}: CommissionCalculatorProps) {
  const [ticketPrice, setTicketPrice] = useState(defaultTicketPrice);
  const [quantity, setQuantity] = useState(10);
  const [operationalPercent, setOperationalPercent] = useState(defaultOperationalPercent);
  const [commissionPercent, setCommissionPercent] = useState(defaultCommissionPercent);

  const totalSale = ticketPrice * quantity;
  const operationalAmount = Math.round(totalSale * (operationalPercent / 100));
  const commissionAmount = Math.round(totalSale * (commissionPercent / 100));
  const freeAmount = totalSale - operationalAmount - commissionAmount;

  const breakdown = [
    { 
      label: 'Costo Operativo', 
      amount: operationalAmount, 
      percent: operationalPercent,
      icon: Briefcase,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20'
    },
    { 
      label: 'Comisión Promotor', 
      amount: commissionAmount, 
      percent: commissionPercent,
      icon: Percent,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20'
    },
    { 
      label: 'Utilidad Neta', 
      amount: freeAmount, 
      percent: 100 - operationalPercent - commissionPercent,
      icon: PiggyBank,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20'
    },
  ];

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Simulador de Comisiones</h3>
            <p className="text-sm text-zinc-500">Calculadora de distribución automática</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Inputs */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Precio Ticket</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                type="number"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Number(e.target.value))}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Cantidad</label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="bg-zinc-800 border-zinc-700 text-white h-12 rounded-xl"
            />
          </div>
        </div>

        {/* Percentage sliders */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">% Operativo</span>
              <span className="text-white font-medium">{operationalPercent}%</span>
            </div>
            <Slider
              value={[operationalPercent]}
              onValueChange={([val]) => setOperationalPercent(val)}
              max={20}
              step={0.5}
              className="py-2"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">% Comisión</span>
              <span className="text-white font-medium">{commissionPercent}%</span>
            </div>
            <Slider
              value={[commissionPercent]}
              onValueChange={([val]) => setCommissionPercent(val)}
              max={30}
              step={0.5}
              className="py-2"
            />
          </div>
        </div>

        {/* Total */}
        <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Ingreso Total</span>
            <span className="text-2xl font-bold text-white">${totalSale.toLocaleString()}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="w-5 h-5 text-zinc-600 rotate-90" />
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          {breakdown.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "p-4 rounded-2xl border",
                item.bgColor,
                item.borderColor
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br",
                    item.color
                  )}>
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs text-zinc-500">{item.percent.toFixed(1)}%</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-white">${item.amount.toLocaleString()}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}