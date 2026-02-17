import React from 'react';
import { motion as _motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { TicketTier } from '../types';

const motion = _motion as any;

const STAGE_COLORS = {
  early_bird: '#f59e0b',
  presale: '#8b5cf6',
  general: '#06b6d4',
  door: '#10b981'
};

interface SalesChartProps {
  salesData?: any[];
  tiers?: TicketTier[];
  className?: string;
  title?: string;
}

export default function SalesChart({ 
  salesData = [], 
  tiers = [],
  className,
  title = "Velocidad de Ventas"
}: SalesChartProps) {
  // Default data to avoid empty chart crashes
  const chartData = salesData.length > 0 ? salesData : [
    { date: 'Lun', sales: 0, tickets: 0 },
    { date: 'Mar', sales: 0, tickets: 0 },
    { date: 'Mié', sales: 0, tickets: 0 },
    { date: 'Jue', sales: 0, tickets: 0 },
    { date: 'Vie', sales: 0, tickets: 0 },
    { date: 'Sáb', sales: 0, tickets: 0 },
    { date: 'Dom', sales: 0, tickets: 0 },
  ];

  // Construct Pie Data safely
  const pieData = tiers.length > 0 
    ? tiers.map(t => ({
        name: t.name,
        value: t.sold,
        stage: t.stage
      })).filter(d => d.value > 0) 
    : [
        { name: 'Sin Ventas', value: 100, stage: 'general' } 
      ];

  // If no sales yet, use a placeholder for visual balance
  const displayPieData = pieData.length > 0 ? pieData : [{ name: 'Listo', value: 100, stage: 'general' }];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl">
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <p className="text-lg font-bold text-white">
            ${payload[0].value.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-400">
            {payload[0].payload.tickets} entradas
          </p>
        </div>
      );
    }
    return null;
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
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-zinc-500">Rastreo de Ingresos (Tiempo Real)</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">En Vivo</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="p-6 grid md:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="md:col-span-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={(value) => `${(value / 1000)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - Stage breakdown */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Por Localidad</p>
          <div className="relative w-36 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {displayPieData.map((entry, index) => (
                    <Cell key={index} fill={STAGE_COLORS[entry.stage as keyof typeof STAGE_COLORS] || '#3f3f46'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-2 max-h-32 overflow-y-auto w-full px-2">
            {displayPieData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                    <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: STAGE_COLORS[item.stage as keyof typeof STAGE_COLORS] || '#3f3f46' }}
                    />
                    <span className="text-zinc-400 truncate max-w-[80px]">{item.name}</span>
                </div>
                <span className="text-white font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}