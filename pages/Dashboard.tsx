import React, { useState, useMemo } from 'react';
import { UserRole, Promoter, SalesTeam, Order } from '../types';
import { Button } from '../components/ui/button';
import { Banknote, Award, Target, History, Users, Plus, X, Layers, UserPlus, TrendingUp, Sparkles, ChevronRight, Trash2, ShieldCheck, PieChart, Eye, Calendar, Ticket, ArrowRightLeft, ScrollText, Wallet, Link as LinkIcon, Copy, Share2, Check, Smartphone, User, Search, Filter, Loader2, Download, BarChart, AlertTriangle, CreditCard, Mail, Globe, MessageCircle, ChevronDown, ChevronUp, Laptop, Coins, UserCheck } from 'lucide-react';
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
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>(''); 
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

  // Recruitment State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState(''); 
  const [selectedRecruitmentTeamId, setSelectedRecruitmentTeamId] = useState<string>('');
  const [recruitmentMode, setRecruitmentMode] = useState<'create' | 'link'>('create');
  const [selectedStaffIdToLink, setSelectedStaffIdToLink] = useState<string>('');

  // Detailed View State
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  if (!currentUser) return null;

  // PERMISOS
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isHead = currentUser.role === UserRole.HEAD_OF_SALES || isAdmin;
  const isManager = currentUser.role === UserRole.MANAGER || isHead; 
  
  const myTeam = teams.find(t => t.manager_id === currentUser.user_id); 
  
  // Staff disponible para vincular (sin equipo asignado)
  const availableStaffToLink = promoters.filter(p => !p.sales_team_id && p.role !== UserRole.ADMIN);

  // Initialize recruitment team selection when modal opens
  const openRecruitmentModal = () => {
      if (myTeam) {
          setSelectedRecruitmentTeamId(myTeam.id);
      } else {
          setSelectedRecruitmentTeamId('');
      }
      setRecruitmentMode('create');
      setSelectedStaffIdToLink('');
      setShowRecruitmentModal(true);
  };

  // --- GENERADOR DE LINK INTELIGENTE ---
  const referralLink = `https://midnightcorp.click/?ref=${currentUser.code}`;
  
  const handleCopyLink = () => {
      navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareWhatsapp = () => {
      const text = `¡Hola! Aquí tienes mi link oficial para los eventos de Midnight. Compra tus tickets seguros aquí: ${referralLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- EXPORTAR LIQUIDACIÓN CSV ---
  const handleExportLiquidation = (data: any[], totals: any) => {
      if (!selectedEventFilter) return alert("Selecciona un evento primero.");
      const eventName = events.find(e => e.id === selectedEventFilter)?.title || 'Evento';
      
      let csvContent = "data:text/csv;charset=utf-8,";
      // Headers
      csvContent += "Squad,Manager,Ventas Digital($),Ventas Efectivo($),Recaudo Efectivo,Comision Total,A Liquidar (Neto)\n";
      
      data.forEach(row => {
          csvContent += `${row.name},${row.manager_name || 'N/A'},${row.digitalGross},${row.cashGross},${row.cashGross},${row.commission},${row.net}\n`;
      });
      
      // Footer Row
      if(totals) {
         csvContent += `TOTALES,,${totals.digitalGross},${totals.cashGross},${totals.cashGross},${totals.totalCommission},${totals.netLiquidation}\n`; 
      }

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

      // Helper para calcular métricas corregidas: Cash vs Digital
      const calculateMetrics = (subsetOrders: Order[], forceNoCommission = false) => {
          const digitalOrders = subsetOrders.filter(o => o.payment_method !== 'cash');
          const cashOrders = subsetOrders.filter(o => o.payment_method === 'cash');

          const digitalQty = digitalOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
          const digitalGross = digitalOrders.reduce((acc, o) => acc + o.total, 0);

          const cashQty = cashOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
          const cashGross = cashOrders.reduce((acc, o) => acc + o.total, 0);

          const totalSales = digitalGross + cashGross;
          const totalQty = digitalQty + cashQty;
          
          // CRITICAL FIX: If forceNoCommission (Admin/System) is true, commission is 0.
          const totalCommission = forceNoCommission ? 0 : subsetOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          
          // LIQUIDACIÓN REAL: Efectivo Recaudado - Comisiones Totales
          const netLiquidation = cashGross - totalCommission;
          
          return { 
              digitalQty, digitalGross, 
              cashQty, cashGross, 
              totalSales, totalQty, 
              totalCommission, netLiquidation 
          };
      };

      // 1. Procesar Squads Reales
      const teamStats = teams.map(team => {
          const memberIds = [team.manager_id, ...team.members_ids];
          const teamOrders = filteredOrders.filter(o => o.staff_id && memberIds.includes(o.staff_id));
          
          const metrics = calculateMetrics(teamOrders);
          const breakdown = calculateBreakdown(teamOrders);
          
          const members = promoters.filter(p => memberIds.includes(p.user_id)).map(p => {
              const staffOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
              const mMetrics = calculateMetrics(staffOrders);
              return {
                  ...p,
                  ...mMetrics, // Spread metrics (digitalGross, cashGross, netLiquidation, etc)
                  commission: mMetrics.totalCommission,
                  net: mMetrics.netLiquidation,
                  breakdown: calculateBreakdown(staffOrders),
                  orders: staffOrders
              };
          });

          return {
              id: team.id,
              name: team.name,
              manager_name: promoters.find(p => p.user_id === team.manager_id)?.name,
              isVirtual: false,
              ...metrics, // Spread metrics
              commission: metrics.totalCommission,
              net: metrics.netLiquidation,
              ordersCount: metrics.totalQty,
              breakdown,
              members
          };
      });

      // Identify Managers to exclude from Independents
      const teamManagerIds = teams.map(t => t.manager_id).filter(id => id);

      // 2. Procesar Promotores Independientes
      // FIX: Exclude managers from independent list
      const independentPromoters = promoters.filter(p => 
        !p.sales_team_id && 
        p.role !== UserRole.ADMIN &&
        !teamManagerIds.includes(p.user_id)
      );
      
      if (independentPromoters.length > 0) {
          const indepOrders = filteredOrders.filter(o => o.staff_id && independentPromoters.some(p => p.user_id === o.staff_id));
          const metrics = calculateMetrics(indepOrders);
          const breakdown = calculateBreakdown(indepOrders);

          const members = independentPromoters.map(p => {
              const staffOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
              const mMetrics = calculateMetrics(staffOrders);
              return {
                  ...p,
                  ...mMetrics,
                  commission: mMetrics.totalCommission,
                  net: mMetrics.netLiquidation,
                  breakdown: calculateBreakdown(staffOrders),
                  orders: staffOrders
              };
          }).filter(m => m.totalSales > 0 || m.role === UserRole.PROMOTER);

          teamStats.push({
              id: 'virtual_independent',
              name: 'SIN SQUAD / INDEPENDIENTES',
              manager_name: 'Gestión Directa',
              isVirtual: true,
              ...metrics,
              commission: metrics.totalCommission,
              net: metrics.netLiquidation,
              ordersCount: metrics.totalQty,
              breakdown,
              members
          });
      }

      // 3. Procesar Orgánico + Admin
      const adminPromoters = promoters.filter(p => p.role === UserRole.ADMIN);
      const adminIds = adminPromoters.map(p => p.user_id);
      if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

      const organicOrders = filteredOrders.filter(o => !o.staff_id || adminIds.includes(o.staff_id));

      if (organicOrders.length > 0) {
          // CRITICAL: Force No Commission for Organic/Admin group
          const metrics = calculateMetrics(organicOrders, true);
          const breakdown = calculateBreakdown(organicOrders);

          const organicMembers: any[] = []; 

          // Web Direct
          const webOrders = organicOrders.filter(o => !o.staff_id);
          if (webOrders.length > 0 || organicOrders.length > 0) {
               if(webOrders.length > 0) {
                   const wMetrics = calculateMetrics(webOrders, true); // Force 0 Commission
                   organicMembers.push({
                      user_id: 'web_direct',
                      name: 'Venta Web / Directa',
                      email: 'system@midnightcorp.click', 
                      code: 'SYSTEM',
                      role: UserRole.ADMIN, 
                      ...wMetrics,
                      commission: wMetrics.totalCommission,
                      net: wMetrics.netLiquidation,
                      breakdown: calculateBreakdown(webOrders),
                      orders: webOrders
                   });
               }
          }

          // Admins
          adminPromoters.forEach(admin => {
              const aOrders = organicOrders.filter(o => o.staff_id === admin.user_id);
              if (aOrders.length > 0) {
                  const aMetrics = calculateMetrics(aOrders, true); // Force 0 Commission
                  organicMembers.push({
                      ...admin,
                      ...aMetrics,
                      commission: aMetrics.totalCommission,
                      net: aMetrics.netLiquidation,
                      breakdown: calculateBreakdown(aOrders),
                      orders: aOrders
                  });
              }
          });

          teamStats.unshift({
              id: 'virtual_organic',
              name: 'ORGANICO / MIDNIGHT',
              manager_name: 'Sistema Central',
              isVirtual: true,
              ...metrics,
              commission: metrics.totalCommission, // Will be 0
              net: metrics.netLiquidation, // Will equal cashGross
              ordersCount: metrics.totalQty,
              breakdown,
              members: organicMembers
          });
      }

      // --- CALCULAR TOTALES GLOBALES ---
      const grandTotals = teamStats.reduce((acc, team) => ({
          digitalQty: acc.digitalQty + team.digitalQty,
          digitalGross: acc.digitalGross + team.digitalGross,
          cashQty: acc.cashQty + team.cashQty,
          cashGross: acc.cashGross + team.cashGross,
          totalCommission: acc.totalCommission + team.commission,
          netLiquidation: acc.netLiquidation + team.net
      }), { digitalQty: 0, digitalGross: 0, cashQty: 0, cashGross: 0, totalCommission: 0, netLiquidation: 0 });

      return { allTeams: teamStats, stages, grandTotals };
  }, [orders, teams, promoters, isHead, selectedEventFilter, tiers]);

  // --- LOGICA RANKING GENERAL ---
  const generalRankingData = useMemo(() => {
      let filteredOrders = orders;
      if (rankingFilterEvent !== 'all') {
          filteredOrders = filteredOrders.filter(o => o.event_id === rankingFilterEvent);
      }
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
              orders: myOrders
          };
      }).filter(p => p.ticketsSold > 0).sort((a,b) => b.ticketsSold - a.ticketsSold); 

      return stats;
  }, [orders, promoters, rankingFilterEvent, rankingDateStart, rankingDateEnd]);


  // --- CÁLCULO DE MÉTRICAS (KPIs) - SIEMPRE SINCRONIZADO CON TABLA ---
  const { kpiSales, kpiCommissions, kpiNetToSend, scopeLabel } = useMemo(() => {
    let scopeOrders: typeof orders = [];
    let label = "";

    // 1. SI ESTAMOS EN MODO LIQUIDACIÓN DE EVENTO (ADMIN/HEAD + EVENTO SELECCIONADO)
    // Usamos directamente los totales de la tabla para garantizar consistencia 100%
    if (isHead && selectedEventFilter && globalLiquidationData) {
        const t = globalLiquidationData.grandTotals;
        return {
            kpiSales: t.digitalGross + t.cashGross,
            kpiCommissions: t.totalCommission,
            kpiNetToSend: t.netLiquidation,
            scopeLabel: `Liquidación: ${events.find(e => e.id === selectedEventFilter)?.title}`
        };
    }

    // 2. CÁLCULO GENERAL (SIN FILTRO DE EVENTO O PARA OTROS ROLES)
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
    
    // Identify Admins to exclude from commission sum (SAME LOGIC AS TABLE)
    const adminIds = promoters.filter(p => p.role === UserRole.ADMIN).map(p => p.user_id);
    if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    const commissions = scopeOrders.reduce((acc, o) => {
        // If order belongs to an Admin or has no staff (organic), commission is 0 for KPI
        if (!o.staff_id || adminIds.includes(o.staff_id)) {
            return acc;
        }
        return acc + o.commission_amount;
    }, 0);
    
    const cashSales = scopeOrders.filter(o => o.payment_method === 'cash').reduce((acc, o) => acc + o.total, 0);
    const netToSend = cashSales - commissions;

    return { kpiSales: sales, kpiCommissions: commissions, kpiNetToSend: netToSend, scopeLabel: label };
  }, [orders, currentUser, teams, isHead, isManager, myTeam, promoters, selectedEventFilter, globalLiquidationData]);

  const updateCart = (tierId: string, qty: number) => {
      if (qty === 0) {
          setCart(prev => prev.filter(c => c.tierId !== tierId));
      } else {
          setCart(prev => {
              const existing = prev.find(c => c.tierId === tierId);
              if (existing) {
                  return prev.map(c => c.tierId === tierId ? { ...c, quantity: qty } : c);
              } else {
                  return [...prev, { tierId, quantity: qty }];
              }
          });
      }
  };

  const handleManualSale = async () => {
    if (!selectedEventId || cart.length === 0) return;
    if (!manualCustomerInfo.name) return alert("Nombre del cliente obligatorio.");
    
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
    // Email is optional for manual cash sales, StoreContext handles fallback
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

  const handleLinkExistingStaff = async () => {
      if (!selectedStaffIdToLink) return alert("Selecciona un promotor disponible.");
      if (!selectedRecruitmentTeamId) return alert("Selecciona un Squad de destino.");

      const staff = promoters.find(p => p.user_id === selectedStaffIdToLink);
      const team = teams.find(t => t.id === selectedRecruitmentTeamId);

      if (!staff || !team) return;

      try {
          // Update staff team
          await useStore().updateStaffTeam(staff.user_id, team.id);
          
          alert(`¡${staff.name} ha sido vinculado al Squad ${team.name}!`);
          setSelectedStaffIdToLink(''); setShowRecruitmentModal(false);
      } catch (error: any) {
          console.error("Error linking staff:", error);
          alert("Error al vincular promotor.");
      }
  };

  const handleManagerRecruit = async () => {
      if (!newStaffName || !newStaffCode || !newStaffPassword) {
          return alert("Por favor completa todos los campos.");
      }

      // Determine target team and manager
      let targetTeamId = selectedRecruitmentTeamId || null;
      let targetManagerId = null;

      if (targetTeamId) {
          const team = teams.find(t => t.id === targetTeamId);
          if (team) {
              targetManagerId = team.manager_id;
          }
      } else {
          // If independent, no manager assigned (or could be the recruiter if desired, but usually null for true independent)
          targetManagerId = null;
      }

      try {
          await addStaff({ 
              name: newStaffName, 
              code: newStaffCode.toUpperCase(), 
              password: newStaffPassword, 
              role: UserRole.PROMOTER, 
              sales_team_id: targetTeamId, 
              manager_id: targetManagerId 
          });
          
          const teamName = targetTeamId ? teams.find(t => t.id === targetTeamId)?.name : "Independiente";
          alert(`¡${newStaffName} ha sido registrado exitosamente!\nAsignado a: ${teamName}`);
          setNewStaffName(''); setNewStaffCode(''); setNewStaffPassword(''); setShowRecruitmentModal(false);
      } catch (error: any) {
          console.error("Error recruiting:", error);
          alert("Error al registrar promotor. Intenta nuevamente.");
      }
  };

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
                <Button onClick={openRecruitmentModal} className="bg-white text-black font-black h-10 md:h-12 px-4 md:px-6 rounded-lg md:rounded-xl border-none text-xs md:text-sm flex-1 md:flex-none">
                    <UserPlus className="mr-2 w-3 h-3 md:w-4 md:h-4" /> RECLUTAR
                </Button>
            )}
            <Button onClick={() => setShowManualSale(true)} className="bg-neon-blue text-black font-black h-10 md:h-12 px-4 md:px-6 rounded-lg md:rounded-xl border-none text-xs md:text-sm flex-1 md:flex-none">
                <Banknote className="mr-2 w-3 h-3 md:w-4 md:h-4" /> VENTA MANUAL
            </Button>
        </div>
      </div>

      {/* --- SHARE LINK SECTION (NUEVO) --- */}
      <div className="mb-8 md:mb-12 bg-gradient-to-r from-zinc-900 to-black border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-neon-purple/5 blur-3xl rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
              <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                  <Globe className="text-neon-blue w-6 h-6"/> TU LANDING PAGE
              </h3>
              <p className="text-zinc-500 text-sm mt-1 max-w-lg">
                  Usa este enlace exclusivo. Los clientes verán una página de bienvenida personalizada y las ventas se te atribuirán automáticamente.
              </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="flex items-center bg-black border border-white/10 rounded-xl px-4 py-3 min-w-[200px] md:min-w-[300px]">
                  <p className="text-xs text-zinc-400 font-mono truncate flex-1">{referralLink}</p>
              </div>
              <div className="flex gap-2">
                  <Button onClick={handleCopyLink} className={`font-bold h-12 transition-all ${linkCopied ? 'bg-emerald-500 text-black' : 'bg-white text-black'}`}>
                      {linkCopied ? <Check size={18}/> : <Copy size={18}/>}
                  </Button>
                  <Button onClick={handleShareWhatsapp} className="bg-[#25D366] text-white font-bold h-12 px-4">
                      <MessageCircle size={20} className="mr-2"/> WHATSAPP
                  </Button>
              </div>
          </div>
      </div>

      {/* --- KPI SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1 md:mb-2">Ventas Totales (Global)</p>
            <p className="text-2xl md:text-4xl font-black text-white">${kpiSales.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-neon-blue/20 group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform text-neon-blue"><Wallet size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-neon-blue font-black uppercase tracking-widest mb-1 md:mb-2">A Liquidar (Efectivo - Comis.)</p>
            <p className="text-2xl md:text-4xl font-black text-white">${kpiNetToSend.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-emerald-500/20 group">
            <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:scale-110 transition-transform text-emerald-500"><Award size={40} className="md:w-16 md:h-16"/></div>
            <p className="text-[9px] md:text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1 md:mb-2">Comisiones Ganadas</p>
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
                      <p className="text-xs text-zinc-500 mt-1 font-bold uppercase tracking-widest">Calculada sobre: Efectivo Recaudado - Comisiones Totales.</p>
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
                              <Button onClick={() => handleExportLiquidation(globalLiquidationData.allTeams, globalLiquidationData.grandTotals)} size="sm" variant="outline" className="text-[10px]">
                                  <Download size={14} className="mr-2"/> EXPORTAR
                              </Button>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                      <tr>
                                          <th className="p-3 md:p-6">Squad / Manager</th>
                                          <th className="p-3 md:p-6 text-right text-purple-400">Digital (Qty/$)</th>
                                          <th className="p-3 md:p-6 text-right text-amber-400">Efectivo (Qty/$)</th>
                                          <th className="p-3 md:p-6 text-right text-white">Recaudo Efectivo</th>
                                          <th className="p-3 md:p-6 text-right text-emerald-500">Comis. Total</th>
                                          <th className="p-3 md:p-6 text-right text-neon-blue">A Liquidar (Neto)</th>
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
                                              
                                              {/* Digital Column */}
                                              <td className="p-3 md:p-6 text-right text-purple-400/80">
                                                  <div className="font-bold">{team.digitalQty} und</div>
                                                  <div className="text-[9px]">${team.digitalGross.toLocaleString()}</div>
                                              </td>

                                              {/* Cash Column */}
                                              <td className="p-3 md:p-6 text-right text-amber-400/80">
                                                  <div className="font-bold">{team.cashQty} und</div>
                                                  <div className="text-[9px]">${team.cashGross.toLocaleString()}</div>
                                              </td>
                                              
                                              {/* Cash Held (Same as Cash Gross) */}
                                              <td className="p-3 md:p-6 text-right font-bold text-white border-l border-white/5">${team.cashGross.toLocaleString()}</td>
                                              
                                              <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${team.commission.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-right font-black text-neon-blue text-base border-l border-white/5 bg-white/[0.02]">${team.net.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-center">
                                                  <button onClick={() => { setViewingTeamId(team.id); setExpandedMemberId(null); }} className="p-2 bg-white/5 rounded-lg md:rounded-xl hover:bg-neon-purple/20 text-zinc-500 hover:text-neon-purple transition-all border border-transparent hover:border-neon-purple/20 flex items-center justify-center mx-auto">
                                                      <Users size={14} className="md:w-4 md:h-4 mr-2"/> Miembros
                                                  </button>
                                              </td>
                                          </tr>
                                      ))}
                                      {/* TOTALS ROW */}
                                      <tr className="bg-white/5 font-black border-t-2 border-white/10">
                                          <td className="p-3 md:p-6 text-white uppercase tracking-widest">TOTALES</td>
                                          <td className="p-3 md:p-6 text-right text-purple-400">
                                              <div>{globalLiquidationData.grandTotals.digitalQty} und</div>
                                              <div className="text-[10px]">${globalLiquidationData.grandTotals.digitalGross.toLocaleString()}</div>
                                          </td>
                                          <td className="p-3 md:p-6 text-right text-amber-400">
                                              <div>{globalLiquidationData.grandTotals.cashQty} und</div>
                                              <div className="text-[10px]">${globalLiquidationData.grandTotals.cashGross.toLocaleString()}</div>
                                          </td>
                                          <td className="p-3 md:p-6 text-right text-white border-l border-white/10">${globalLiquidationData.grandTotals.cashGross.toLocaleString()}</td>
                                          <td className="p-3 md:p-6 text-right text-emerald-500">${globalLiquidationData.grandTotals.totalCommission.toLocaleString()}</td>
                                          <td className="p-3 md:p-6 text-right text-neon-blue text-lg border-l border-white/10">${globalLiquidationData.grandTotals.netLiquidation.toLocaleString()}</td>
                                          <td className="p-3 md:p-6"></td>
                                      </tr>
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* RANKING GENERAL (NUEVO MÓDULO) */}
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

      {/* MODAL VENTA MANUAL */}
      <AnimatePresence>
        {showManualSale && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative overflow-hidden">
                    <button onClick={() => setShowManualSale(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                    
                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <Banknote className="text-neon-blue"/> Venta Manual
                        </h2>
                        <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Registrar venta en efectivo (Taquilla/Física)</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Seleccionar Evento</label>
                            <select 
                                value={selectedEventId} 
                                onChange={e => { setSelectedEventId(e.target.value); setCart([]); }} 
                                className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-blue outline-none"
                            >
                                <option value="">-- Seleccionar --</option>
                                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                            </select>
                        </div>

                        {selectedEventId && (
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-3 block">Tickets Disponibles</label>
                                <div className="space-y-3">
                                    {getEventTiers(selectedEventId).map(tier => {
                                        const inCart = cart.find(c => c.tierId === tier.id)?.quantity || 0;
                                        return (
                                            <div key={tier.id} className="flex justify-between items-center bg-zinc-800/50 p-2 rounded-lg">
                                                <div>
                                                    <p className="text-xs font-bold text-white">{tier.name}</p>
                                                    <p className="text-[10px] text-zinc-500">${tier.price.toLocaleString()}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => updateCart(tier.id, Math.max(0, inCart - 1))} className="w-6 h-6 bg-zinc-700 rounded-full text-white hover:bg-zinc-600 flex items-center justify-center font-bold">-</button>
                                                    <span className="font-bold text-white w-4 text-center text-sm">{inCart}</span>
                                                    <button onClick={() => updateCart(tier.id, inCart + 1)} className="w-6 h-6 bg-zinc-700 rounded-full text-white hover:bg-zinc-600 flex items-center justify-center font-bold">+</button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Cliente (Nombre)</label>
                                <input value={manualCustomerInfo.name} onChange={e => setManualCustomerInfo({...manualCustomerInfo, name: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold" placeholder="Nombre" />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Email (Opcional)</label>
                                <input value={manualCustomerInfo.email} onChange={e => setManualCustomerInfo({...manualCustomerInfo, email: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold" placeholder="Email" />
                            </div>
                        </div>

                        <div className="bg-neon-blue/10 p-4 rounded-xl border border-neon-blue/20 flex justify-between items-center mt-4">
                            <span className="text-neon-blue font-bold uppercase text-xs">Total a Recibir</span>
                            <span className="text-2xl font-black text-white">
                                ${cart.reduce((acc, item) => {
                                     const t = tiers.find(t => t.id === item.tierId);
                                     return acc + ((t?.price || 0) * item.quantity);
                                }, 0).toLocaleString()}
                            </span>
                        </div>

                        <Button onClick={handleManualSale} disabled={isProcessingSale || cart.length === 0 || !selectedEventId} fullWidth className="bg-white text-black font-black h-14 text-sm rounded-xl hover:bg-zinc-200">
                            {isProcessingSale ? <Loader2 className="animate-spin"/> : 'CONFIRMAR VENTA (EFECTIVO)'}
                        </Button>
                    </div>
                </motion.div>
             </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL RECLUTAMIENTO (MANAGER) */}
      <AnimatePresence>
        {showRecruitmentModal && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl relative overflow-hidden">
                    <button onClick={() => setShowRecruitmentModal(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                    
                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-white flex items-center gap-3">
                            <UserPlus className="text-neon-purple"/> Reclutar Staff
                        </h2>
                        <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Gestionar miembros de tu Squad</p>
                    </div>

                    {/* TABS */}
                    <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-white/5">
                        <button 
                            onClick={() => setRecruitmentMode('create')}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${recruitmentMode === 'create' ? 'bg-neon-purple text-white shadow-lg shadow-neon-purple/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            Nuevo Ingreso
                        </button>
                        <button 
                            onClick={() => setRecruitmentMode('link')}
                            className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${recruitmentMode === 'link' ? 'bg-neon-blue text-black shadow-lg shadow-neon-blue/20' : 'text-zinc-500 hover:text-white'}`}
                        >
                            Vincular Existente
                        </button>
                    </div>

                    {recruitmentMode === 'create' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Nombre Completo</label>
                                <input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-purple outline-none" placeholder="Ej: Ana María" />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Código de Acceso (Usuario)</label>
                                <input value={newStaffCode} onChange={e => setNewStaffCode(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-black uppercase tracking-widest text-center focus:border-neon-purple outline-none" placeholder="EJ: ANA2024" />
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Contraseña</label>
                                <input type="text" value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-mono focus:border-neon-purple outline-none" placeholder="1234" />
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Asignar a Squad</label>
                                <select 
                                    value={selectedRecruitmentTeamId} 
                                    onChange={e => setSelectedRecruitmentTeamId(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-purple outline-none appearance-none"
                                >
                                    <option value="">-- Independiente (Sin Squad) --</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 mt-2">
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    <span className="text-neon-purple font-bold">NOTA:</span> {selectedRecruitmentTeamId ? `El promotor será asignado al equipo seleccionado.` : `El promotor quedará como Independiente (sin Manager directo).`}
                                </p>
                            </div>

                            <Button onClick={handleManagerRecruit} disabled={!newStaffName || !newStaffCode || !newStaffPassword} fullWidth className="bg-white text-black font-black h-14 text-sm rounded-xl hover:bg-zinc-200 mt-2">
                                REGISTRAR PROMOTOR
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-neon-blue/10 p-4 rounded-xl border border-neon-blue/20 mb-4">
                                <p className="text-[10px] text-neon-blue font-bold leading-relaxed flex items-center gap-2">
                                    <UserCheck size={14}/> Selecciona un promotor disponible para unirlo a tu equipo.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Promotor Disponible</label>
                                <select 
                                    value={selectedStaffIdToLink} 
                                    onChange={e => setSelectedStaffIdToLink(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-blue outline-none appearance-none"
                                >
                                    <option value="">-- Seleccionar Promotor --</option>
                                    {availableStaffToLink.map(p => (
                                        <option key={p.user_id} value={p.user_id}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                                {availableStaffToLink.length === 0 && <p className="text-[9px] text-red-500 mt-1 font-bold">No hay promotores disponibles.</p>}
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Squad de Destino</label>
                                <select 
                                    value={selectedRecruitmentTeamId} 
                                    onChange={e => setSelectedRecruitmentTeamId(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-blue outline-none appearance-none"
                                >
                                    <option value="">-- Seleccionar Squad --</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>

                            <Button onClick={handleLinkExistingStaff} disabled={!selectedStaffIdToLink || !selectedRecruitmentTeamId} fullWidth className="bg-neon-blue text-black font-black h-14 text-sm rounded-xl hover:bg-neon-blue/80 mt-2">
                                VINCULAR AL EQUIPO
                            </Button>
                        </div>
                    )}
                </motion.div>
             </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL AUDITORIA EQUIPO */}
      <AnimatePresence>
        {viewingTeamId && globalLiquidationData && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-6xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                   <button onClick={() => { setViewingTeamId(null); setExpandedMemberId(null); }} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                   
                   {(() => {
                       const team = globalLiquidationData.allTeams.find(t => t.id === viewingTeamId);
                       if (!team) return null;
                       
                       return (
                           <>
                               <div className="mb-8">
                                   <h2 className="text-2xl font-black text-white flex items-center gap-3">
                                       <Users className="text-neon-purple"/> {team.name}
                                   </h2>
                                   <p className="text-zinc-500 font-bold uppercase text-xs mt-1">Desglose por Miembro - {events.find(e => e.id === selectedEventFilter)?.title}</p>
                                   <p className="text-emerald-500 text-[10px] font-bold mt-2 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full inline-block border border-emerald-500/20">
                                       Click en un miembro para ver detalle de clientes
                                   </p>
                               </div>

                               <div className="overflow-x-auto">
                                   <table className="w-full text-left">
                                       <thead className="bg-white/5 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                           <tr>
                                               <th className="p-4">Miembro</th>
                                               <th className="p-4 text-right text-purple-400">Digital</th>
                                               <th className="p-4 text-right text-amber-400">Efectivo</th>
                                               <th className="p-4 text-right">Recaudo Total (Efect.)</th>
                                               <th className="p-4 text-right text-emerald-500">Comis. Total</th>
                                               <th className="p-4 text-right text-neon-blue">A Liquidar</th>
                                               <th className="p-4 w-10"></th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                                           {team.members.map((member: any) => (
                                               <React.Fragment key={member.user_id}>
                                                   <tr 
                                                       className={`hover:bg-white/[0.05] cursor-pointer transition-colors ${expandedMemberId === member.user_id ? 'bg-white/[0.05]' : ''}`}
                                                       onClick={() => setExpandedMemberId(expandedMemberId === member.user_id ? null : member.user_id)}
                                                    >
                                                       <td className="p-4">
                                                           <div className="font-bold text-white flex items-center gap-2">
                                                               {member.name}
                                                               {member.orders.length > 0 && <span className="bg-zinc-800 text-[9px] text-zinc-400 px-1.5 py-0.5 rounded-full">{member.orders.length}</span>}
                                                           </div>
                                                           <div className="text-[9px] text-zinc-500">{member.role}</div>
                                                       </td>
                                                       
                                                       {/* Digital Breakdown */}
                                                       <td className="p-4 text-right text-purple-400/80">
                                                           <div className="font-bold">{member.digitalQty} und</div>
                                                           <div className="text-[9px]">${member.digitalGross.toLocaleString()}</div>
                                                       </td>

                                                       {/* Cash Breakdown */}
                                                       <td className="p-4 text-right text-amber-400/80">
                                                           <div className="font-bold">{member.cashQty} und</div>
                                                           <div className="text-[9px]">${member.cashGross.toLocaleString()}</div>
                                                       </td>

                                                       <td className="p-4 text-right font-bold text-white border-l border-white/5">${member.cashGross.toLocaleString()}</td>
                                                       <td className="p-4 text-right font-bold text-emerald-500">${member.commission.toLocaleString()}</td>
                                                       <td className="p-4 text-right font-black text-neon-blue bg-white/[0.02]">${member.net.toLocaleString()}</td>
                                                       <td className="p-4 text-center">
                                                           {expandedMemberId === member.user_id ? <ChevronUp size={16} className="text-zinc-500"/> : <ChevronDown size={16} className="text-zinc-500"/>}
                                                       </td>
                                                   </tr>
                                                   {/* EXPANDED ROW: DETALLE DE VENTAS */}
                                                   {expandedMemberId === member.user_id && (
                                                       <tr className="bg-black/40 animate-in fade-in duration-300">
                                                           <td colSpan={10} className="p-4 md:p-6 border-y border-white/5 shadow-inner">
                                                               <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden">
                                                                   <div className="bg-zinc-800/50 p-3 border-b border-white/5 flex items-center gap-2">
                                                                       <ScrollText size={14} className="text-neon-purple"/>
                                                                       <span className="text-xs font-black text-white uppercase tracking-widest">Registro de Ventas ({member.name})</span>
                                                                   </div>
                                                                   <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                                       {member.orders && member.orders.length > 0 ? (
                                                                            <table className="w-full text-left text-[10px] md:text-xs">
                                                                                <thead className="bg-black/20 text-zinc-500 uppercase font-bold sticky top-0 backdrop-blur-sm">
                                                                                    <tr>
                                                                                        <th className="p-3">Fecha</th>
                                                                                        <th className="p-3">Cliente</th>
                                                                                        <th className="p-3">Items (Etapa)</th>
                                                                                        <th className="p-3 text-right">Método</th>
                                                                                        <th className="p-3 text-right">Total</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-white/5 text-zinc-300">
                                                                                    {member.orders.map((o: any) => (
                                                                                        <tr key={o.id} className="hover:bg-white/5">
                                                                                            <td className="p-3 text-zinc-500">{new Date(o.timestamp).toLocaleDateString()} {new Date(o.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                                                                                            <td className="p-3 font-bold text-white">{o.customer_name}</td>
                                                                                            <td className="p-3">
                                                                                                <div className="flex flex-col gap-1">
                                                                                                    {o.items.map((i:any, idx:number) => (
                                                                                                        <div key={idx} className="flex items-center gap-2">
                                                                                                            <span className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] text-zinc-300 font-bold">{i.quantity}x</span>
                                                                                                            <span>{i.tier_name}</span>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="p-3 text-right text-[9px] uppercase font-bold text-zinc-500">
                                                                                                {o.payment_method === 'cash' ? 
                                                                                                    <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Efectivo</span> : 
                                                                                                    <span className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Digital</span>
                                                                                                }
                                                                                            </td>
                                                                                            <td className="p-3 text-right font-mono font-bold text-white">${o.total.toLocaleString()}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                       ) : (
                                                                           <div className="p-8 text-center text-zinc-600 font-bold uppercase text-xs">Sin ventas registradas en este periodo</div>
                                                                       )}
                                                                   </div>
                                                               </div>
                                                           </td>
                                                       </tr>
                                                   )}
                                               </React.Fragment>
                                           ))}
                                       </tbody>
                                   </table>
                               </div>
                           </>
                       );
                   })()}
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
};