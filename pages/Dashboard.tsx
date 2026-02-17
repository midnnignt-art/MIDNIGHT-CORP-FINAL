import React, { useState, useMemo } from 'react';
import { UserRole, Promoter, SalesTeam, Order } from '../types';
import { Button } from '../components/ui/button';
import { Banknote, Award, Target, History, Users, Plus, X, Layers, UserPlus, TrendingUp, Sparkles, ChevronRight, Trash2, ShieldCheck, PieChart, Eye, Calendar, Ticket, ArrowRightLeft, ScrollText, Wallet, Link as LinkIcon, Copy, Share2, Check, Smartphone, User, Search, Filter } from 'lucide-react';
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
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [staffSearch, setStaffSearch] = useState('');

  // Manual Sale State
  const [selectedEventId, setSelectedEventId] = useState('');
  const [cart, setCart] = useState<{tierId: string, quantity: number}[]>([]);
  const [manualCustomerInfo, setManualCustomerInfo] = useState({ name: '', email: '' });

  // Recruitment State (Manager scope)
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState(''); // NEW PASSWORD FIELD

  // Detailed View State
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);

  if (!currentUser) return null;

  // PERMISOS MAESTROS
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isHead = currentUser.role === UserRole.HEAD_OF_SALES || isAdmin;
  const isManager = currentUser.role === UserRole.MANAGER || isHead; 
  
  // --- IDENTIFICAR EL SQUAD DEL MANAGER ---
  const myTeam = teams.find(t => t.manager_id === currentUser.id);

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

  // --- LÓGICA DE LIQUIDACIÓN GLOBAL (ADMIN/HEAD) ---
  const globalLiquidationData = useMemo(() => {
      if (!isHead) return null;

      const filteredOrders = selectedEventFilter === 'all' 
        ? orders 
        : orders.filter(o => o.event_id === selectedEventFilter);

      const teamStats = teams.map(team => {
          const memberIds = [team.manager_id, ...team.members_ids];
          const teamOrders = filteredOrders.filter(o => o.staff_id && memberIds.includes(o.staff_id));
          const gross = teamOrders.reduce((acc, o) => acc + o.total, 0);
          const commission = teamOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          return {
              ...team,
              gross,
              commission,
              net: gross - commission,
              ordersCount: teamOrders.length
          };
      });

      const independentStaff = promoters.filter(p => !p.sales_team_id);
      const independentStats = independentStaff.map(p => {
          const staffOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
          const gross = staffOrders.reduce((acc, o) => acc + o.total, 0);
          const commission = staffOrders.reduce((acc, o) => acc + o.commission_amount, 0);
          return {
              ...p,
              gross,
              commission,
              net: gross - commission
          };
      }).filter(s => s.gross > 0 || s.role !== 'PROMOTER');

      const organicOrders = filteredOrders.filter(o => !o.staff_id);
      const organicGross = organicOrders.reduce((acc, o) => acc + o.total, 0);

      return { teamStats, independentStats, organicGross, organicOrdersCount: organicOrders.length };
  }, [orders, teams, promoters, isHead, selectedEventFilter]);

  // --- DATOS PARA AUDITORÍA DE EQUIPO ---
  const teamAuditDetails = useMemo(() => {
      if (!viewingTeamId) return null;
      const team = teams.find(t => t.id === viewingTeamId);
      if (!team) return null;

      const memberIds = [team.manager_id, ...team.members_ids];
      const teamOrders = orders.filter(o => {
          const isTeamMember = o.staff_id && memberIds.includes(o.staff_id);
          const isEventMatch = selectedEventFilter === 'all' || o.event_id === selectedEventFilter;
          return isTeamMember && isEventMatch;
      }).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return { team, orders: teamOrders };
  }, [viewingTeamId, teams, orders, selectedEventFilter]);

  // --- CÁLCULO DE MÉTRICAS (KPIs) POR ROL ---
  const { kpiSales, kpiCommissions, kpiNetToSend, scopeLabel } = useMemo(() => {
    let scopeOrders: typeof orders = [];
    let label = "";

    if (isHead) {
        scopeOrders = orders;
        label = "Global (Red Completa)";
    } else if (isManager) {
        const teamMemberIds = myTeam ? [currentUser.id, ...myTeam.members_ids] : [currentUser.id];
        scopeOrders = orders.filter(o => o.staff_id && teamMemberIds.includes(o.staff_id));
        label = myTeam ? `Squad: ${myTeam.name}` : "Vista Manager";
    } else {
        scopeOrders = orders.filter(o => o.staff_id === currentUser.id);
        label = "Rendimiento Personal";
    }

    const sales = scopeOrders.reduce((acc, o) => acc + o.total, 0);
    const commissions = scopeOrders.reduce((acc, o) => acc + o.commission_amount, 0);
    const netToSend = sales - commissions;

    return { kpiSales: sales, kpiCommissions: commissions, kpiNetToSend: netToSend, scopeLabel: label };
  }, [orders, currentUser, teams, isHead, isManager, myTeam]);

  const handleManualSale = () => {
    if (!selectedEventId || cart.length === 0) return;
    if (!manualCustomerInfo.name || !manualCustomerInfo.email) return alert("Faltan datos.");
    
    // CORRECCIÓN: Hidratar el carrito con datos completos del tier (precio, nombre, subtotal)
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

    createOrder(selectedEventId, fullCartItems, 'cash', currentUser.id, manualCustomerInfo);
    setCart([]); setManualCustomerInfo({ name: '', email: '' });
    setShowManualSale(false); setSelectedEventId('');
  };

  const handleManagerRecruit = () => {
      if (!newStaffName || !newStaffCode || !newStaffPassword || !myTeam) return;
      addStaff({ 
          name: newStaffName, 
          code: newStaffCode.toUpperCase(), 
          password: newStaffPassword, // ENVÍO DE CONTRASEÑA
          role: UserRole.PROMOTER, // 'PROMOTER'
          sales_team_id: myTeam.id, 
          manager_id: currentUser.id 
      });
      setNewStaffName(''); setNewStaffCode(''); setNewStaffPassword(''); setShowRecruitmentModal(false);
  };

  const staffDetails = useMemo(() => {
      if (!viewingStaffId) return { name: '', sales: [] };
      const promoter = promoters.find(p => p.user_id === viewingStaffId);
      const staffOrders = orders.filter(o => o.staff_id === viewingStaffId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return { name: promoter?.name || 'Desconocido', sales: staffOrders };
  }, [viewingStaffId, promoters, orders]);

  return (
    <div className="min-h-screen pt-24 px-4 max-w-7xl mx-auto pb-20">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter">
            {isAdmin ? 'MIDNIGHT COMMAND' : isHead ? 'CENTRAL DE VENTAS' : isManager ? 'MI SQUAD' : 'PORTAL STAFF'}
          </h1>
          <div className="flex items-center gap-3 mt-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isAdmin ? 'bg-neon-purple' : 'bg-emerald-500'}`}></span>
              <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">
                {currentUser.name} • {currentUser.role} • <span className="text-white">{scopeLabel}</span>
              </p>
          </div>
        </div>
        <div className="flex gap-3">
            {isManager && (
                <Button onClick={() => setShowRecruitmentModal(true)} className="bg-white text-black font-black h-12 px-6 rounded-xl border-none">
                    <UserPlus className="mr-2 w-4 h-4" /> RECLUTAR
                </Button>
            )}
            <Button onClick={() => setShowManualSale(true)} className="bg-neon-blue text-black font-black h-12 px-6 rounded-xl border-none">
                <Banknote className="mr-2 w-4 h-4" /> VENTA MANUAL
            </Button>
        </div>
      </div>

      {/* --- KPI SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={60}/></div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Ventas Brutas</p>
            <p className="text-4xl font-black text-white">${kpiSales.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] border-neon-blue/20 group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform text-neon-blue"><Wallet size={60}/></div>
            <p className="text-[10px] text-neon-blue font-black uppercase tracking-widest mb-2">Neto a Liquidar</p>
            <p className="text-4xl font-black text-white">${kpiNetToSend.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2rem] border-emerald-500/20 group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform text-emerald-500"><Award size={60}/></div>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-2">Comisiones Totales</p>
            <p className="text-4xl font-black text-white">${kpiCommissions.toLocaleString()}</p>
        </div>
      </div>

      {/* --- PANEL MAESTRO DE LIQUIDACIÓN (ADMIN / HEAD OF SALES) --- */}
      {isHead && globalLiquidationData && (
          <div className="space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-zinc-900/30 p-8 rounded-[2.5rem] border border-white/5">
                  <div className="flex-1">
                      <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-neon-purple" /> Liquidación Maestra de Red
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1 font-bold uppercase tracking-widest">Trazabilidad total de ingresos y comisiones por equipo.</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"/>
                          <select 
                            value={selectedEventFilter} 
                            onChange={e => setSelectedEventFilter(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 h-12 text-xs font-black text-white uppercase appearance-none"
                          >
                              <option value="all">TODOS LOS EVENTOS</option>
                              {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                          </select>
                      </div>
                      <div className="relative flex-1 md:w-64">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4"/>
                          <input 
                            value={staffSearch} 
                            onChange={e => setStaffSearch(e.target.value)}
                            placeholder="Buscar Squad / Staff..." 
                            className="w-full bg-black border border-white/10 rounded-xl pl-10 pr-4 h-12 text-xs text-white"
                          />
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                  {/* TABLA DE SQUADS */}
                  <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                      <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Liquidación de Squads (Equipos)</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-black/40 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                  <tr>
                                      <th className="p-6">Squad / Manager</th>
                                      <th className="p-6">Personal</th>
                                      <th className="p-6 text-right">Recaudo Bruto</th>
                                      <th className="p-6 text-right text-emerald-500">Comisión</th>
                                      <th className="p-6 text-right text-neon-blue">Neto Liquidable</th>
                                      <th className="p-6 text-center">Auditoría</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                  {globalLiquidationData.teamStats
                                    .filter(t => t.name.toLowerCase().includes(staffSearch.toLowerCase()))
                                    .map(team => (
                                      <tr key={team.id} className="hover:bg-white/[0.02] transition-colors group">
                                          <td className="p-6">
                                              <div className="font-black text-white text-base">{team.name}</div>
                                              <div className="text-[10px] text-zinc-500 uppercase font-bold mt-1">Manager: {promoters.find(p => p.user_id === team.manager_id)?.name}</div>
                                          </td>
                                          <td className="p-6">
                                              <span className="bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-zinc-400 border border-white/5">
                                                  {team.members_ids.length + 1} MIEMBROS
                                              </span>
                                          </td>
                                          <td className="p-6 text-right font-bold text-white">${team.gross.toLocaleString()}</td>
                                          <td className="p-6 text-right font-bold text-emerald-500">${team.commission.toLocaleString()}</td>
                                          <td className="p-6 text-right font-black text-neon-blue">${team.net.toLocaleString()}</td>
                                          <td className="p-6 text-center">
                                              <button onClick={() => setViewingTeamId(team.id)} className="p-2 bg-white/5 rounded-xl hover:bg-neon-purple/20 text-zinc-500 hover:text-neon-purple transition-all border border-transparent hover:border-neon-purple/20">
                                                  <ArrowRightLeft size={16}/>
                                              </button>
                                          </td>
                                      </tr>
                                  ))}

                                  {/* FILA DE VENTA DIRECTA (ORÁNICA) */}
                                  <tr className="bg-neon-purple/5 border-l-4 border-neon-purple">
                                      <td className="p-6">
                                          <div className="font-black text-neon-purple text-base">VENTA DIRECTA MIDNIGHT</div>
                                          <div className="text-[10px] text-zinc-500 uppercase font-bold mt-1">Ventas Orgánicas (Web/Referido 0)</div>
                                      </td>
                                      <td className="p-6">
                                          <span className="text-[10px] font-black text-zinc-600 uppercase">Sin Atribución</span>
                                      </td>
                                      <td className="p-6 text-right font-black text-white">${globalLiquidationData.organicGross.toLocaleString()}</td>
                                      <td className="p-6 text-right font-bold text-zinc-600">$0</td>
                                      <td className="p-6 text-right font-black text-emerald-400">${globalLiquidationData.organicGross.toLocaleString()}</td>
                                      <td className="p-6 text-center">
                                          <span className="text-[10px] font-black text-emerald-500 uppercase">100% Utilidad</span>
                                      </td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* TABLA DE INDEPENDIENTES */}
                  <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
                      <div className="p-8 border-b border-white/5 bg-white/[0.02]">
                          <h3 className="text-lg font-black text-white uppercase tracking-tighter">Promotores Independientes</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-black/40 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                  <tr>
                                      <th className="p-6">Nombre / Código</th>
                                      <th className="p-6 text-right">Venta Bruta</th>
                                      <th className="p-6 text-right text-emerald-500">Comisión</th>
                                      <th className="p-6 text-right text-neon-blue">A Pagar</th>
                                      <th className="p-6 text-center">Detalle</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                  {globalLiquidationData.independentStats
                                    .filter(p => p.name.toLowerCase().includes(staffSearch.toLowerCase()) || p.code.toLowerCase().includes(staffSearch.toLowerCase()))
                                    .map(p => (
                                      <tr key={p.user_id} className="hover:bg-white/[0.02] transition-colors">
                                          <td className="p-6">
                                              <div className="font-bold text-white">{p.name}</div>
                                              <div className="text-[10px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">{p.code}</div>
                                          </td>
                                          <td className="p-6 text-right font-bold text-white">${p.gross.toLocaleString()}</td>
                                          <td className="p-6 text-right font-bold text-emerald-500">${p.commission.toLocaleString()}</td>
                                          <td className="p-6 text-right font-black text-neon-blue">${p.net.toLocaleString()}</td>
                                          <td className="p-6 text-center">
                                              <button onClick={() => setViewingStaffId(p.user_id)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 text-zinc-500 hover:text-white transition-all"><Eye size={16}/></button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SECCIÓN MANAGER: MI EQUIPO DIRECTO (VISTA ESTÁNDAR) */}
      {isManager && !isAdmin && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-20">
              <div className="xl:col-span-2 space-y-8">
                  <div className="bg-zinc-900/50 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <div className="p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                          <div>
                              <h3 className="text-xl font-black text-white flex items-center gap-3">
                                  <Users className="text-neon-blue" /> Mi Equipo Directo: {myTeam?.name || 'Manager'}
                              </h3>
                              <p className="text-xs text-zinc-500 mt-1 font-bold">Rendimiento individual de tus reclutas.</p>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-zinc-500 uppercase font-black">Total Miembros</p>
                              <p className="text-2xl font-black text-white">{myTeam?.members_ids.length || 0}</p>
                          </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                          <table className="w-full text-left">
                              <thead className="bg-black/40 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                  <tr>
                                      <th className="p-6">Staff / Código</th>
                                      <th className="p-6 text-right">Venta Bruta</th>
                                      <th className="p-6 text-right text-emerald-500">Comisión</th>
                                      <th className="p-6 text-right text-neon-blue">A Liquidar</th>
                                      <th className="p-6 text-center">Acción</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-sm">
                                  {promoters.filter(p => myTeam?.members_ids.includes(p.user_id)).map(member => (
                                      <tr key={member.user_id} className="hover:bg-white/[0.02] transition-colors">
                                          <td className="p-6">
                                              <div className="font-bold text-white">{member.name}</div>
                                              <div className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">{member.code}</div>
                                          </td>
                                          <td className="p-6 text-right font-bold text-white">${member.total_sales.toLocaleString()}</td>
                                          <td className="p-6 text-right font-bold text-emerald-500">${member.total_commission_earned.toLocaleString()}</td>
                                          <td className="p-6 text-right font-black text-neon-blue">${(member.total_sales - member.total_commission_earned).toLocaleString()}</td>
                                          <td className="p-6 text-center">
                                              <button onClick={() => setViewingStaffId(member.user_id)} className="p-2 bg-white/5 rounded-xl text-zinc-500 hover:text-white hover:bg-white/10 transition-all">
                                                  <Eye size={18}/>
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

              <div className="space-y-8">
                   <PromoterRanking promoters={promoters.filter(p => (myTeam?.members_ids.includes(p.user_id) || p.user_id === currentUser.id))} title="Top Squad Members" />
                   
                   <div className="bg-zinc-900 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden">
                       <div className="absolute -right-4 -bottom-4 opacity-5 text-neon-blue rotate-12"><ShieldCheck size={120}/></div>
                       <h4 className="text-lg font-black text-white mb-4">Manual de Manager</h4>
                       <ul className="text-xs text-zinc-500 space-y-3 font-bold">
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> Como líder, eres responsable de la liquidación de tu equipo ante la dirección.</li>
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> El sistema atribuye ventas automáticas si el cliente usa el link de tus reclutas.</li>
                           <li className="flex gap-2 items-start"><span className="text-neon-blue">•</span> Las ventas directas midnight tienen $0 comisión.</li>
                       </ul>
                   </div>
              </div>
          </div>
      )}

      {/* --- SMART LINK CARD (VISTA PARA TODOS) --- */}
      <div className="bg-gradient-to-r from-zinc-900 to-black border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden mb-12 shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 text-neon-purple pointer-events-none hidden md:block">
              <LinkIcon size={120} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl">
                  <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                      <Sparkles className="text-neon-purple" /> LINK OFICIAL DE VENTA
                  </h3>
                  <div className="flex items-center gap-2 bg-black/60 border border-white/5 p-2 pl-4 rounded-xl mt-4">
                      <code className="text-neon-blue font-mono text-sm flex-1 truncate">{referralLink}</code>
                      <Button onClick={handleCopyLink} size="sm" className={`h-10 px-4 font-bold transition-all ${linkCopied ? 'bg-emerald-500 text-black' : 'bg-white text-black'}`}>
                          {linkCopied ? <Check size={16}/> : <Copy size={16}/>}
                      </Button>
                  </div>
              </div>
              <div className="text-center md:text-right">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">MI CÓDIGO</p>
                  <p className="text-3xl font-black text-white tracking-widest">{currentUser.code}</p>
                  <Button onClick={handleShareWhatsapp} className="bg-[#25D366] text-black font-black h-10 px-6 mt-4 rounded-xl">
                      <Smartphone className="mr-2 w-4 h-4"/> WHATSAPP
                  </Button>
              </div>
          </div>
      </div>

      {/* --- MODALES --- */}

      {/* RECRUITMENT MODAL */}
      <AnimatePresence>
          {showRecruitmentModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-sm shadow-2xl relative">
                      <button onClick={() => setShowRecruitmentModal(false)} className="absolute top-8 right-8 text-zinc-600 hover:text-white"><X size={32}/></button>
                      <div className="text-center mb-8">
                          <div className="w-16 h-16 bg-neon-purple/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-neon-purple/20">
                              <UserPlus className="text-neon-purple" />
                          </div>
                          <h2 className="text-2xl font-black text-white tracking-tight">Nuevo Recluta</h2>
                          <p className="text-zinc-500 text-xs mt-2 uppercase font-bold tracking-widest">Se unirá a tu Squad: {myTeam?.name}</p>
                      </div>
                      <div className="space-y-4">
                          <input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-xl text-white font-bold" placeholder="NOMBRE COMPLETO" />
                          <input value={newStaffCode} onChange={e => setNewStaffCode(e.target.value)} className="w-full bg-black border border-white/5 p-4 rounded-xl text-white font-mono uppercase font-bold" placeholder="CÓDIGO ÚNICO" />
                          <input value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} type="password" className="w-full bg-black border border-white/5 p-4 rounded-xl text-white font-bold" placeholder="ASIGNAR CONTRASEÑA" />
                          <Button onClick={handleManagerRecruit} fullWidth className="bg-white text-black font-black h-16 rounded-2xl mt-4">DAR DE ALTA</Button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* AUDITORÍA DE STAFF INDIVIDUAL */}
      <AnimatePresence>
        {viewingStaffId && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-8 rounded-[3rem] w-full max-w-2xl shadow-2xl relative">
                    <button onClick={() => setViewingStaffId(null)} className="absolute top-8 right-8 text-zinc-600 hover:text-white"><X size={32}/></button>
                    <div className="mb-8">
                        <h2 className="text-3xl font-black text-white flex items-center gap-3"><History className="text-neon-blue" /> Auditoría de Ventas</h2>
                        <p className="text-lg text-zinc-400 mt-2 font-bold">{staffDetails.name}</p>
                    </div>
                    <div className="bg-black/40 rounded-3xl border border-white/5 overflow-hidden max-h-[50vh] overflow-y-auto custom-scrollbar">
                         {staffDetails.sales.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[10px] text-zinc-500 uppercase font-black tracking-widest sticky top-0 backdrop-blur-md">
                                    <tr><th className="p-4">Fecha</th><th className="p-4">Cliente</th><th className="p-4 text-right">Total</th></tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {staffDetails.sales.map(order => (
                                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-zinc-400 whitespace-nowrap">{new Date(order.timestamp).toLocaleDateString()}</td>
                                            <td className="p-4 font-bold text-white">{order.customer_name}</td>
                                            <td className="p-4 text-right font-black text-neon-green">${order.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         ) : (<div className="p-10 text-center text-zinc-500">Sin ventas registradas</div>)}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* AUDITORÍA DE SQUAD (EQUIPO COMPLETO) */}
      <AnimatePresence>
        {teamAuditDetails && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-8 rounded-[3rem] w-full max-w-4xl shadow-2xl relative flex flex-col max-h-[90vh]">
                    <button onClick={() => setViewingTeamId(null)} className="absolute top-8 right-8 text-zinc-600 hover:text-white z-10"><X size={32}/></button>
                    <div className="mb-8 flex-shrink-0">
                        <div className="flex items-center gap-4 mb-2">
                             <div className="w-14 h-14 bg-neon-purple/20 rounded-2xl flex items-center justify-center border border-neon-purple/20">
                                 <Layers className="text-neon-purple w-7 h-7" />
                             </div>
                             <div>
                                 <h2 className="text-3xl font-black text-white tracking-tight">AUDITORÍA SQUAD</h2>
                                 <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{teamAuditDetails.team.name}</p>
                             </div>
                        </div>
                        <div className="flex gap-4 mt-4 text-xs font-bold text-zinc-400">
                             <div className="bg-white/5 px-3 py-1 rounded-lg">Ventas Totales: <span className="text-white">{teamAuditDetails.orders.length}</span></div>
                             <div className="bg-white/5 px-3 py-1 rounded-lg">Filtro: <span className="text-white uppercase">{selectedEventFilter === 'all' ? 'Todos los eventos' : 'Evento Seleccionado'}</span></div>
                        </div>
                    </div>

                    <div className="bg-black/40 rounded-3xl border border-white/5 overflow-hidden flex-1 overflow-y-auto custom-scrollbar">
                         {teamAuditDetails.orders.length > 0 ? (
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-[10px] text-zinc-500 uppercase font-black tracking-widest sticky top-0 backdrop-blur-md z-10">
                                    <tr>
                                        <th className="p-5">Fecha / Factura</th>
                                        <th className="p-5">Vendedor (Staff)</th>
                                        <th className="p-5">Cliente Final</th>
                                        <th className="p-5">Items</th>
                                        <th className="p-5 text-right">Total</th>
                                        <th className="p-5 text-right text-emerald-500">Comisión</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {teamAuditDetails.orders.map(order => {
                                        const seller = promoters.find(p => p.user_id === order.staff_id);
                                        return (
                                            <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-5">
                                                    <div className="font-mono text-xs text-zinc-400">{new Date(order.timestamp).toLocaleDateString()}</div>
                                                    <div className="text-[10px] font-bold text-zinc-600 group-hover:text-neon-blue">{order.order_number}</div>
                                                </td>
                                                <td className="p-5">
                                                    {seller ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white">
                                                                {seller.name.charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-white text-xs">{seller.name}</span>
                                                        </div>
                                                    ) : <span className="text-zinc-600 italic">Desconocido</span>}
                                                </td>
                                                <td className="p-5">
                                                    <div className="font-bold text-white text-xs">{order.customer_name}</div>
                                                    <div className="text-[10px] text-zinc-500 truncate max-w-[120px]">{order.customer_email}</div>
                                                </td>
                                                <td className="p-5">
                                                    <div className="space-y-1">
                                                        {order.items.map((i, idx) => (
                                                            <div key={idx} className="text-[10px] text-zinc-300 flex items-center gap-1">
                                                                <Ticket size={10} className="text-neon-purple"/> {i.quantity}x {i.tier_name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-5 text-right font-black text-white">${order.total.toLocaleString()}</td>
                                                <td className="p-5 text-right font-bold text-emerald-500">+${order.commission_amount.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                         ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                                <Layers size={48} className="mb-4 opacity-20"/>
                                <p className="font-bold text-sm">Este equipo no registra ventas en el periodo seleccionado.</p>
                            </div>
                         )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* COBRO MANUAL */}
      <AnimatePresence>
        {showManualSale && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl relative">
                    <button onClick={() => setShowManualSale(false)} className="absolute top-8 right-8 text-zinc-600 hover:text-white"><X size={32}/></button>
                    <h2 className="text-3xl font-black text-white mb-8 text-center tracking-tighter uppercase">Cobro Manual</h2>
                    <div className="space-y-6">
                        <select value={selectedEventId} onChange={e => {setSelectedEventId(e.target.value); setCart([]);}} className="w-full bg-black border border-white/5 p-4 rounded-2xl text-white font-black text-center h-14 uppercase">
                            <option value="">ELIJA EVENTO</option>
                            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                        </select>
                        {selectedEventId && (
                            <div className="space-y-2">
                                {getEventTiers(selectedEventId).map(t => (
                                    <div key={t.id} onClick={() => setCart(prev => {
                                        const ex = prev.find(i => i.tierId === t.id);
                                        if (ex) return prev.map(i => i.tierId === t.id ? {...i, quantity: i.quantity + 1} : i);
                                        return [...prev, {tierId: t.id, quantity: 1}];
                                    })} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl cursor-pointer hover:bg-neon-blue/20 border border-white/5 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-white">
                                                {cart.find(i => i.tierId === t.id)?.quantity || 0}
                                            </div>
                                            <p className="font-bold text-white uppercase text-sm">{t.name}</p>
                                        </div>
                                        <p className="text-neon-blue font-black">${t.price}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {cart.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-white/5">
                                <input value={manualCustomerInfo.name} onChange={e => setManualCustomerInfo({...manualCustomerInfo, name: e.target.value})} placeholder="NOMBRE CLIENTE" className="w-full bg-black border border-white/10 p-4 rounded-xl text-white text-xs font-bold" />
                                <input value={manualCustomerInfo.email} onChange={e => setManualCustomerInfo({...manualCustomerInfo, email: e.target.value})} placeholder="CORREO" className="w-full bg-black border border-white/10 p-4 rounded-xl text-white text-xs font-bold" />
                                <Button onClick={handleManualSale} fullWidth className="bg-white text-black font-black h-16 text-lg rounded-2xl mt-4">REGISTRAR PAGO (${cart.reduce((a, b) => a + (tiers.find(t => t.id === b.tierId)?.price || 0) * b.quantity, 0)})</Button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};