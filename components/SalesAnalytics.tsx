import React, { useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    LineChart, Line, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';
import { Calendar, Clock, TrendingUp, BarChart2, Zap, Ticket } from 'lucide-react';
import { Order, Event } from '../types';
import { format, parseISO, startOfDay, eachDayOfInterval, subDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalesAnalyticsProps {
    orders: Order[];
    selectedEventId: string;
    events: Event[];
}

export const SalesAnalytics: React.FC<SalesAnalyticsProps> = ({ orders, selectedEventId, events }) => {
    const selectedEvent = events.find(e => e.id === selectedEventId);
    
    // Filtrar órdenes completadas para el evento seleccionado
    const filteredOrders = useMemo(() => {
        return orders.filter(o => o.event_id === selectedEventId && o.status === 'completed');
    }, [orders, selectedEventId]);

    // --- PROCESAMIENTO DE DATOS POR DÍA ---
    const dailyData = useMemo(() => {
        if (filteredOrders.length === 0) return [];

        // Encontrar el rango de fechas
        const dates = filteredOrders.map(o => parseISO(o.timestamp));
        const minDate = startOfDay(new Date(Math.min(...dates.map(d => d.getTime()))));
        const maxDate = startOfDay(new Date());

        // Generar todos los días en el intervalo para no tener huecos
        const interval = eachDayOfInterval({ start: minDate, end: maxDate });

        return interval.map(day => {
            const dayOrders = filteredOrders.filter(o => isSameDay(parseISO(o.timestamp), day));
            const totalTickets = dayOrders.reduce((acc, o) => {
                return acc + o.items.reduce((sum, i) => sum + i.quantity, 0);
            }, 0);
            const totalRevenue = dayOrders.reduce((acc, o) => acc + o.total, 0);

            return {
                date: format(day, 'dd MMM', { locale: es }),
                fullDate: format(day, 'yyyy-MM-dd'),
                tickets: totalTickets,
                revenue: totalRevenue
            };
        });
    }, [filteredOrders]);

    // --- PROCESAMIENTO DE DATOS POR HORA ---
    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            tickets: 0,
            revenue: 0
        }));

        filteredOrders.forEach(o => {
            const date = parseISO(o.timestamp);
            const hour = date.getHours();
            const tickets = o.items.reduce((sum, i) => sum + i.quantity, 0);
            
            hours[hour].tickets += tickets;
            hours[hour].revenue += o.total;
        });

        return hours;
    }, [filteredOrders]);

    const totalTickets = useMemo(() => {
        return filteredOrders.reduce((acc, o) => {
            return acc + o.items.reduce((sum, i) => sum + i.quantity, 0);
        }, 0);
    }, [filteredOrders]);

    const totalRevenue = useMemo(() => {
        return filteredOrders.reduce((acc, o) => acc + o.total, 0);
    }, [filteredOrders]);

    if (!selectedEventId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-moonlight/20">
                <BarChart2 size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-black uppercase tracking-widest">Selecciona un evento para ver analíticas</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Resumen Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Tickets Totales</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-white">{totalTickets}</p>
                        <Ticket className="text-neon-blue mb-1" size={16} />
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Recaudo Total</p>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-black text-white">${totalRevenue.toLocaleString()}</p>
                        <Zap className="text-emerald-500 mb-1" size={16} />
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Promedio Diario</p>
                    <p className="text-3xl font-black text-white">
                        {dailyData.length > 0 ? (totalTickets / dailyData.length).toFixed(1) : 0}
                    </p>
                </div>
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Órdenes</p>
                    <p className="text-3xl font-black text-white">{filteredOrders.length}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Gráfico de Ventas Diarias */}
                <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Calendar className="text-neon-purple" size={20} /> Tendencia Diaria
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1 uppercase font-bold tracking-widest">Volumen de tickets por día</p>
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData}>
                                <defs>
                                    <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 'bold'}}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 'bold'}}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#52525b', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="tickets" 
                                    name="Tickets"
                                    stroke="#8b5cf6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorTickets)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Gráfico de Ventas por Hora */}
                <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem]">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <Clock className="text-neon-blue" size={20} /> Distribución Horaria
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1 uppercase font-bold tracking-widest">Horas de mayor actividad</p>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis 
                                    dataKey="hour" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 'bold'}}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#52525b', fontSize: 10, fontWeight: 'bold'}}
                                />
                                <Tooltip 
                                    cursor={{fill: '#ffffff05'}}
                                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#52525b', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                                />
                                <Bar 
                                    dataKey="tickets" 
                                    name="Tickets"
                                    fill="#06b6d4" 
                                    radius={[4, 4, 0, 0]} 
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabla de Detalle por Día */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <div className="p-8 border-b border-white/5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">Desglose Cronológico</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-black/40 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                <th className="p-6">Fecha</th>
                                <th className="p-6 text-right">Tickets Vendidos</th>
                                <th className="p-6 text-right">Recaudo Bruto</th>
                                <th className="p-6 text-right">Participación</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {[...dailyData].reverse().map((day, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="p-6 font-bold text-white uppercase text-xs">{day.date}</td>
                                    <td className="p-6 text-right font-black text-neon-blue">{day.tickets}</td>
                                    <td className="p-6 text-right font-black text-white">${day.revenue.toLocaleString()}</td>
                                    <td className="p-6 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className="text-[10px] font-bold text-zinc-500">
                                                {totalTickets > 0 ? ((day.tickets / totalTickets) * 100).toFixed(1) : 0}%
                                            </span>
                                            <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-neon-purple" 
                                                    style={{ width: `${totalTickets > 0 ? (day.tickets / totalTickets) * 100 : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
