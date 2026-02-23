import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, Event, TicketTier, EventCost, Order } from '../types';
import { 
    TrendingUp, Target, Wallet, BarChart2, Activity, Zap, 
    Plus, Trash2, ShieldAlert, Receipt, DollarSign, Briefcase, 
    Users, Palette, Truck, HelpCircle, CheckCircle2, Clock, Ticket, Coins, Laptop
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion as _motion, AnimatePresence } from 'framer-motion';

const motion = _motion as any;

interface ProjectionsProps {
    role: UserRole;
}

interface ScenarioRow {
    locality: string;
    price: number;
    commission: number;
    units: number;
    netTicket: number;
    totalRevenue: number;
    totalNetRevenue: number;
}

interface ScenarioResult {
    percentage: number;
    isBreakEven: boolean;
    rows: ScenarioRow[];
    totalTickets: number;
    totalRevenue: number; 
    totalNetRevenue: number;
    totalFixedCosts: number;
    utility: number;
    avgTicket: number;
}

export const Projections: React.FC<ProjectionsProps> = ({ role }) => {
    const { events, getEventTiers, addEventCost, deleteEventCost, updateCostStatus, orders, promoters, teams } = useStore();
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
    
    // New Cost State
    const [costConcept, setCostConcept] = useState('');
    const [costAmount, setCostAmount] = useState('');
    const [costCategory, setCostCategory] = useState<EventCost['category']>('other');

    useEffect(() => {
        if (!selectedEventId && events.length > 0) setSelectedEventId(events[0].id);
    }, [events, selectedEventId]);

    useEffect(() => {
        if (selectedEventId) generateProjections();
    }, [selectedEventId, events, orders]);

    const selectedEvent = events.find(e => e.id === selectedEventId);
    const eventTiers = getEventTiers(selectedEventId);

    const generateProjections = () => {
        if (!selectedEvent) return;
        const totalFixedCosts = selectedEvent.costs?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
        const tiers = [...eventTiers].sort((a, b) => a.price - b.price);
        const totalCapacity = tiers.reduce((sum, t) => sum + t.quantity, 0);

        let accumulatedNetRevenue = 0;
        let ticketsForBreakEven = 0;
        let breakEvenFound = false;
        let breakEvenPercentage = 0;

        // Proyección pesimista: asumimos que todas las ventas futuras tienen comisión
        for (const tier of tiers) {
            const netPerTicket = tier.price - (tier.commission_fixed || 0);
            for (let i = 0; i < tier.quantity; i++) {
                accumulatedNetRevenue += netPerTicket;
                ticketsForBreakEven++;
                if (!breakEvenFound && accumulatedNetRevenue >= totalFixedCosts) {
                    breakEvenFound = true;
                    if (totalCapacity > 0) breakEvenPercentage = (ticketsForBreakEven / totalCapacity) * 100;
                    break;
                }
            }
            if (breakEvenFound) break;
        }

        const results: ScenarioResult[] = [];
        for (let p = 10; p <= 100; p += 10) {
            results.push(calculateScenario(p, totalCapacity, totalFixedCosts, tiers));
            if (breakEvenFound && breakEvenPercentage > p && breakEvenPercentage < p + 10) {
                results.push(calculateScenario(breakEvenPercentage, totalCapacity, totalFixedCosts, tiers, true));
            }
        }
        setScenarios(results.sort((a,b)=>a.percentage - b.percentage));
    };

    const calculateScenario = (percentage: number, totalCapacity: number, totalFixedCosts: number, sortedTiers: TicketTier[], isBreakEven: boolean = false): ScenarioResult => {
        const targetTickets = Math.floor((totalCapacity * percentage) / 100);
        let ticketsRemaining = targetTickets;
        let scenarioRevenue = 0;
        let scenarioNetRevenue = 0;
        let scenarioTickets = 0;
        const rows: ScenarioRow[] = [];
        
        for (const tier of sortedTiers) {
            if (ticketsRemaining <= 0) break;
            const unitsToSell = Math.min(tier.quantity, ticketsRemaining);
            const netPerTicket = tier.price - (tier.commission_fixed || 0);
            const gross = tier.price * unitsToSell;
            const net = netPerTicket * unitsToSell;

            if (unitsToSell > 0) {
                rows.push({
                    locality: tier.name, price: tier.price,
                    commission: tier.commission_fixed || 0,
                    units: unitsToSell, netTicket: netPerTicket,
                    totalRevenue: gross, totalNetRevenue: net
                });
            }
            scenarioRevenue += gross; scenarioNetRevenue += net;
            scenarioTickets += unitsToSell; ticketsRemaining -= unitsToSell;
        }

        return {
            percentage, isBreakEven, rows, totalTickets: scenarioTickets,
            totalRevenue: scenarioRevenue, totalNetRevenue: scenarioNetRevenue,
            totalFixedCosts, utility: scenarioNetRevenue - totalFixedCosts,
            avgTicket: scenarioTickets > 0 ? scenarioRevenue / scenarioTickets : 0
        };
    };

    const handleAddCost = () => {
        if (!selectedEventId || !costConcept || !costAmount) return;
        addEventCost(selectedEventId, { concept: costConcept, amount: parseFloat(costAmount), category: costCategory, status: 'pending' });
        setCostConcept(''); setCostAmount('');
    };

    const formatCurrency = (val: number) => `$${val.toLocaleString()}`;

    // --- KPIs REALES: Replicando Lógica Exacta del Dashboard ---
    const realMetrics = useMemo(() => {
        if (!selectedEventId) return { cash: 0, digital: 0, comms: 0, net: 0, revenue: 0 };
        
        // --- LOGICA DE LIQUIDACIÓN MAESTRA (COPIA EXACTA DE DASHBOARD) ---
        
        // 1. Filtrar Ordenes del Evento
        const filteredOrders = orders.filter(o => o.event_id === selectedEventId && o.status === 'completed');

        // 2. Definir Helper de Cálculo (Igual al Dashboard)
        const calculateMetrics = (subsetOrders: Order[], forceNoCommission = false) => {
            const digitalOrders = subsetOrders.filter(o => o.payment_method !== 'cash');
            const cashOrders = subsetOrders.filter(o => o.payment_method === 'cash');

            const digitalGross = digitalOrders.reduce((acc, o) => acc + o.total, 0);
            const cashGross = cashOrders.reduce((acc, o) => acc + o.total, 0);
            
            // CRITICAL: Force No Commission for Organic/Admin group
            const totalCommission = forceNoCommission ? 0 : subsetOrders.reduce((acc, o) => acc + o.commission_amount, 0);
            
            // LIQUIDACIÓN REAL: Efectivo Recaudado - Comisiones Totales
            const netLiquidation = cashGross - totalCommission;
            
            return { digitalGross, cashGross, totalCommission, netLiquidation };
        };

        let grandTotal = { digitalGross: 0, cashGross: 0, totalCommission: 0, netLiquidation: 0 };

        // Identify Managers to exclude from Independents
        const teamManagerIds = teams.map(t => t.manager_id).filter(id => id);

        // 3. Procesar Squads
        teams.forEach(team => {
            const memberIds = [team.manager_id, ...team.members_ids];
            const teamOrders = filteredOrders.filter(o => o.staff_id && memberIds.includes(o.staff_id));
            const metrics = calculateMetrics(teamOrders);
            
            grandTotal.digitalGross += metrics.digitalGross;
            grandTotal.cashGross += metrics.cashGross;
            grandTotal.totalCommission += metrics.totalCommission;
            grandTotal.netLiquidation += metrics.netLiquidation;
        });

        // 4. Procesar Independientes
        const independentPromoters = promoters.filter(p => 
            !p.sales_team_id && 
            p.role !== UserRole.ADMIN &&
            !teamManagerIds.includes(p.user_id) // FIX: Ensure managers are not counted twice
        );

        if (independentPromoters.length > 0) {
            const indepOrders = filteredOrders.filter(o => o.staff_id && independentPromoters.some(p => p.user_id === o.staff_id));
            const metrics = calculateMetrics(indepOrders);
            
            grandTotal.digitalGross += metrics.digitalGross;
            grandTotal.cashGross += metrics.cashGross;
            grandTotal.totalCommission += metrics.totalCommission;
            grandTotal.netLiquidation += metrics.netLiquidation;
        }

        // 5. Procesar Orgánico + Admin
        const adminPromoters = promoters.filter(p => p.role === UserRole.ADMIN);
        const adminIds = adminPromoters.map(p => p.user_id);
        if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

        const organicOrders = filteredOrders.filter(o => !o.staff_id || adminIds.includes(o.staff_id));
        if (organicOrders.length > 0) {
             const metrics = calculateMetrics(organicOrders, true); // Force No Commission
             grandTotal.digitalGross += metrics.digitalGross;
             grandTotal.cashGross += metrics.cashGross;
             grandTotal.totalCommission += metrics.totalCommission;
             grandTotal.netLiquidation += metrics.netLiquidation;
        }

        return {
            cash: grandTotal.cashGross,
            digital: grandTotal.digitalGross,
            comms: grandTotal.totalCommission,
            net: grandTotal.netLiquidation,
            revenue: grandTotal.cashGross + grandTotal.digitalGross
        };

    }, [orders, selectedEventId, teams, promoters]);

    const realFixedCosts = selectedEvent?.costs?.reduce((a,b)=>a+b.amount,0) || 0;
    
    // Utilidad: Total Revenue - Costos Fijos - Comisiones Reales
    const realUtility = realMetrics.revenue - realFixedCosts - realMetrics.comms;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4 border-b border-white/10 pb-6">
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-3">
                        <TrendingUp className="text-neon-green" /> Análisis de Rentabilidad
                    </h1>
                    <p className="text-gray-400 mt-1">Gestión de presupuesto basada en datos de venta real.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {events.map(e => (
                        <button key={e.id} onClick={() => setSelectedEventId(e.id)} className={`px-4 py-2 rounded-xl border font-bold transition-all ${selectedEventId === e.id ? 'bg-white text-black border-white' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                            {e.title}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                
                {/* CAJA NETA (KPI PRINCIPAL) */}
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet size={40}/></div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">Caja Neta (Liquidación)</p>
                    <p className="text-2xl font-black text-white">{formatCurrency(realMetrics.net)}</p>
                    <p className="text-[9px] text-zinc-600 mt-1 uppercase font-bold">Efectivo Recaudado - Comis. Totales</p>
                </div>

                {/* BREAKDOWN VENTAS */}
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-2">Desglose Ingresos</p>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-500 font-bold flex items-center gap-1"><Coins size={10}/> Efectivo</span>
                            <span className="text-white font-bold">{formatCurrency(realMetrics.cash)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-purple-400 font-bold flex items-center gap-1"><Laptop size={10}/> Digital</span>
                            <span className="text-white font-bold">{formatCurrency(realMetrics.digital)}</span>
                        </div>
                    </div>
                </div>

                {/* UTILIDAD REAL */}
                <div className={`p-6 rounded-3xl border relative overflow-hidden group ${realUtility >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Activity size={40}/></div>
                    <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-1">Utilidad en Tiempo Real</p>
                    <p className={`text-2xl font-black ${realUtility >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(realUtility)}</p>
                    <p className="text-[9px] text-zinc-500 mt-1 uppercase font-bold">Total Ventas - Costos - Comisiones</p>
                </div>

                {/* COSTOS Y COMISIONES */}
                <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
                     <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] mb-2">Salidas</p>
                     <div className="space-y-2">
                         <div className="flex justify-between items-center text-xs">
                             <span className="text-red-400 font-bold">Gastos Fijos</span>
                             <span className="text-white font-bold">-{formatCurrency(realFixedCosts)}</span>
                         </div>
                         <div className="flex justify-between items-center text-xs">
                             <span className="text-amber-500 font-bold">Comisiones</span>
                             <span className="text-white font-bold">-{formatCurrency(realMetrics.comms)}</span>
                         </div>
                     </div>
                </div>
            </div>

            {/* EXPENSE MANAGEMENT */}
            <div className="bg-midnight-900 border border-white/10 rounded-[2.5rem] overflow-hidden mb-12 shadow-2xl">
                <div className="p-8 border-b border-white/10 bg-white/[0.02]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-neon-purple/20 rounded-2xl flex items-center justify-center border border-neon-purple/20">
                                <Receipt className="text-neon-purple w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">Presupuesto de Gastos</h2>
                                <p className="text-xs text-zinc-500">Registra cada salida de capital del evento.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={costCategory} onChange={e => setCostCategory(e.target.value as any)} className="bg-black border border-white/10 rounded-xl px-3 h-12 text-xs font-bold text-white">
                                <option value="venue">Venue</option>
                                <option value="production">Producción</option>
                                <option value="staff">Staff</option>
                                <option value="marketing">Marketing</option>
                                <option value="artists">Artistas</option>
                                <option value="logistics">Logística</option>
                                <option value="other">Otros</option>
                            </select>
                            <input value={costConcept} onChange={e => setCostConcept(e.target.value)} placeholder="Concepto" className="bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white min-w-[200px]" />
                            <input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="Monto $" className="bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white w-32" />
                            <Button onClick={handleAddCost} disabled={!costConcept || !costAmount} className="h-12 bg-white text-black font-black px-6">
                                <Plus className="w-5 h-5 mr-2" /> AGREGAR GASTO
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Categoría</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Concepto</th>
                                <th className="px-8 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Monto</th>
                                <th className="px-8 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {selectedEvent?.costs?.map(cost => (
                                <tr key={cost.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-5 text-[10px] font-black text-white uppercase opacity-70">{cost.category}</td>
                                    <td className="px-8 py-5 font-bold text-white text-sm">{cost.concept}</td>
                                    <td className="px-8 py-5 text-right font-mono font-bold text-red-400">-{formatCurrency(cost.amount)}</td>
                                    <td className="px-8 py-5 text-right">
                                        <button onClick={() => deleteEventCost(selectedEventId, cost.id)} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SCENARIOS */}
            <h2 className="text-xl font-black flex items-center gap-2 text-neon-purple mb-8">
                <BarChart2 className="w-6 h-6" /> Simulaciones de Riesgo y Utilidad
            </h2>
            <div className="space-y-12 pb-20">
                {scenarios.map((scenario, idx) => (
                    <div key={idx} className={`rounded-[2rem] overflow-hidden border ${scenario.isBreakEven ? 'border-amber-500 bg-amber-500/5' : 'border-white/5 bg-midnight-900'}`}>
                        <div className={`p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 ${scenario.isBreakEven ? 'bg-amber-500/20' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${scenario.isBreakEven ? 'bg-amber-500 text-black' : 'bg-white/10'}`}>
                                    {Math.round(scenario.percentage)}%
                                </div>
                                <div>
                                    <h3 className={`text-xl font-black ${scenario.isBreakEven ? 'text-amber-500' : 'text-white'}`}>{scenario.isBreakEven ? 'PUNTO DE EQUILIBRIO' : `Escenario Venta: ${Math.round(scenario.percentage)}% del Aforo`}</h3>
                                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                                        Venta Total Estimada: {scenario.totalTickets} Tickets
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Utilidad Neta Proyectada</p>
                                <p className={`text-3xl font-black ${scenario.utility >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(scenario.utility)}</p>
                            </div>
                        </div>

                        {/* DETAILED BREAKDOWN TABLE */}
                        <div className="p-8 bg-black/20">
                            <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Target size={14}/> Desglose de Metas por Localidad
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider border-b border-white/5">
                                        <tr>
                                            <th className="pb-4 pl-4">Etapa / Localidad</th>
                                            <th className="pb-4 text-right">Precio Ticket</th>
                                            <th className="pb-4 text-right">Comisión (Est.)</th>
                                            <th className="pb-4 text-right text-neon-blue">Neto Unitario</th>
                                            <th className="pb-4 text-right">Meta Venta (Und)</th>
                                            <th className="pb-4 text-right pr-4 text-emerald-500">Recaudo Neto Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-zinc-300">
                                        {scenario.rows.map((row, rIdx) => (
                                            <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-4 pl-4 font-bold text-white">{row.locality}</td>
                                                <td className="py-4 text-right text-zinc-400">${row.price.toLocaleString()}</td>
                                                <td className="py-4 text-right text-red-400">-${row.commission.toLocaleString()}</td>
                                                <td className="py-4 text-right font-bold text-neon-blue">${row.netTicket.toLocaleString()}</td>
                                                <td className="py-4 text-right font-bold text-white bg-white/5 rounded-lg">{row.units}</td>
                                                <td className="py-4 text-right pr-4 font-black text-emerald-500">${row.totalNetRevenue.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-white/5 font-bold">
                                        <tr>
                                            <td colSpan={4} className="py-4 pl-4 text-right text-zinc-500 uppercase text-xs tracking-widest">Totales Escenario</td>
                                            <td className="py-4 text-right text-white">{scenario.totalTickets}</td>
                                            <td className="py-4 text-right pr-4 text-emerald-400">${scenario.totalNetRevenue.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* FINANCIAL SUMMARY FOOTER */}
                        <div className="bg-zinc-950 p-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs border-t border-white/5">
                            <div className="flex flex-wrap gap-6">
                                <div className="flex flex-col">
                                    <span className="text-zinc-600 font-bold uppercase tracking-wider text-[10px]">Ticket Promedio</span>
                                    <span className="text-white font-bold text-lg">${Math.round(scenario.avgTicket).toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-zinc-600 font-bold uppercase tracking-wider text-[10px]">Gastos Fijos (Break Even)</span>
                                    <span className="text-red-400 font-bold text-lg">-${scenario.totalFixedCosts.toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-xl border border-white/5">
                                <span className="text-zinc-500 font-bold uppercase tracking-widest">Resultado:</span>
                                <span className={`font-black text-sm uppercase px-2 py-1 rounded ${scenario.utility >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {scenario.utility >= 0 ? 'RENTABLE' : 'DÉFICIT / RIESGO'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};