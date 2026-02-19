import React, { useState, useMemo } from 'react';
import { UserRole, Promoter, SalesTeam, Order } from '../types';
import { Button } from '../components/ui/button';
import { Banknote, Award, Target, History, Users, Plus, X, Layers, UserPlus, TrendingUp, Sparkles, ChevronRight, Trash2, ShieldCheck, PieChart, Eye, Calendar, Ticket, ArrowRightLeft, ScrollText, Wallet, Link as LinkIcon, Copy, Share2, Check, Smartphone, User, Search, Filter, Loader2, Download, BarChart, AlertTriangle, CreditCard, Mail, Globe } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import PromoterRanking from '../components/PromoterRanking';
import { motion as _motion, AnimatePresence } from 'framer-motion';

const motion = _motion as any;

export const Dashboard: React.FC<{ role: UserRole }> = ({ role }) => {
  const { events, promoters, orders, tiers, createOrder, getEventTiers, currentUser, teams, addStaff } = useStore();
  const [showManualSale, setShowManualSale] = useState(false);
  const [showRecruitmentModal, setShowRecruitmentModal] = useState(false);
  
  // Link Sharing State
  const [linkCopied, setLinkCopied] = useState(false);

  // Filters & Tabs
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>(''); // Empty by default to force selection
  const [staffSearch, setStaffSearch] = useState('');

  // Ranking Filters
  const [rankingFilterEvent, setRankingFilterEvent] = useState<string>('all');
  const [rankingDateStart, setRankingDateStart] = useState('');
  const [rankingDateEnd, setRankingDateEnd] = useState('');

  // Manual Sale State
  const [selectedEventId, setSelectedEventId] = useState('');
  const [cart, setCart] = useState<{tierId: string, quantity: number}[]>([]);
  const [manualCustomerInfo, setManualCustomerInfo] = useState({ name: '', email: '' });
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Recruitment State (Manager scope)
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState(''); 

  // Detailed View State
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);

  if (!currentUser) return null;

  // PERMISOS MAESTROS
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isHead = currentUser.role === UserRole.HEAD_OF_SALES || isAdmin;
  const isManager = currentUser.role === UserRole.MANAGER || isHead; 
  
  // --- IDENTIFICAR EL SQUAD DEL MANAGER ---
  const myTeam = teams.find(t => t.manager_id === currentUser.user_id); 

  // --- GENERADOR DE LINK INTELIGENTE ---
  const referralLink = `${window.location.origin}/?ref=${currentUser.code}`;
  
  const handleCopyLink = () => {
      navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareWhatsapp = () => {
      const text = `¡Hola! Consigue tus entradas oficiales para los eventos de Midnight Corp aquí: ${referralLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- EXPORTAR LIQUIDACIÓN CSV ---
  const handleExportLiquidation = (data: any[]) => {
      if (!selectedEventFilter) return alert("Selecciona un evento primero.");
      const eventName = events.find(e => e.id === selectedEventFilter)?.title || 'Evento';
      
      let csvContent = "data:text/csv;charset=utf-8,";
      // Headers
      csvContent += "Squad,Manager,Bruto Total,Comision,Neto a Pagar,Tickets Totales\n";
      
      data.forEach(row => {
          csvContent += `${row.name},${row.manager_name || 'N/A'},${row.gross},${row.commission},${row.net},${row.ordersCount || 0}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Liquidacion_General_${eventName}.csv`);
      document.body.appendChild(link);
      link.click();
  };

  // --- LÓGICA DE LIQUIDACIÓN GLOBAL (ADMIN/HEAD) ---
  const globalLiquidationData = useMemo(() => {
      if (!isHead || !selectedEventFilter) return null;

      const filteredOrders = orders.filter(o => o.event_id === selectedEventFilter);
      const eventTiers = getEventTiers(selectedEventFilter);
      const stages = Array.from(new Set(eventTiers.map(t => t.stage)));

      const calculateBreakdown = (ordersSubset: Order[]) => {
          const breakdown: {[key: string]: {qty: number, total: number}} = {};
          stages.forEach(s => breakdown[s] = {qty: 0, total: 0});

          ordersSubset.forEach(o => {
             o.items.forEach(item => {
                 const tier = eventTiers.find(t => t.id === item.tier_id);
                 if (tier) {
                     breakdown[tier.stage].qty += item.quantity;
                     breakdown[tier.stage].total += item.subtotal;
                 }
             });
          });
          return breakdown;
      };

      // 1. Procesar Squads Reales
      const teamStats = teams.map(team => {
          const memberIds = [team.manager_id, ...team.members_ids];
          const teamOrders = filteredOrders.filter(o => o.staff_id && memberIds.includes(o.staff_id));
          const gross = teamOrders.reduce((acc, o) => acc + o.total, 0);
          const commission = teamOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          const breakdown = calculateBreakdown(teamOrders);
          
          const members = promoters.filter(p => memberIds.includes(p.user_id)).map(p => {
              const staffOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
              const pGross = staffOrders.reduce((acc, o) => acc + o.total, 0);
              const pComm = staffOrders.reduce((acc, o) => acc + o.commission_amount, 0);
              return {
                  ...p,
                  gross: pGross,
                  commission: pComm,
                  net: pGross - pComm,
                  breakdown: calculateBreakdown(staffOrders)
              };
          });

          return {
              id: team.id,
              name: team.name,
              manager_name: promoters.find(p => p.user_id === team.manager_id)?.name,
              isVirtual: false,
              gross,
              commission,
              net: gross - commission,
              ordersCount: teamOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
              breakdown,
              members
          };
      });

      // 2. Procesar Promotores Independientes (Sin Squad, Excluyendo Admin)
      const independentPromoters = promoters.filter(p => !p.sales_team_id && p.role !== UserRole.ADMIN);
      if (independentPromoters.length > 0) {
          const indepOrders = filteredOrders.filter(o => o.staff_id && independentPromoters.some(p => p.user_id === o.staff_id));
          const gross = indepOrders.reduce((acc, o) => acc + o.total, 0);
          const commission = indepOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          const breakdown = calculateBreakdown(indepOrders);

          const members = independentPromoters.map(p => {
              const staffOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
              const pGross = staffOrders.reduce((acc, o) => acc + o.total, 0);
              const pComm = staffOrders.reduce((acc, o) => acc + o.commission_amount, 0);
              return {
                  ...p,
                  gross: pGross,
                  commission: pComm,
                  net: pGross - pComm,
                  breakdown: calculateBreakdown(staffOrders)
              };
          }).filter(m => m.gross > 0 || m.role === UserRole.PROMOTER);

          teamStats.push({
              id: 'virtual_independent',
              name: 'SIN SQUAD / INDEPENDIENTES',
              manager_name: 'Gestión Directa',
              isVirtual: true,
              gross,
              commission,
              net: gross - commission,
              ordersCount: indepOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
              breakdown,
              members
          });
      }

      // 3. Procesar Orgánico + Admin
      // Ventas donde staff_id es NULL o pertenece a un ADMIN
      const adminPromoters = promoters.filter(p => p.role === UserRole.ADMIN);
      const adminIds = adminPromoters.map(p => p.user_id);
      // Fallback Admin ID hardcoded in StoreContext
      if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

      const organicOrders = filteredOrders.filter(o => !o.staff_id || adminIds.includes(o.staff_id));

      if (organicOrders.length > 0) {
          const gross = organicOrders.reduce((acc, o) => acc + o.total, 0);
          const commission = organicOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          const breakdown = calculateBreakdown(organicOrders);

          // Members: Web Direct + Admins
          const organicMembers: any[] = []; // Explicit typing or any to allow mix

          // Web Direct (NULL staff_id)
          const webOrders = organicOrders.filter(o => !o.staff_id);
          if (webOrders.length > 0 || organicOrders.length > 0) {
               // Always show Web Direct row if there are orders, or if we want to show it exists
               if(webOrders.length > 0) {
                   const wGross = webOrders.reduce((acc, o) => acc + o.total, 0);
                   const wComm = webOrders.reduce((acc, o) => acc + o.commission_amount, 0);
                   organicMembers.push({
                      user_id: 'web_direct',
                      name: 'Venta Web / Directa',
                      email: 'system@midnight.corp', // FIX: Added mandatory email
                      code: 'SYSTEM',
                      role: UserRole.ADMIN, // FIX: Use valid enum role
                      total_sales: wGross, // FIX: Added mandatory field
                      total_commission_earned: wComm, // FIX: Added mandatory field
                      gross: wGross,
                      commission: wComm,
                      net: wGross - wComm,
                      breakdown: calculateBreakdown(webOrders)
                   });
               }
          }

          // Admins
          adminPromoters.forEach(admin => {
              const aOrders = organicOrders.filter(o => o.staff_id === admin.user_id);
              if (aOrders.length > 0) {
                  const aGross = aOrders.reduce((acc, o) => acc + o.total, 0);
                  const aComm = aOrders.reduce((acc, o) => acc + o.commission_amount, 0);
                  organicMembers.push({
                      ...admin,
                      gross: aGross,
                      commission: aComm,
                      net: aGross - aComm,
                      breakdown: calculateBreakdown(aOrders)
                  });
              }
          });

          teamStats.unshift({
              id: 'virtual_organic',
              name: 'ORGANICO / MIDNIGHT',
              manager_name: 'Sistema Central',
              isVirtual: true,
              gross,
              commission,
              net: gross - commission,
              ordersCount: organicOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0),
              breakdown,
              members: organicMembers
          });
      }

      return { allTeams: teamStats, stages };
  }, [orders, teams, promoters, isHead, selectedEventFilter, tiers]);

  // ... (rest of the file remains unchanged) ...
  // --- DATOS PARA AUDITORÍA DE SQUAD (Pop-up) ---
  const selectedSquadDetails = useMemo(() => {
      if (!viewingTeamId || !globalLiquidationData) return null;
      return globalLiquidationData.allTeams.find(t => t.id === viewingTeamId);
  }, [viewingTeamId, globalLiquidationData]);

  // --- LOGICA RANKING GENERAL ---
  const generalRankingData = useMemo(() => {
      let filteredOrders = orders;

      // Filter by Event
      if (rankingFilterEvent !== 'all') {
          filteredOrders = filteredOrders.filter(o => o.event_id === rankingFilterEvent);
      }

      // Filter by Date
      if (rankingDateStart) {
          filteredOrders = filteredOrders.filter(o => new Date(o.timestamp) >= new Date(rankingDateStart));
      }
      if (rankingDateEnd) {
          const endDate = new Date(rankingDateEnd);
          endDate.setHours(23, 59, 59);
          filteredOrders = filteredOrders.filter(o => new Date(o.timestamp) <= endDate);
      }

      const stats = promoters.map(p => {
          const myOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
          const ticketsSold = myOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
          const revenue = myOrders.reduce((acc, o) => acc + o.total, 0);
          
          return {
              ...p,
              ticketsSold,
              revenue,
              orders: myOrders // For Audit
          };
      }).filter(p => p.ticketsSold > 0).sort((a,b) => b.ticketsSold - a.ticketsSold); // Sort by Tickets (Units)

      return stats;
  }, [orders, promoters, rankingFilterEvent, rankingDateStart, rankingDateEnd]);


  // --- CÁLCULO DE MÉTRICAS (KPIs) POR ROL ---
  const { kpiSales, kpiCommissions, kpiNetToSend, scopeLabel } = useMemo(() => {
    let scopeOrders: typeof orders = [];
    let label = "";

    if (isHead) {
        scopeOrders = orders;
        label = "Global (Red Completa)";
    } else if (isManager) {
        const teamMemberIds = myTeam ? [currentUser.user_id, ...myTeam.members_ids] : [currentUser.user_id];
        scopeOrders = orders.filter(o => o.staff_id && teamMemberIds.includes(o.staff_id));
        label = myTeam ? `Squad: ${myTeam.name}` : "Vista Manager";
    } else {
        scopeOrders = orders.filter(o => o.staff_id === currentUser.user_id);
        label = "Rendimiento Personal";
    }

    const sales = scopeOrders.reduce((acc, o) => acc + o.total, 0);
    const commissions = scopeOrders.reduce((acc, o) => acc + o.commission_amount, 0);
    const netToSend = sales - commissions;

    return { kpiSales: sales, kpiCommissions: commissions, kpiNetToSend: netToSend, scopeLabel: label };
  }, [orders, currentUser, teams, isHead, isManager, myTeam]);

  const handleManualSale = async () => {
    if (!selectedEventId || cart.length === 0) return;
    if (!manualCustomerInfo.name || !manualCustomerInfo.email) return alert("Faltan datos.");
    
    setIsProcessingSale(true);

    const fullCartItems = cart.map(item => {
        const tier = tiers.find(t => t.id === item.tierId);
        return {
            tier_id: item.tierId,
            tier_name: tier?.name || 'Item Desconocido',
            quantity: item.quantity,
            unit_price: tier?.price || 0,
            subtotal: (tier?.price || 0) * item.quantity
        };
    });

    const total = fullCartItems.reduce((acc, item) => acc + item.subtotal, 0);

    // Call createOrder safely. If staff ID is invalid, it will fallback to organic inside StoreContext.
    const result = await createOrder(selectedEventId, fullCartItems, 'cash', currentUser.user_id, manualCustomerInfo);
    
    setIsProcessingSale(false);

    if (result) {
        setCart([]); 
        setManualCustomerInfo({ name: '', email: '' });
        setShowManualSale(false); 
        setSelectedEventId('');
        alert(`¡Venta Registrada Exitosamente!\nTotal: $${total.toLocaleString()}`);
    }
  };

  const handleManagerRecruit = () => {
      if (!newStaffName || !newStaffCode || !newStaffPassword || !myTeam) return;
      addStaff({ 
          name: newStaffName, 
          code: newStaffCode.toUpperCase(), 
          password: newStaffPassword, // ENVÍO DE CONTRASEÑA
          role: UserRole.PROMOTER, // 'PROMOTER'
          sales_team_id: myTeam.id, 
          manager_id: currentUser.user_id // Use user_id
      });
      setNewStaffName(''); setNewStaffCode(''); setNewStaffPassword(''); setShowRecruitmentModal(false);
  };

  const staffDetails = useMemo(() => {
      if (!viewingStaffId) return { name: '', sales: [], stats: {tickets: 0, revenue: 0} };
      
      let staffOrders: Order[] = [];
      let promoterName = '';

      if (viewingStaffId === 'web_direct') {
          promoterName = 'Venta Web / Directa';
          // Filter where staff_id is null or empty
          staffOrders = orders.filter(o => !o.staff_id);
      } else {
          const promoter = promoters.find(p => p.user_id === viewingStaffId);
          promoterName = promoter?.name || 'Desconocido';
          staffOrders = orders.filter(o => o.staff_id === viewingStaffId);
      }
      
      // Filter by Event (global filter)
      if (rankingFilterEvent !== 'all') {
          staffOrders = staffOrders.filter(o => o.event_id === rankingFilterEvent);
      } else if (selectedEventFilter) {
          // If viewing from the Liquidation Module (which requires an event selected), prioritize that
          staffOrders = staffOrders.filter(o => o.event_id === selectedEventFilter);
      }
      
      const sortedSales = staffOrders.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const tickets = sortedSales.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0);
      const revenue = sortedSales.reduce((acc, o) => acc + o.total, 0);

      return { name: promoterName, sales: sortedSales, stats: {tickets, revenue} };
  }, [viewingStaffId, promoters, orders, rankingFilterEvent, selectedEventFilter]);

  return (
    <div className="min-h-screen pt-20 md:pt-24 px-4 max-w-7xl mx-auto pb-20">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-8 md:mb-12">
        <div>
          <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter">
            {isAdmin ? 'MIDNIGHT COMMAND' : isHead ? 'CENTRAL DE VENTAS' : isManager ? 'MI SQUAD' : 'PORTAL STAFF'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isAdmin ? 'bg-neon-purple' : 'bg-emerald-500'}`}></span>
              <p className="text-zinc-500 font-bold uppercase text-[9px] md:text-[10px] tracking-widest">
                {currentUser.name} • {currentUser.role} • <span className="text-white">{scopeLabel}</span>
              </p>
          </div>
        </div>
        <div className="flex gap-2 md:gap-3 w-full md:w-auto">
            {isManager && (
                <Button onClick={() => setShowRecruitmentModal(true)} className="bg-white text-black font-black h-10 md:h-12 px-4 md:px-6 rounded-lg md:rounded-xl border-none text-xs md:text-sm flex-1 md:flex-none">
                    <UserPlus className="mr-2 w-3 h-3 md:w-4 md:h-4" /> RECLUTAR
                </Button>
            )}
            <Button onClick={() => setShowManualSale(true)} className="bg-neon-blue text-black font-black h-10 md:h-12 px-4 md:px-6 rounded-lg md:rounded-xl border-none text-xs md:text-sm flex-1 md:flex-none">
                <Banknote className="mr-2 w-3 h-3 md:w-4 md:h-4" /> VENTA MANUAL
            </Button>
        </div>
      </div>

      {/* --- KPI SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1 md:mb-2">Ventas Brutas</p>
            <p className="text-2xl md:text-4xl font-black text-white">${kpiSales.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-neon-blue/20 group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform text-neon-blue"><Wallet size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-neon-blue font-black uppercase tracking-widest mb-1 md:mb-2">Neto a Liquidar</p>
            <p className="text-2xl md:text-4xl font-black text-white">${kpiNetToSend.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-emerald-500/20 group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform text-emerald-500"><Award size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1 md:mb-2">Comisiones Totales</p>
            <p className="text-2xl md:text-4xl font-black text-white">${kpiCommissions.toLocaleString()}</p>
        </div>
      </div>

      {/* --- PANEL MAESTRO DE LIQUIDACIÓN (ADMIN / HEAD OF SALES) --- */}
      {isHead && (
          <div className="space-y-6 md:space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 bg-zinc-900/30 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                  <div className="flex-1 w-full">
                      <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-neon-purple w-5 h-5 md:w-6 md:h-6" /> Liquidación Maestra
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1 font-bold uppercase tracking-widest">Selecciona un evento para auditar.</p>
                  </div>
                  <div className="flex gap-2 md:gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-3 h-3 md:w-4 md:h-4"/>
                          <select 
                            value={selectedEventFilter} 
                            onChange={e => setSelectedEventFilter(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl pl-8 md:pl-10 pr-4 h-10 md:h-12 text-[10px] md:text-xs font-black text-white uppercase appearance-none focus:border-neon-purple outline-none cursor-pointer"
                          >
                              <option value="">SELECCIONAR EVENTO (REQUERIDO)</option>
                              {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                          </select>
                      </div>
                  </div>
              </div>

              {!selectedEventFilter ? (
                  <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[2rem]">
                      <AlertTriangle className="mx-auto text-zinc-600 mb-4" />
                      <p className="text-zinc-500 font-bold uppercase text-sm">Debes seleccionar un evento para ver liquidaciones.</p>
                  </div>
              ) : globalLiquidationData && (
                  <div className="grid grid-cols-1 gap-6">
                      
                      {/* LIQUIDACIÓN UNIFICADA DE SQUADS */}
                      <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden">
                          <div className="p-5 md:p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Liquidación por Equipos</h3>
                              <Button onClick={() => handleExportLiquidation(globalLiquidationData.allTeams)} size="sm" variant="outline" className="text-[10px]">
                                  <Download size={14} className="mr-2"/> EXPORTAR
                              </Button>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                      <tr>
                                          <th className="p-3 md:p-6">Squad / Grupo</th>
                                          {globalLiquidationData.stages.map(s => (
                                              <th key={s} className="p-3 md:p-6 text-right whitespace-nowrap">{s.replace('_',' ')} (Qty/$)</th>
                                          ))}
                                          <th className="p-3 md:p-6 text-right">Bruto Total</th>
                                          <th className="p-3 md:p-6 text-right text-emerald-500">Comisión</th>
                                          <th className="p-3 md:p-6 text-right text-neon-blue">A Pagar</th>
                                          <th className="p-3 md:p-6 text-center">Auditoría</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                                      {globalLiquidationData.allTeams.map(team => (
                                          <tr key={team.id} className={`hover:bg-white/[0.02] transition-colors ${team.id === 'virtual_organic' ? 'bg-neon-purple/5 border-l-4 border-l-neon-purple' : team.isVirtual ? 'bg-zinc-800/20 border-l-4 border-l-amber-500' : ''}`}>
                                              <td className="p-3 md:p-6">
                                                  <div className={`font-black text-white ${team.id === 'virtual_organic' ? 'text-neon-purple text-base' : team.isVirtual ? 'text-amber-500 text-sm' : ''}`}>{team.name}</div>
                                                  <div className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Mgr: {team.manager_name || 'N/A'}</div>
                                              </td>
                                              {globalLiquidationData.stages.map(s => {
                                                  const data = team.breakdown[s];
                                                  return (
                                                      <td key={s} className="p-3 md:p-6 text-right text-zinc-400">
                                                          <div className="font-bold text-white">{data.qty} und</div>
                                                          <div className="text-[9px]">${data.total.toLocaleString()}</div>
                                                      </td>
                                                  );
                                              })}
                                              <td className="p-3 md:p-6 text-right font-bold text-white">${team.gross.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${team.commission.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-right font-black text-neon-blue text-base">${team.net.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-center">
                                                  <button onClick={() => setViewingTeamId(team.id)} className="p-2 bg-white/5 rounded-lg md:rounded-xl hover:bg-neon-purple/20 text-zinc-500 hover:text-neon-purple transition-all border border-transparent hover:border-neon-purple/20 flex items-center justify-center mx-auto">
                                                      <Users size={14} className="md:w-4 md:h-4 mr-2"/> Miembros
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* --- RANKING GENERAL (NUEVO MÓDULO) --- */}
      <div className="mt-12 bg-zinc-900 border border-white/5 rounded-[2.5rem] p-6 md:p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                  <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                      <BarChart className="text-amber-500 w-6 h-6" /> Ranking General de Ventas
                  </h2>
                  <p className="text-xs text-zinc-500 mt-1 font-bold">Rendimiento individual por unidades y revenue.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <select 
                      value={rankingFilterEvent} 
                      onChange={e => setRankingFilterEvent(e.target.value)}
                      className="bg-black border border-white/10 rounded-xl px-4 h-10 text-[10px] md:text-xs font-bold text-white uppercase focus:border-amber-500 outline-none"
                  >
                      <option value="all">TODO EL HISTÓRICO</option>
                      {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                  <input 
                      type="date"
                      value={rankingDateStart}
                      onChange={e => setRankingDateStart(e.target.value)}
                      className="bg-black border border-white/10 rounded-xl px-4 h-10 text-[10px] md:text-xs text-white"
                  />
                  <input 
                      type="date"
                      value={rankingDateEnd}
                      onChange={e => setRankingDateEnd(e.target.value)}
                      className="bg-black border border-white/10 rounded-xl px-4 h-10 text-[10px] md:text-xs text-white"
                  />
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                      <tr>
                          <th className="p-4 rounded-l-xl">#</th>
                          <th className="p-4">Promotor</th>
                          <th className="p-4 text-right">Tickets (Und)</th>
                          <th className="p-4 text-right">Revenue Generado</th>
                          <th className="p-4 rounded-r-xl text-center">Auditoría</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                      {generalRankingData.map((p, idx) => (
                          <tr key={p.user_id} className="hover:bg-white/5 transition-colors group">
                              <td className="p-4 font-black text-amber-500 text-lg">{idx + 1}</td>
                              <td className="p-4">
                                  <div className="font-bold text-white">{p.name}</div>
                                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-zinc-400">{p.role}</span>
                              </td>
                              <td className="p-4 text-right font-black text-white text-base">{p.ticketsSold}</td>
                              <td className="p-4 text-right font-bold text-emerald-500">${p.revenue.toLocaleString()}</td>
                              <td className="p-4 text-center">
                                  <button onClick={() => setViewingStaffId(p.user_id)} className="p-2 bg-zinc-800 hover:bg-white/20 rounded-lg text-white transition-all text-[10px] font-bold uppercase flex items-center gap-1 mx-auto">
                                      <History size={12}/> Ver Detalle
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {generalRankingData.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase">No hay datos para este filtro</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* SECCIÓN MANAGER: MI EQUIPO DIRECTO (VISTA ESTÁNDAR) */}
      {isManager && !isAdmin && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 mb-20 mt-12">
              <div className="xl:col-span-2 space-y-6 md:space-y-8">
                  <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <div className="p-5 md:p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                          <div>
                              <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-3">
                                  <Users className="text-neon-blue w-5 h-5 md:w-6 md:h-6" /> Mi Equipo
                              </h3>
                              <p className="text-xs text-zinc-500 mt-1 font-bold">Rendimiento de reclutas.</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[9px] md:text-[10px] text-zinc-500 uppercase font-black">Miembros</p>
                              <p className="text-xl md:text-2xl font-black text-white">{myTeam?.members_ids.length || 0}</p>
                          </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                  <tr>
                                      <th className="p-3 md:p-6">Staff</th>
                                      <th className="p-3 md:p-6 text-right">Bruto</th>
                                      <th className="p-3 md:p-6 text-right text-emerald-500">Comisión</th>
                                      <th className="p-3 md:p-6 text-right text-neon-blue">A Liquidar</th>
                                      <th className="p-3 md:p-6 text-center">Acción</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                                  {promoters.filter(p => myTeam?.members_ids.includes(p.user_id)).map(member => (
                                      <tr key={member.user_id} className="hover:bg-white/[0.02] transition-colors">
                                          <td className="p-3 md:p-6">
                                              <div className="font-bold text-white">{member.name}</div>
                                              <div className="text-[9px] md:text-[10px] text-zinc-500 font-mono tracking-widest uppercase">{member.code}</div>
                                          </td>
                                          <td className="p-3 md:p-6 text-right font-bold text-white">${member.total_sales.toLocaleString()}</td>
                                          <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${member.total_commission_earned.toLocaleString()}</td>
                                          <td className="p-3 md:p-6 text-right font-black text-neon-blue">${(member.total_sales - member.total_commission_earned).toLocaleString()}</td>
                                          <td className="p-3 md:p-6 text-center">
                                              <button onClick={() => setViewingStaffId(member.user_id)} className="p-2 bg-white/5 rounded-lg md:rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                                                  <Eye size={14} className="md:w-4 md:h-4"/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                                  {(!myTeam || myTeam.members_ids.length === 0) && (
                                      <tr>
                                          <td colSpan={5} className="p-12 text-center text-zinc-600 italic">No tienes integrantes en tu equipo todavía.</td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>

              <div className="space-y-6 md:space-y-8">
                   <PromoterRanking promoters={promoters.filter(p => (myTeam?.members_ids.includes(p.user_id) || p.user_id === currentUser.user_id))} title="Top Squad Members" />
                   
                   <div className="bg-zinc-900 border border-white/5 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden">
                       <div className="absolute -right-4 -bottom-4 opacity-5 text-neon-blue rotate-12"><ShieldCheck size={100}/></div>
                       <h4 className="text-base md:text-lg font-black text-white mb-4">Manual de Manager</h4>
                       <ul className="text-[10px] md:text-xs text-zinc-500 space-y-3 font-bold">
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> Como líder, eres responsable de la liquidación de tu equipo ante la dirección.</li>
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> El sistema atribuye ventas automáticas si el cliente usa el link de tus reclutas.</li>
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> Las ventas directas midnight tienen $0 comisión.</li>
                       </ul>
                   </div>
              </div>
          </div>
      )}
      
      {/* ... (rest of Dashboard.tsx) ... */}
    </div>
  );
};