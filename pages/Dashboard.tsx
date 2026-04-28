import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from '../lib/toast';
import { UserRole, Promoter, SalesTeam, Order } from '../types';
import { Button } from '../components/ui/button';
import { Banknote, Award, Target, History, Users, Plus, X, Layers, UserPlus, TrendingUp, Sparkles, ChevronRight, Trash2, ShieldCheck, PieChart, Eye, Calendar, Ticket, ArrowRightLeft, ScrollText, Wallet, Link as LinkIcon, Copy, Share2, Check, Smartphone, User, Search, Filter, Loader2, Download, BarChart, AlertTriangle, CreditCard, Mail, Globe, MessageCircle, ChevronDown, ChevronUp, Laptop, Coins, UserCheck, QrCode, Send, CheckCircle2, Link2, ImagePlus, ZoomIn, ScanLine } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { supabase } from '../lib/supabase';
import PromoterRanking from '../components/PromoterRanking';
import { motion as _motion, AnimatePresence } from 'framer-motion';
import QRScanner from '../components/QRScanner';

const motion = _motion as any;

// ── IMAGE COMPRESSION (promoter uploads) ──────────────────────────────────────
const compressImage = (file: File, maxPx = 1400, quality = 0.75): Promise<Blob> =>
  new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => resolve(b!), 'image/jpeg', quality);
    };
    img.src = url;
  });

export const Dashboard: React.FC<{ role: UserRole }> = ({ role }) => {
  const { events, promoters, orders, tiers, createOrder, getEventTiers, currentUser, teams, superSquads, promoterPayouts, upsertPromoterPayout, addStaff, validateTicket, fetchData, settlements, addSettlement } = useStore();
  const [showDebtUpload, setShowDebtUpload] = useState<{ eventId: string; eventTitle: string; promoterId: string; dineroAEnviar: number; totalEnviado: number } | null>(null);
  const [debtUploadForm, setDebtUploadForm] = useState({ amount: '', method: 'transfer', notes: '' });
  const [debtImageFile, setDebtImageFile] = useState<File | null>(null);
  const [debtImagePreview, setDebtImagePreview] = useState<string | null>(null);
  const [debtPreviewFull, setDebtPreviewFull] = useState<string | null>(null);
  const [debtUploadLoading, setDebtUploadLoading] = useState(false);
  const [debtUploadProgress, setDebtUploadProgress] = useState('');
  const debtFileRef = useRef<HTMLInputElement>(null);
  const [showManualSale, setShowManualSale] = useState(false);
  const [showRecruitmentModal, setShowRecruitmentModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerEventId, setScannerEventId] = useState<string | undefined>(undefined);
  
  // Link Sharing State
  const [linkCopied, setLinkCopied] = useState(false);

  // Bouncer Links State
  const [bouncerLinks, setBouncerLinks] = useState<{ token: string; label: string; event_id: string; active: boolean; created_at: string }[]>([]);
  const [bouncerLinksLoaded, setBouncerLinksLoaded] = useState(false);
  const [newBouncerLabel, setNewBouncerLabel] = useState('');
  const [newBouncerEventId, setNewBouncerEventId] = useState('');
  const [creatingBouncerLink, setCreatingBouncerLink] = useState(false);
  const [copiedBouncerToken, setCopiedBouncerToken] = useState<string | null>(null);

  // Filters & Tabs
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>(''); 
  const [staffSearch, setStaffSearch] = useState('');

  // Ranking Filters
  const [rankingFilterEvent, setRankingFilterEvent] = useState<string>('all');
  const [rankingDateStart, setRankingDateStart] = useState('');
  const [rankingDateEnd, setRankingDateEnd] = useState('');
  const [orderFilterEvent, setOrderFilterEvent] = useState<string>('all');
  const [showTopCustomers, setShowTopCustomers] = useState(false);
  const [rankingViewMode, setRankingViewMode] = useState<'promoters' | 'teams'>('promoters');

  // Manual Sale State
  const [selectedEventId, setSelectedEventId] = useState('');
  const [cart, setCart] = useState<{tierId: string, quantity: number}[]>([]);
  const [manualCustomerInfo, setManualCustomerInfo] = useState({ name: '', email: '' });
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Recruitment State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffCode, setNewStaffCode] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [selectedRecruitmentTeamId, setSelectedRecruitmentTeamId] = useState<string>('');
  const [recruitmentMode, setRecruitmentMode] = useState<'create' | 'link'>('create');
  const [selectedStaffIdToLink, setSelectedStaffIdToLink] = useState<string>('');

  // Detailed View State
  const [viewingStaffId, setViewingStaffId] = useState<string | null>(null);
  const [viewingTeamId, setViewingTeamId] = useState<string | null>(null);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  // Commission breakdown — editable payout amounts per promoter
  const [editingPayouts, setEditingPayouts] = useState<Record<string, string>>({}); // promoter_id → draft value
  const [savingPayout, setSavingPayout] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.role === UserRole.ADMIN) {
      supabase.from('bouncer_links').select('*').order('created_at', { ascending: false })
        .then(({ data }) => { setBouncerLinks(data || []); setBouncerLinksLoaded(true); });
    }
  }, [currentUser?.role]);

  if (!currentUser) return null;

  // PERMISOS
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isBouncer = currentUser.role === UserRole.BOUNCER || isAdmin;

  // Director global de ventas (HEAD_OF_SALES) o Admin → ve absolutamente todo
  const isGlobalHead = isAdmin || currentUser.role === UserRole.HEAD_OF_SALES;

  // Cabeza de super squad (HEAD) → ve solo su super squad
  const isSuperSquadHead = currentUser.role === UserRole.HEAD;

  // Super squad que este usuario encabeza (solo aplica para HEAD)
  const myHeadSuperSquad = isSuperSquadHead
    ? superSquads.find(ss => ss.head_id === currentUser.user_id)
    : null;

  const isHead = isGlobalHead || isSuperSquadHead;
  const isManager = currentUser.role === UserRole.MANAGER || isHead;

  const myTeam = teams.find(t => t.manager_id === currentUser.user_id);

  // --- SCOPE DE DATOS SEGÚN ROL ---
  // Qué equipos puede ver este usuario
  const myScopeTeams = isGlobalHead
    ? teams
    : isSuperSquadHead && myHeadSuperSquad
      ? teams.filter(t => t.super_squad_id === myHeadSuperSquad.id)
      : myTeam ? [myTeam] : [];

  // IDs de promotores que puede ver este usuario
  const myScopeMemberIds: string[] = isGlobalHead
    ? promoters.map(p => p.user_id)
    : isSuperSquadHead
      ? [...new Set([currentUser.user_id, ...myScopeTeams.flatMap(t => [t.manager_id, ...t.members_ids])])]
      : myTeam
        ? [myTeam.manager_id, ...myTeam.members_ids]
        : [currentUser.user_id];

  // Promotores visibles para este usuario
  const myScopePromoters = isGlobalHead
    ? promoters
    : promoters.filter(p => myScopeMemberIds.includes(p.user_id));

  // Equipos que puede reclutar/gestionar
  const recruitableTeams = isGlobalHead
    ? teams
    : isSuperSquadHead
      ? myScopeTeams
      : myTeam ? [myTeam] : [];

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

  // --- EXPORTAR LIQUIDACIÓN EXCEL (.xlsx) ---
  const handleExportLiquidation = async (data: any[], totals: any) => {
      if (!selectedEventFilter) { toast.error("Selecciona un evento primero."); return; }
      const eventName = events.find(e => e.id === selectedEventFilter)?.title || 'Evento';

      const XLSX = await import('xlsx');

      const rows = data.map(row => ({
          'Squad': row.name,
          'Manager': row.manager_name || 'N/A',
          'Digital (und)': row.digitalQty ?? 0,
          'Ventas Digital ($)': row.digitalGross,
          'Efectivo (und)': row.cashQty ?? 0,
          'Ventas Efectivo ($)': row.cashGross,
          'Recaudo Efectivo ($)': row.cashGross,
          'Comisión Total ($)': row.commission,
          'A Liquidar – Neto ($)': row.net,
      }));

      if (totals) {
          rows.push({
              'Squad': 'TOTALES',
              'Manager': '',
              'Digital (und)': totals.digitalQty ?? 0,
              'Ventas Digital ($)': totals.digitalGross,
              'Efectivo (und)': totals.cashQty ?? 0,
              'Ventas Efectivo ($)': totals.cashGross,
              'Recaudo Efectivo ($)': totals.cashGross,
              'Comisión Total ($)': totals.totalCommission,
              'A Liquidar – Neto ($)': totals.netLiquidation,
          });
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      // Column widths
      ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 22 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Liquidación');

      // Metadata sheet
      const metaData = [
          ['Reporte generado:', new Date().toLocaleString('es-CO')],
          ['Evento:', eventName],
          ['Midnight Corp — Liquidación Maestra'],
      ];
      const metaWs = XLSX.utils.aoa_to_sheet(metaData);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Info');

      XLSX.writeFile(wb, `Liquidacion_${eventName.replace(/\s+/g, '_')}.xlsx`);
      toast.success('Reporte exportado correctamente');
  };

  // --- LÓGICA DE LIQUIDACIÓN GLOBAL (ADMIN/HEAD) ---
  const globalLiquidationData = useMemo(() => {
      if (!isHead || !selectedEventFilter) return null;

      const filteredOrders = orders.filter(o => o.event_id === selectedEventFilter && o.status === 'completed' && o.payment_method !== 'guest_list');
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

      // 1. Procesar Squads Reales (solo los del scope del usuario)
      const teamStats = myScopeTeams.map(team => {
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

      // Identify Managers to exclude from Independents (from ALL teams, not just visible ones)
      const teamManagerIds = teams.map(t => t.manager_id).filter(id => id);

      // 2. Procesar Promotores Independientes — filtrados al scope del usuario
      const independentPromoters = myScopePromoters.filter(p =>
        !p.sales_team_id &&
        p.role !== UserRole.ADMIN &&
        !teamManagerIds.includes(p.user_id)
      );
      
      {
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

      // 3. Procesar Orgánico + Admin — solo visible para directores globales
      if (!isGlobalHead) {
          const grandTotals = teamStats.reduce((acc, team) => ({
              digitalQty: acc.digitalQty + team.digitalQty,
              digitalGross: acc.digitalGross + team.digitalGross,
              cashQty: acc.cashQty + team.cashQty,
              cashGross: acc.cashGross + team.cashGross,
              totalCommission: acc.totalCommission + team.commission,
              netLiquidation: acc.netLiquidation + team.net
          }), { digitalQty: 0, digitalGross: 0, cashQty: 0, cashGross: 0, totalCommission: 0, netLiquidation: 0 });
          return { allTeams: teamStats, stages, grandTotals };
      }

      const adminPromoters = promoters.filter(p => p.role === UserRole.ADMIN);
      const adminIds = adminPromoters.map(p => p.user_id);
      if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

      const organicOrders = filteredOrders.filter(o => !o.staff_id || adminIds.includes(o.staff_id));

      {
          // CRITICAL: Force No Commission for Organic/Admin group
          const metrics = calculateMetrics(organicOrders, true);
          const breakdown = calculateBreakdown(organicOrders);

          const organicMembers: any[] = [];

          // Web Direct
          const webOrders = organicOrders.filter(o => !o.staff_id);
          if (webOrders.length > 0) {
              const wMetrics = calculateMetrics(webOrders, true);
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

          // Admins
          adminPromoters.forEach(admin => {
              const aOrders = organicOrders.filter(o => o.staff_id === admin.user_id);
              if (aOrders.length > 0) {
                  const aMetrics = calculateMetrics(aOrders, true);
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
              commission: metrics.totalCommission,
              net: metrics.netLiquidation,
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
  }, [orders, teams, myScopeTeams, myScopePromoters, promoters, isHead, isGlobalHead, selectedEventFilter, tiers]);

  // --- LOGICA RANKING GENERAL ---
  const generalRankingData = useMemo(() => {
      let filteredOrders = orders.filter(o => o.status === 'completed' && o.payment_method !== 'guest_list');
      
      // 1. FILTER BY EVENT
      if (rankingFilterEvent !== 'all') {
          filteredOrders = filteredOrders.filter(o => o.event_id === rankingFilterEvent);
      }
      
      // 2. FILTER BY DATE
      if (rankingDateStart) {
          filteredOrders = filteredOrders.filter(o => new Date(o.timestamp) >= new Date(rankingDateStart));
      }
      if (rankingDateEnd) {
          const endDate = new Date(rankingDateEnd);
          endDate.setHours(23, 59, 59);
          filteredOrders = filteredOrders.filter(o => new Date(o.timestamp) <= endDate);
      }

      // 3. FILTER BY SCOPE — cada rol ve solo lo suyo
      const scopePromoters = myScopePromoters;

      if (rankingViewMode === 'teams') {
          // TEAM RANKING LOGIC — solo equipos del scope
          const teamStats = myScopeTeams.map(team => {
              const memberIds = [team.manager_id, ...team.members_ids];
              const teamOrders = filteredOrders.filter(o => o.staff_id && memberIds.includes(o.staff_id));
              const ticketsSold = teamOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
              const revenue = teamOrders.reduce((acc, o) => acc + o.total, 0);
              const commission = teamOrders.reduce((acc, o) => acc + o.commission_amount, 0);

              return {
                  user_id: team.id, // Use team ID as key
                  name: team.name,
                  role: 'SQUAD',
                  manager_name: promoters.find(p => p.user_id === team.manager_id)?.name,
                  ticketsSold,
                  revenue,
                  commission,
                  orders: teamOrders
              };
          }).filter(t => t.ticketsSold > 0).sort((a,b) => b.ticketsSold - a.ticketsSold);
          
          return teamStats;
      } else {
          // PROMOTER RANKING LOGIC (DEFAULT)
          const stats = scopePromoters.map(p => {
              const myOrders = filteredOrders.filter(o => o.staff_id === p.user_id);
              const ticketsSold = myOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
              const revenue = myOrders.reduce((acc, o) => acc + o.total, 0);
              const commission = myOrders.reduce((acc, o) => acc + o.commission_amount, 0);
              
              return {
                  ...p,
                  ticketsSold,
                  revenue,
                  commission,
                  orders: myOrders
              };
          }).filter(p => p.ticketsSold > 0).sort((a,b) => b.ticketsSold - a.ticketsSold); 

          return stats;
      }
  }, [orders, myScopePromoters, myScopeTeams, rankingFilterEvent, rankingDateStart, rankingDateEnd, rankingViewMode]);


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
        // Head ve solo su scope (global para Admin/HoS-sin-squad, filtrado para Cabeza de super squad)
        scopeOrders = orders.filter(o =>
            o.status === 'completed' &&
            o.payment_method !== 'guest_list' &&
            (isGlobalHead || myScopeMemberIds.includes(o.staff_id || ''))
        );
        label = isGlobalHead
            ? "Global (Red Completa)"
            : myHeadSuperSquad
              ? `Super Squad: ${myHeadSuperSquad.name}`
              : "Mi Cabeza (sin super squad asignado)";
    } else if (isManager) {
        const teamMemberIds = myTeam ? [currentUser.user_id, ...myTeam.members_ids] : [currentUser.user_id];
        scopeOrders = orders.filter(o => o.status === 'completed' && o.payment_method !== 'guest_list' && o.staff_id && teamMemberIds.includes(o.staff_id));
        label = myTeam ? `Squad: ${myTeam.name}` : "Vista Manager";
    } else {
        scopeOrders = orders.filter(o => o.status === 'completed' && o.payment_method !== 'guest_list' && o.staff_id === currentUser.user_id);
        label = "Rendimiento Personal";
    }

    const sales = scopeOrders.reduce((acc, o) => acc + o.total, 0);

    const adminIds = promoters.filter(p => p.role === UserRole.ADMIN).map(p => p.user_id);
    if (!adminIds.includes('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) adminIds.push('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

    const commissions = scopeOrders.reduce((acc, o) => {
        if (!o.staff_id || adminIds.includes(o.staff_id)) return acc;
        return acc + o.commission_amount;
    }, 0);

    const cashSales = scopeOrders.filter(o => o.payment_method === 'cash').reduce((acc, o) => acc + o.total, 0);
    const netToSend = cashSales - commissions;

    return { kpiSales: sales, kpiCommissions: commissions, kpiNetToSend: netToSend, scopeLabel: label };
  }, [orders, currentUser, myScopeMemberIds, isHead, isGlobalHead, isManager, myTeam, myHeadSuperSquad, promoters, selectedEventFilter, globalLiquidationData]);

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
    if (!manualCustomerInfo.name) { toast.error("Nombre del cliente obligatorio."); return; }
    if (!manualCustomerInfo.email.includes('@')) { toast.error("Email del cliente obligatorio y válido."); return; }
    
    setIsProcessingSale(true);

    try {
        const event = events.find(e => e.id === selectedEventId);
        if (!event) throw new Error("Evento no encontrado");

        // Validar disponibilidad contando tickets reales de órdenes completadas
        for (const item of cart) {
            const tier = tiers.find(t => t.id === item.tierId);
            if (!tier) continue;
            const soldTickets = orders
                .filter(o => o.status === 'completed')
                .flatMap(o => o.items || [])
                .filter(i => i.tier_id === item.tierId)
                .reduce((s, i) => s + (i.quantity || 1), 0);
            const available = tier.quantity - soldTickets;
            if (item.quantity > available) {
                throw new Error(
                    `No hay suficientes boletas para "${tier.name}".\n` +
                    `Solicitadas: ${item.quantity} · Disponibles: ${available}`
                );
            }
        }

        // Construir array de todas las boletas a crear
        const allTicketPromises: Promise<any>[] = [];

        for (const item of cart) {
            const tier = tiers.find(t => t.id === item.tierId);
            if (!tier) continue;

            for (let i = 0; i < item.quantity; i++) {
                const singleItem = [{
                    tier_id: item.tierId,
                    tier_name: tier.name,
                    quantity: 1,
                    unit_price: tier.price,
                    subtotal: tier.price
                }];
                // skipEmail=true AND skipRefresh=true (new parameter)
                allTicketPromises.push(
                    createOrder(selectedEventId, singleItem, 'cash', currentUser.user_id, manualCustomerInfo, true, true)
                );
            }
        }

        // ✅ BATCH PROCESSING: Process in chunks to avoid overwhelming the DB
        const BATCH_SIZE = 10; 
        const createdOrders: any[] = [];

        for (let i = 0; i < allTicketPromises.length; i += BATCH_SIZE) {
            const batch = allTicketPromises.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch);
            createdOrders.push(...results.filter(Boolean));
        }

        if (createdOrders.length > 0) {
            // UN solo email con todos los tickets
            const { sendTicketEmail } = await import('../services/emailService');
            await sendTicketEmail(createdOrders, event);

            // UN solo refresh al final
            await fetchData();

            const total = createdOrders.reduce((acc, o) => acc + o.total, 0);
            setCart([]); 
            setManualCustomerInfo({ name: '', email: '' });
            setShowManualSale(false); 
            setSelectedEventId('');
            toast.success(`${createdOrders.length} boletas generadas — Total: $${total.toLocaleString()}`);
        }
    } catch (error: any) {
        console.error("Error in manual sale:", error);
        toast.error(`Error al procesar venta: ${error.message}`);
    } finally {
        setIsProcessingSale(false);
    }
  };



  const handleLinkExistingStaff = async () => {
      if (!selectedStaffIdToLink) { toast.error("Selecciona un promotor disponible."); return; }
      if (!selectedRecruitmentTeamId) { toast.error("Selecciona un Squad de destino."); return; }

      const staff = promoters.find(p => p.user_id === selectedStaffIdToLink);
      const team = teams.find(t => t.id === selectedRecruitmentTeamId);

      if (!staff || !team) return;

      try {
          await useStore().updateStaffTeam(staff.user_id, team.id);
          toast.success(`${staff.name} vinculado al Squad ${team.name}`);
          setSelectedStaffIdToLink(''); setShowRecruitmentModal(false);
      } catch (error: any) {
          console.error("Error linking staff:", error);
          toast.error("Error al vincular promotor.");
      }
  };

  const handleManagerRecruit = async () => {
      if (!newStaffName || !newStaffEmail) {
          toast.error("Nombre y Email son obligatorios.");
          return;
      }
      if (!newStaffEmail.includes('@')) {
          toast.error("Ingresa un email válido. El promotor lo usará para iniciar sesión.");
          return;
      }

      const targetTeamId = selectedRecruitmentTeamId || null;
      const targetManagerId = targetTeamId ? (teams.find(t => t.id === targetTeamId)?.manager_id ?? null) : null;
      const finalCode = (newStaffCode || newStaffEmail.split('@')[0]).replace(/\s/g, '').toUpperCase();

      if (!finalCode) { toast.error("El código no puede estar vacío."); return; }
      if (/\s/.test(finalCode)) { toast.error("El código no puede contener espacios."); return; }

      try {
          await addStaff({
              name: newStaffName,
              code: finalCode,
              email: newStaffEmail.toLowerCase().trim(),
              role: UserRole.PROMOTER,
              sales_team_id: targetTeamId,
              manager_id: targetManagerId
          });

          const teamName = targetTeamId ? teams.find(t => t.id === targetTeamId)?.name : "Independiente";
          toast.success(`${newStaffName} registrado — Squad: ${teamName}`);
          setNewStaffName(''); setNewStaffCode(''); setNewStaffEmail(''); setShowRecruitmentModal(false);
      } catch (error: any) {
          console.error("Error recruiting:", error);
          toast.error(`Error al registrar promotor: ${error.message || 'Intenta nuevamente'}`);
      }
  };

  const loadBouncerLinks = async () => {
    const { data } = await supabase.from('bouncer_links').select('*').order('created_at', { ascending: false });
    setBouncerLinks(data || []);
    setBouncerLinksLoaded(true);
  };

  const createBouncerLink = async () => {
    if (!newBouncerLabel.trim() || !newBouncerEventId) return;
    setCreatingBouncerLink(true);
    const token = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
    const { error } = await supabase.from('bouncer_links').insert({
      token,
      event_id: newBouncerEventId,
      label: newBouncerLabel.trim(),
      active: true,
    });
    if (error) {
      toast.error(`Error al crear link: ${error.message}`);
    } else {
      setNewBouncerLabel('');
      setNewBouncerEventId('');
      await loadBouncerLinks();
      toast.success('Link de acceso creado');
    }
    setCreatingBouncerLink(false);
  };

  const toggleBouncerLink = async (token: string, active: boolean) => {
    await supabase.from('bouncer_links').update({ active: !active }).eq('token', token);
    setBouncerLinks(prev => prev.map(l => l.token === token ? { ...l, active: !active } : l));
  };

  const copyBouncerLink = (token: string) => {
    navigator.clipboard.writeText(`https://midnightcorp.click/bouncer?t=${token}`);
    setCopiedBouncerToken(token);
    setTimeout(() => setCopiedBouncerToken(null), 2000);
  };

  return (
    <div className="min-h-screen pt-20 md:pt-24 px-4 max-w-7xl mx-auto pb-20">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-8 md:mb-12">
        <div>
          <h1 className="text-2xl md:text-5xl font-black text-white tracking-tighter">
            {isAdmin ? 'MIDNIGHT COMMAND' : isGlobalHead ? 'CENTRAL DE VENTAS' : isSuperSquadHead ? 'MI SUPER SQUAD' : isManager ? 'MI SQUAD' : 'PORTAL STAFF'}
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
            {isBouncer && (
                <Button onClick={() => { setScannerEventId(undefined); setShowScanner(true); }} className="bg-white text-black font-black h-10 md:h-12 px-4 md:px-6 rounded-lg md:rounded-xl border-none text-xs md:text-sm flex-1 md:flex-none">
                    <QrCode className="mr-2 w-3 h-3 md:w-4 md:h-4" /> ESCANEAR
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

          <div className="relative z-10 flex flex-col gap-3 w-full md:w-auto">
              <div className="flex items-center bg-black border border-white/10 rounded-xl px-4 py-3 gap-3 w-full md:min-w-[300px]">
                  <p className="text-xs text-zinc-400 font-mono truncate flex-1 min-w-0">{referralLink}</p>
                  <div className="flex items-center gap-1.5 flex-shrink-0 bg-white/5 rounded-lg px-2.5 py-1.5">
                      <Eye size={12} className="text-white/40" />
                      <span className="text-xs font-black text-white/60 tabular-nums">{(currentUser.link_views || 0).toLocaleString('es-CO')}</span>
                  </div>
              </div>
              <div className="flex gap-2 w-full">
                  <Button onClick={handleCopyLink} className={`font-bold h-12 flex-1 sm:flex-none transition-all ${linkCopied ? 'bg-emerald-500 text-black' : 'bg-white text-black'}`}>
                      {linkCopied ? <Check size={18}/> : <Copy size={18}/>}
                      <span className="ml-2 text-xs">{linkCopied ? 'COPIADO' : 'COPIAR'}</span>
                  </Button>
                  <Button onClick={handleShareWhatsapp} className="bg-[#25D366] text-white font-bold h-12 px-4 flex-1 sm:flex-none">
                      <MessageCircle size={18} className="mr-2"/> WHATSAPP
                  </Button>
              </div>
          </div>
      </div>

      {/* ── LINKS DE ACCESO (solo admin) ─────────────────────────────────────── */}
      {isAdmin && (
        <div className="mb-8 md:mb-12 bg-zinc-900/60 border border-white/10 rounded-[2rem] p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-3">
                <ScanLine className="text-[#C9A84C] w-5 h-5" /> LINKS DE ACCESO
              </h3>
              <p className="text-zinc-500 text-xs mt-1">Genera links de escaneo enlazados a un evento para porteros</p>
            </div>
          </div>

          {/* Create new link */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6 p-4 bg-black/30 border border-white/5 rounded-2xl">
            <input
              placeholder="Nombre del punto (ej: Puerta Principal)"
              value={newBouncerLabel}
              onChange={e => setNewBouncerLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBouncerLink()}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 h-11 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-[#C9A84C]/40"
            />
            <select
              value={newBouncerEventId}
              onChange={e => setNewBouncerEventId(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 h-11 text-xs text-white outline-none focus:border-[#C9A84C]/40 sm:w-56"
            >
              <option value="">— Seleccionar evento —</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
            <button
              onClick={createBouncerLink}
              disabled={creatingBouncerLink || !newBouncerLabel.trim() || !newBouncerEventId}
              className="h-11 px-5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] bg-[#C9A84C] text-black disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {creatingBouncerLink ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear link
            </button>
          </div>

          {/* Links list */}
          {!bouncerLinksLoaded ? (
            <div className="flex items-center justify-center py-8 gap-3 text-zinc-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs uppercase font-bold tracking-widest">Cargando...</span>
            </div>
          ) : bouncerLinks.length === 0 ? (
            <p className="text-center text-zinc-600 text-xs uppercase font-bold py-8">
              No hay links creados aún
            </p>
          ) : (
            <div className="space-y-2">
              {bouncerLinks.map(l => {
                const ev = events.find(e => e.id === l.event_id);
                return (
                  <div
                    key={l.token}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border transition-all ${
                      l.active ? 'bg-black/30 border-white/8' : 'bg-black/10 border-white/3 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${l.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-zinc-600'}`} />
                      <div className="min-w-0">
                        <p className="text-white font-black text-sm truncate">{l.label}</p>
                        <p className="text-zinc-500 text-[10px] font-bold truncate">{ev?.title ?? l.event_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => copyBouncerLink(l.token)}
                        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                          copiedBouncerToken === l.token
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {copiedBouncerToken === l.token ? <Check size={12} /> : <Copy size={12} />}
                        {copiedBouncerToken === l.token ? 'Copiado' : 'Copiar'}
                      </button>
                      <button
                        onClick={() => toggleBouncerLink(l.token, l.active)}
                        className={`h-9 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          l.active
                            ? 'border-red-500/20 text-red-400/60 hover:bg-red-500/10 hover:text-red-400'
                            : 'border-emerald-500/20 text-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-400'
                        }`}
                      >
                        {l.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MI DEUDA ACTUAL (solo promotores no-admin) ─────────────────────── */}
      {!isAdmin && (() => {
        const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

        // All events where this promoter sold tickets
        const myOrders = orders.filter(o => o.staff_id === currentUser.user_id && o.status === 'completed');
        const myEventIds = [...new Set(myOrders.map(o => o.event_id))];

        type DebtRow = { ev: typeof events[0]; dineroAEnviar: number; comisiones: number; yaEnviado: number; deuda: number; settList: typeof settlements; tickets: number };
        const debtRows: DebtRow[] = myEventIds.map(eid => {
          const ev = events.find(e => e.id === eid);
          if (!ev) return null;
          const evOrders = myOrders.filter(o => o.event_id === eid);
          const dineroAEnviar = evOrders.reduce((s, o) => s + (o.net_amount || 0), 0);
          const comisiones = evOrders.reduce((s, o) => s + (o.commission_amount || 0), 0);
          const settList = settlements.filter(s => s.event_id === eid && s.promoter_id === currentUser.user_id);
          const yaEnviado = settList.reduce((s, se) => s + se.amount_sent, 0);
          const deuda = dineroAEnviar - yaEnviado;
          return { ev, dineroAEnviar, comisiones, yaEnviado, deuda, settList, tickets: evOrders.length };
        }).filter((r): r is DebtRow => r !== null);

        const totalDeuda = debtRows.reduce((s: number, r: DebtRow) => s + r.deuda, 0);
        if (debtRows.length === 0) return null;

        return (
          <div className="mb-8 md:mb-12">
            {/* Modal subir comprobante (promotor) */}
            {showDebtUpload && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl overflow-y-auto">
                {debtPreviewFull && (
                  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/98 cursor-zoom-out" onClick={() => setDebtPreviewFull(null)}>
                    <img src={debtPreviewFull} alt="comprobante" className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain" />
                  </div>
                )}
                <div className="w-full max-w-sm bg-[#0d0d0d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-auto">
                  <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div>
                      <h3 className="font-black text-white text-sm">Registrar Pago</h3>
                      <p className="text-[9px] text-white/30">{showDebtUpload.eventTitle}</p>
                    </div>
                    <button onClick={() => { setShowDebtUpload(null); setDebtImageFile(null); setDebtImagePreview(null); }} className="text-white/30 hover:text-white"><X size={16} /></button>
                  </div>
                  <div className="p-5 space-y-3">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-2 mb-1">
                      {[
                        { label: 'A enviar', val: fmt(showDebtUpload.dineroAEnviar), c: 'text-white' },
                        { label: 'Enviado', val: fmt(showDebtUpload.totalEnviado), c: 'text-emerald-400' },
                        { label: 'Deuda', val: (showDebtUpload.dineroAEnviar - showDebtUpload.totalEnviado) <= 0 ? '✓ PAZ' : fmt(showDebtUpload.dineroAEnviar - showDebtUpload.totalEnviado), c: (showDebtUpload.dineroAEnviar - showDebtUpload.totalEnviado) > 0 ? 'text-amber-400' : 'text-emerald-400' },
                      ].map(k => (
                        <div key={k.label} className="bg-white/5 rounded-lg p-2 text-center">
                          <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">{k.label}</p>
                          <p className={`text-[10px] font-black ${k.c}`}>{k.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Monto */}
                    <div>
                      <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1">Monto enviado (COP)</label>
                      <input type="number" placeholder="0" value={debtUploadForm.amount}
                        onChange={e => setDebtUploadForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-bold placeholder:text-white/15" />
                      {(() => {
                        const remaining = showDebtUpload.dineroAEnviar - showDebtUpload.totalEnviado;
                        const entered = Number(debtUploadForm.amount);
                        if (entered > remaining && entered > 0) {
                          const credit = entered - remaining;
                          return (
                            <p className="text-[9px] text-blue-400 font-black mt-1 flex items-center gap-1">
                              ℹ️ Excede la deuda — se registrará {fmt(credit)} como crédito a favor del promotor
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Método */}
                    <div className="flex rounded-xl overflow-hidden border border-white/10">
                      {[{ v: 'cash', l: 'Efectivo' }, { v: 'transfer', l: 'Transfer.' }, { v: 'mixed', l: 'Mixto' }].map(opt => (
                        <button key={opt.v} type="button" onClick={() => setDebtUploadForm(f => ({ ...f, method: opt.v }))}
                          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${debtUploadForm.method === opt.v ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`}>
                          {opt.l}
                        </button>
                      ))}
                    </div>

                    {/* Imagen */}
                    <div>
                      <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-1 flex items-center gap-1">
                        <ImagePlus size={9} /> Comprobante (imagen · se comprime auto)
                      </label>
                      <input ref={debtFileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setDebtImageFile(f);
                          setDebtImagePreview(URL.createObjectURL(f));
                        }} />
                      {debtImagePreview ? (
                        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-white/10 group">
                          <img src={debtImagePreview} alt="preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-all">
                            <button onClick={() => setDebtPreviewFull(debtImagePreview)} className="text-white p-2 rounded-lg bg-white/10 hover:bg-white/20"><Eye size={14} /></button>
                            <button onClick={() => { setDebtImageFile(null); setDebtImagePreview(null); if (debtFileRef.current) debtFileRef.current.value = ''; }}
                              className="text-red-400 p-2 rounded-lg bg-red-500/10"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => debtFileRef.current?.click()}
                          className="w-full h-16 border-2 border-dashed border-white/10 rounded-xl text-white/20 hover:text-white/40 hover:border-white/20 transition-all flex items-center justify-center gap-2 text-[9px] font-black uppercase">
                          <ImagePlus size={16} /> Seleccionar imagen
                        </button>
                      )}
                    </div>

                    <textarea placeholder="Notas (opcional)" value={debtUploadForm.notes}
                      onChange={e => setDebtUploadForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                      className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none" />

                    <button disabled={debtUploadLoading || !debtUploadForm.amount}
                      onClick={async () => {
                        if (!debtUploadForm.amount || Number(debtUploadForm.amount) <= 0) return;
                        setDebtUploadLoading(true);
                        try {
                          let comprobanteUrl: string | undefined;
                          if (debtImageFile) {
                            setDebtUploadProgress('Comprimiendo...');
                            const compressed = await compressImage(debtImageFile);
                            setDebtUploadProgress('Subiendo imagen...');
                            const path = `${showDebtUpload.eventId}/${showDebtUpload.promoterId}/${Date.now()}.jpg`;
                            const { error: upErr } = await supabase.storage.from('comprobantes').upload(path, compressed, { contentType: 'image/jpeg' });
                            if (upErr) throw upErr;
                            comprobanteUrl = supabase.storage.from('comprobantes').getPublicUrl(path).data.publicUrl;
                          }
                          setDebtUploadProgress('Guardando...');
                          await addSettlement({
                            event_id: showDebtUpload.eventId,
                            promoter_id: showDebtUpload.promoterId,
                            amount_sent: Number(debtUploadForm.amount),
                            payment_method: debtUploadForm.method,
                            comprobante_url: comprobanteUrl,
                            notes: debtUploadForm.notes || undefined,
                          });
                          setShowDebtUpload(null);
                          setDebtUploadForm({ amount: '', method: 'transfer', notes: '' });
                          setDebtImageFile(null);
                          setDebtImagePreview(null);
                        } catch (e: any) { toast.error(e.message); }
                        finally { setDebtUploadLoading(false); setDebtUploadProgress(''); }
                      }}
                      className="w-full py-3 bg-white text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      {debtUploadLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {debtUploadLoading ? (debtUploadProgress || 'Enviando...') : 'Registrar Pago'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-6 md:p-8 overflow-hidden relative">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base md:text-xl font-black text-white flex items-center gap-2">
                    <CreditCard className="text-amber-400 w-5 h-5" /> MI DEUDA ACTUAL
                  </h3>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Cierre por evento · Dinero pendiente de enviar</p>
                </div>
                <div className={`px-4 py-2 rounded-full font-black text-sm ${totalDeuda > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {totalDeuda > 0 ? fmt(totalDeuda) : '✓ PAZ Y SALVO'}
                </div>
              </div>

              <div className="space-y-3">
                {debtRows.map(row => (
                  <div key={row.ev.id} className={`rounded-xl p-4 border transition-all ${row.deuda > 0 ? 'bg-amber-500/5 border-amber-500/20' : row.deuda < 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-xs truncate">{row.ev.title}</p>
                        <p className="text-[9px] text-white/30 uppercase">{row.ev.city} · {row.ev.event_date?.slice(0, 10)} · {row.tickets} boleta{row.tickets !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowDebtUpload({ eventId: row.ev.id, eventTitle: row.ev.title, promoterId: currentUser.user_id, dineroAEnviar: row.dineroAEnviar, totalEnviado: row.yaEnviado });
                            setDebtUploadForm({ amount: '', method: 'transfer', notes: '' });
                            setDebtImageFile(null); setDebtImagePreview(null);
                          }}
                          className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all bg-white/5 text-white/40 hover:text-white hover:bg-white/10">
                          <Send size={10} /> {row.settList.length > 0 ? `${row.settList.length} pago${row.settList.length > 1 ? 's' : ''}` : 'Registrar Pago'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">A Enviar</p>
                        <p className="text-xs font-black text-white">{fmt(row.dineroAEnviar)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">Enviado</p>
                        <p className={`text-xs font-black ${row.yaEnviado > 0 ? 'text-emerald-400' : 'text-white/30'}`}>{row.yaEnviado > 0 ? fmt(row.yaEnviado) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-white/30 uppercase font-black mb-0.5">Deuda</p>
                        <p className={`text-xs font-black ${row.deuda > 0 ? 'text-amber-400' : row.deuda < 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                          {row.deuda > 0 ? fmt(row.deuda) : row.deuda === 0 ? '✓ PAZ Y SALVO' : `+${fmt(Math.abs(row.deuda))} crédito`}
                        </p>
                      </div>
                    </div>

                    {/* Historial de pagos del promotor */}
                    {row.settList.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                        {row.settList.map(se => (
                          <div key={se.id} className="flex items-center gap-2">
                            <span className="text-[8px] text-emerald-400 font-black">{fmt(se.amount_sent)}</span>
                            <span className="text-[8px] text-white/30">
                              {se.payment_method === 'cash' ? '💵' : se.payment_method === 'transfer' ? '🏦' : '🔀'}
                            </span>
                            <span className="text-[8px] text-white/20">{se.created_at?.slice(0, 10)}</span>
                            {se.comprobante_url && (
                              <button onClick={() => setDebtPreviewFull(se.comprobante_url!)}
                                className="text-[8px] text-violet-400 hover:underline flex items-center gap-0.5">
                                <ZoomIn size={8} /> Ver
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

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

      {/* ─── SALES INTELLIGENCE (HEAD OF SALES / ADMIN) ──────────────────── */}
      {isHead && (() => {
        // All completed orders
        const allCompleted = orders.filter(o => o.status === 'completed');

        // ── 1. Squad performance (global, no event filter) ──────────────────
        const squadStats = teams.map(team => {
          const memberIds = [team.manager_id, ...team.members_ids];
          const tOrders = allCompleted.filter(o => o.staff_id && memberIds.includes(o.staff_id));
          const revenue = tOrders.reduce((s, o) => s + o.total, 0);
          const tickets = tOrders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
          const cash = tOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);
          const digital = revenue - cash;
          const commissions = tOrders.reduce((s, o) => s + o.commission_amount, 0);
          return {
            id: team.id, name: team.name,
            manager: promoters.find(p => p.user_id === team.manager_id)?.name || '—',
            revenue, tickets, cash, digital, commissions,
            net: cash - commissions,
          };
        }).sort((a, b) => b.revenue - a.revenue);

        const maxRevenue = Math.max(...squadStats.map(s => s.revenue), 1);

        // ── 2. Top clients (by total spend) ─────────────────────────────────
        const clientMap: Record<string, { name: string; email: string; spend: number; count: number }> = {};
        allCompleted.forEach(o => {
          const key = o.customer_email?.toLowerCase() || 'anon';
          if (!clientMap[key]) clientMap[key] = { name: o.customer_name || key, email: key, spend: 0, count: 0 };
          clientMap[key].spend += o.total;
          clientMap[key].count += 1;
        });
        const topClients = Object.values(clientMap).sort((a, b) => b.spend - a.spend).slice(0, 5);

        // ── 3. Channel mix & payment methods ────────────────────────────────
        const totalRevenue = allCompleted.reduce((s, o) => s + o.total, 0) || 1;
        const digitalRev = allCompleted.filter(o => o.payment_method !== 'cash').reduce((s, o) => s + o.total, 0);
        const cashRev = totalRevenue - digitalRev;
        const digitalPct = Math.round((digitalRev / totalRevenue) * 100);
        const cashPct = 100 - digitalPct;

        // ── 4. Top selling days ──────────────────────────────────────────────
        const dayMap: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
        allCompleted.forEach(o => {
          const d = new Date(o.timestamp).getDay();
          dayMap[d] += o.total;
        });
        const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const maxDay = Math.max(...Object.values(dayMap), 1);

        const fmt = (n: number) => new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

        return (
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-neon-purple" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">Sales Intelligence</h2>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Todos los eventos · Datos en tiempo real</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

              {/* Squad Scorecards */}
              <div className="lg:col-span-2 bg-zinc-900/50 border border-white/5 rounded-[2rem] p-5 md:p-6">
                <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users size={12} /> Squads — Rendimiento Global
                </h3>
                <div className="space-y-3">
                  {squadStats.length === 0 && (
                    <p className="text-zinc-600 text-xs uppercase font-bold text-center py-4">Sin datos de squads</p>
                  )}
                  {squadStats.map(sq => (
                    <div key={sq.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-black text-white truncate">{sq.name}</span>
                          <span className="text-[9px] text-zinc-600 font-bold hidden sm:inline">· {sq.manager}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-black shrink-0">
                          <span className="text-emerald-400">{sq.tickets} 🎟</span>
                          <span className="text-white">${fmt(sq.revenue)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-neon-purple to-neon-blue rounded-full transition-all duration-700"
                          style={{ width: `${(sq.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1 text-[9px] text-zinc-600 font-bold">
                        <span className="text-purple-400">Digital: ${fmt(sq.digital)}</span>
                        <span className="text-amber-400">Efectivo: ${fmt(sq.cash)}</span>
                        <span className="text-emerald-400">Net: ${fmt(sq.net)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channel Mix + Day Analysis */}
              <div className="space-y-4">
                {/* Channel Mix */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-5">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <PieChart size={12} /> Canal de Venta
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-black mb-1">
                        <span className="text-neon-blue">Digital</span>
                        <span className="text-white">{digitalPct}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-neon-blue rounded-full" style={{ width: `${digitalPct}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-600 mt-0.5">${fmt(digitalRev)}</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-black mb-1">
                        <span className="text-amber-400">Efectivo</span>
                        <span className="text-white">{cashPct}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${cashPct}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-600 mt-0.5">${fmt(cashRev)}</p>
                    </div>
                  </div>
                </div>

                {/* Day of week */}
                <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-5">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calendar size={12} /> Ventas por Día
                  </h3>
                  <div className="flex items-end gap-1.5 h-16">
                    {[0,1,2,3,4,5,6].map(d => (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-neon-purple/40 rounded-t-sm transition-all duration-500 hover:bg-neon-purple"
                          style={{ height: `${(dayMap[d] / maxDay) * 100}%`, minHeight: dayMap[d] > 0 ? '4px' : '0' }}
                        />
                        <span className="text-[7px] text-zinc-600 font-bold">{dayNames[d]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Clients */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-5 md:p-6">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Award size={12} /> Top Clientes — Por Gasto Total
              </h3>
              {topClients.length === 0 ? (
                <p className="text-zinc-600 text-xs uppercase font-bold text-center py-4">Sin datos de clientes</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  {topClients.map((c, i) => (
                    <div key={c.email} className={`rounded-2xl p-4 border ${i === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-amber-400 text-black' : 'bg-zinc-700 text-white'}`}>
                          {i + 1}
                        </div>
                        <span className="text-[9px] text-zinc-500 font-bold">{c.count} compra{c.count !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-xs font-black text-white truncate">{c.name}</p>
                      <p className="text-[9px] text-zinc-600 truncate">{c.email}</p>
                      <p className="text-sm font-black text-emerald-400 mt-2">${c.spend.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                              <p className="text-[8px] text-zinc-600 uppercase tracking-widest px-4 py-2 md:hidden">← Desliza para ver más →</p>
                              <table className="w-full text-left min-w-[640px]">
                                  <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                      <tr>
                                          <th className="p-3 md:p-6">Squad / Manager</th>
                                          <th className="p-3 md:p-6 text-right text-purple-400">Digital</th>
                                          <th className="p-3 md:p-6 text-right text-amber-400">Efectivo</th>
                                          <th className="p-3 md:p-6 text-right text-white">Recaudo</th>
                                          <th className="p-3 md:p-6 text-right text-emerald-500">Comis.</th>
                                          <th className="p-3 md:p-6 text-right text-neon-blue">A Liquidar</th>
                                          <th className="p-3 md:p-6 text-center">Ver</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                                      {(() => {
                                          const organicTeam = globalLiquidationData.allTeams.find(t => t.id === 'virtual_organic');
                                          const independentTeam = globalLiquidationData.allTeams.find(t => t.id === 'virtual_independent');
                                          const realTeams = globalLiquidationData.allTeams.filter(t => !t.isVirtual);

                                          const renderSquadRow = (team: typeof realTeams[0], indented = false) => (
                                              <tr key={team.id} className="hover:bg-white/[0.02] transition-colors">
                                                  <td className={`p-3 md:p-6 ${indented ? 'pl-6 md:pl-12' : ''}`}>
                                                      <div className="font-black text-white text-xs md:text-sm">{team.name}</div>
                                                      <div className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Mgr: {team.manager_name || 'N/A'}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-purple-400/80">
                                                      <div className="font-bold">{team.digitalQty} und</div>
                                                      <div className="text-[9px]">${team.digitalGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-amber-400/80">
                                                      <div className="font-bold">{team.cashQty} und</div>
                                                      <div className="text-[9px]">${team.cashGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-white border-l border-white/5">${team.cashGross.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${team.commission.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-black text-neon-blue text-base border-l border-white/5 bg-white/[0.02]">${team.net.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-center">
                                                      <button onClick={() => { setViewingTeamId(team.id); setExpandedMemberId(null); }} className="p-2 bg-white/5 rounded-lg md:rounded-xl hover:bg-neon-purple/20 text-zinc-500 hover:text-neon-purple transition-all border border-transparent hover:border-neon-purple/20 flex items-center justify-center mx-auto">
                                                          <Users size={14} className="md:w-4 md:h-4 md:mr-2"/>
                                                          <span className="hidden md:inline">Miembros</span>
                                                      </button>
                                                  </td>
                                              </tr>
                                          );

                                          // Group real teams by super squad
                                          const superSquadGroups = superSquads
                                              .map(ss => {
                                                  const ssTeams = realTeams.filter(t => {
                                                      const dbTeam = teams.find(dt => dt.id === t.id);
                                                      return dbTeam?.super_squad_id === ss.id;
                                                  });
                                                  if (ssTeams.length === 0) return null;
                                                  const agg = ssTeams.reduce((acc, t) => ({
                                                      digitalQty: acc.digitalQty + t.digitalQty,
                                                      digitalGross: acc.digitalGross + t.digitalGross,
                                                      cashQty: acc.cashQty + t.cashQty,
                                                      cashGross: acc.cashGross + t.cashGross,
                                                      commission: acc.commission + t.commission,
                                                      net: acc.net + t.net,
                                                  }), { digitalQty: 0, digitalGross: 0, cashQty: 0, cashGross: 0, commission: 0, net: 0 });
                                                  return { ss, ssTeams, agg };
                                              })
                                              .filter((g): g is NonNullable<typeof g> => g !== null);

                                          const unassignedTeams = realTeams.filter(t => {
                                              const dbTeam = teams.find(dt => dt.id === t.id);
                                              return !dbTeam?.super_squad_id;
                                          });

                                          const showGrouping = isGlobalHead && superSquadGroups.length > 0;

                                          const renderVirtualRow = (team: NonNullable<typeof organicTeam>) => (
                                              <tr key={team.id} className={`hover:bg-white/[0.02] transition-colors ${team.id === 'virtual_organic' ? 'bg-neon-purple/5 border-l-4 border-l-neon-purple border-t border-neon-purple/10' : 'bg-zinc-800/20 border-l-4 border-l-amber-500 border-t border-amber-500/10'}`}>
                                                  <td className="p-3 md:p-6">
                                                      <div className={`font-black ${team.id === 'virtual_organic' ? 'text-neon-purple text-sm md:text-base' : 'text-amber-500 text-xs md:text-sm'}`}>{team.name}</div>
                                                      <div className="text-[9px] text-zinc-500 font-bold uppercase mt-1">{team.manager_name || 'N/A'}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-purple-400/80">
                                                      <div className="font-bold">{team.digitalQty} und</div>
                                                      <div className="text-[9px]">${team.digitalGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-amber-400/80">
                                                      <div className="font-bold">{team.cashQty} und</div>
                                                      <div className="text-[9px]">${team.cashGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-white border-l border-white/5">${team.cashGross.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${team.commission.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-black text-neon-blue text-base border-l border-white/5 bg-white/[0.02]">${team.net.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-center">
                                                      <button onClick={() => { setViewingTeamId(team.id); setExpandedMemberId(null); }} className="p-2 bg-white/5 rounded-lg md:rounded-xl hover:bg-neon-purple/20 text-zinc-500 hover:text-neon-purple transition-all border border-transparent hover:border-neon-purple/20 flex items-center justify-center mx-auto">
                                                          <Users size={14} className="md:w-4 md:h-4 md:mr-2"/>
                                                          <span className="hidden md:inline">Miembros</span>
                                                      </button>
                                                  </td>
                                              </tr>
                                          );

                                          return (
                                              <>
                                                  {/* Organic always first */}
                                                  {organicTeam && renderVirtualRow(organicTeam)}

                                                  {showGrouping ? (
                                                      <>
                                                          {superSquadGroups.map(({ ss, ssTeams, agg }) => (
                                                              <React.Fragment key={ss.id}>
                                                                  {/* Super Squad header row — gold */}
                                                                  <tr className="bg-[#C9A84C]/10 border-l-4 border-l-[#C9A84C] border-t border-[#C9A84C]/20">
                                                                      <td className="p-3 md:p-5">
                                                                          <div className="font-black text-[#C9A84C] uppercase tracking-tight text-xs md:text-sm">{ss.name}</div>
                                                                          <div className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">{ssTeams.length} {ssTeams.length === 1 ? 'squad' : 'squads'}</div>
                                                                      </td>
                                                                      <td className="p-3 md:p-5 text-right text-purple-400/60 text-[10px] md:text-xs">
                                                                          <div className="font-bold">{agg.digitalQty} und</div>
                                                                          <div className="text-[9px]">${agg.digitalGross.toLocaleString()}</div>
                                                                      </td>
                                                                      <td className="p-3 md:p-5 text-right text-amber-400/60 text-[10px] md:text-xs">
                                                                          <div className="font-bold">{agg.cashQty} und</div>
                                                                          <div className="text-[9px]">${agg.cashGross.toLocaleString()}</div>
                                                                      </td>
                                                                      <td className="p-3 md:p-5 text-right font-bold text-zinc-300 border-l border-white/5 text-[10px] md:text-xs">${agg.cashGross.toLocaleString()}</td>
                                                                      <td className="p-3 md:p-5 text-right font-bold text-emerald-400/80 text-[10px] md:text-xs">${agg.commission.toLocaleString()}</td>
                                                                      <td className="p-3 md:p-5 text-right font-black text-[#C9A84C] text-sm md:text-base border-l border-white/5">${agg.net.toLocaleString()}</td>
                                                                      <td className="p-3 md:p-5"></td>
                                                                  </tr>
                                                                  {/* Squad rows indented under super squad */}
                                                                  {ssTeams.map(team => renderSquadRow(team, true))}
                                                              </React.Fragment>
                                                          ))}
                                                          {unassignedTeams.length > 0 && (
                                                              <React.Fragment>
                                                                  <tr className="bg-zinc-800/20 border-l-4 border-l-zinc-600 border-t border-zinc-700/30">
                                                                      <td colSpan={7} className="p-3 md:p-5">
                                                                          <div className="font-black text-zinc-400 uppercase tracking-tight text-[10px] md:text-xs">Sin Super Squad</div>
                                                                          <div className="text-[9px] text-zinc-600 font-bold uppercase mt-0.5">{unassignedTeams.length} {unassignedTeams.length === 1 ? 'squad' : 'squads'}</div>
                                                                      </td>
                                                                  </tr>
                                                                  {unassignedTeams.map(team => renderSquadRow(team, true))}
                                                              </React.Fragment>
                                                          )}
                                                      </>
                                                  ) : (
                                                      realTeams.map(team => renderSquadRow(team, false))
                                                  )}

                                                  {/* Independents always last */}
                                                  {independentTeam && renderVirtualRow(independentTeam)}
                                              </>
                                          );
                                      })()}
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

      {/* --- PANEL LIQUIDACIÓN MANAGER (SOLO MANAGER, NO HEAD/ADMIN) --- */}
      {isManager && !isHead && myTeam && (
          <div className="space-y-6 md:space-y-8 mb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col md:flex-row justify-between items-end gap-4 md:gap-6 bg-zinc-900/30 p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                  <div className="flex-1 w-full">
                      <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                        <ShieldCheck className="text-neon-purple w-5 h-5 md:w-6 md:h-6" /> Liquidación de Squad: {myTeam.name}
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
                      <p className="text-zinc-500 font-bold uppercase text-sm">Debes seleccionar un evento para ver la liquidación de tu equipo.</p>
                  </div>
              ) : (
                  // REUSE THE SAME LOGIC BUT FILTERED FOR THIS TEAM
                  (() => {
                      // Calculate metrics specifically for this team and event
                      const teamMemberIds = [myTeam.manager_id, ...myTeam.members_ids];
                      const teamOrders = orders.filter(o => o.event_id === selectedEventFilter && o.staff_id && teamMemberIds.includes(o.staff_id));
                      
                      // Helper metrics (duplicated from global logic for local scope)
                      const calculateLocalMetrics = (subsetOrders: Order[]) => {
                          const digitalOrders = subsetOrders.filter(o => o.payment_method !== 'cash');
                          const cashOrders = subsetOrders.filter(o => o.payment_method === 'cash');
                          const digitalQty = digitalOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
                          const digitalGross = digitalOrders.reduce((acc, o) => acc + o.total, 0);
                          const cashQty = cashOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);
                          const cashGross = cashOrders.reduce((acc, o) => acc + o.total, 0);
                          const totalCommission = subsetOrders.reduce((acc, o) => acc + o.commission_amount, 0);
                          const netLiquidation = cashGross - totalCommission;
                          return { digitalQty, digitalGross, cashQty, cashGross, totalCommission, netLiquidation };
                      };

                      const teamMetrics = calculateLocalMetrics(teamOrders);

                      // Member breakdown
                      const members = promoters.filter(p => teamMemberIds.includes(p.user_id)).map(p => {
                          const staffOrders = teamOrders.filter(o => o.staff_id === p.user_id);
                          const mMetrics = calculateLocalMetrics(staffOrders);
                          return { ...p, ...mMetrics, orders: staffOrders };
                      });

                      return (
                          <div className="bg-zinc-900/50 border border-white/5 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden">
                              <div className="p-5 md:p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                                  <h3 className="text-lg font-black text-white uppercase tracking-tighter">Desglose por Miembro</h3>
                                  <Button onClick={() => handleExportLiquidation([{name: myTeam.name, manager_name: currentUser.name, ...teamMetrics, net: teamMetrics.netLiquidation}], teamMetrics)} size="sm" variant="outline" className="text-[10px]">
                                      <Download size={14} className="mr-2"/> EXPORTAR
                                  </Button>
                              </div>
                              <div className="overflow-x-auto">
                                  <table className="w-full text-left">
                                      <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                                          <tr>
                                              <th className="p-3 md:p-6">Miembro</th>
                                              <th className="p-3 md:p-6 text-right text-purple-400">Digital (Qty/$)</th>
                                              <th className="p-3 md:p-6 text-right text-amber-400">Efectivo (Qty/$)</th>
                                              <th className="p-3 md:p-6 text-right text-white">Recaudo Efectivo</th>
                                              <th className="p-3 md:p-6 text-right text-emerald-500">Comis. Total</th>
                                              <th className="p-3 md:p-6 text-right text-neon-blue">A Liquidar (Neto)</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                                          {members.map(member => (
                                              <tr key={member.user_id} className="hover:bg-white/[0.02] transition-colors">
                                                  <td className="p-3 md:p-6 font-bold text-white">
                                                      {member.name} <span className="text-[9px] text-zinc-500 ml-1">({member.role})</span>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-purple-400/80">
                                                      <div className="font-bold">{member.digitalQty} und</div>
                                                      <div className="text-[9px]">${member.digitalGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right text-amber-400/80">
                                                      <div className="font-bold">{member.cashQty} und</div>
                                                      <div className="text-[9px]">${member.cashGross.toLocaleString()}</div>
                                                  </td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-white border-l border-white/5">${member.cashGross.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-bold text-emerald-500">${member.totalCommission.toLocaleString()}</td>
                                                  <td className="p-3 md:p-6 text-right font-black text-neon-blue text-base border-l border-white/5 bg-white/[0.02]">${member.netLiquidation.toLocaleString()}</td>
                                              </tr>
                                          ))}
                                          {/* TOTAL ROW */}
                                          <tr className="bg-white/5 font-black border-t-2 border-white/10">
                                              <td className="p-3 md:p-6 text-white uppercase tracking-widest">TOTAL SQUAD</td>
                                              <td className="p-3 md:p-6 text-right text-purple-400">
                                                  <div>{teamMetrics.digitalQty} und</div>
                                                  <div className="text-[10px]">${teamMetrics.digitalGross.toLocaleString()}</div>
                                              </td>
                                              <td className="p-3 md:p-6 text-right text-amber-400">
                                                  <div>{teamMetrics.cashQty} und</div>
                                                  <div className="text-[10px]">${teamMetrics.cashGross.toLocaleString()}</div>
                                              </td>
                                              <td className="p-3 md:p-6 text-right text-white border-l border-white/10">${teamMetrics.cashGross.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-right text-emerald-500">${teamMetrics.totalCommission.toLocaleString()}</td>
                                              <td className="p-3 md:p-6 text-right text-neon-blue text-lg border-l border-white/10">${teamMetrics.netLiquidation.toLocaleString()}</td>
                                          </tr>
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      );
                  })()
              )}
          </div>
      )}

      {/* --- PANEL COMISIONES MANAGER (COMISIÓN NETA DEL MANAGER) --- */}
      {isManager && !isHead && myTeam && selectedEventFilter && (
          <div className="space-y-4 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="flex items-center gap-3 px-1">
                  <Coins className="text-[#C9A84C] w-5 h-5" />
                  <h2 className="text-xl font-black text-white">Desglose de Comisiones</h2>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Admin paga al manager · Manager asigna al promotor</span>
              </div>

              <div className="bg-zinc-900/50 border border-[#C9A84C]/15 rounded-[2rem] overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                              <tr>
                                  <th className="p-4 md:p-6">Promotor</th>
                                  <th className="p-4 md:p-6 text-right">Boletas</th>
                                  <th className="p-4 md:p-6 text-right text-neon-blue">Com. Admin→Manager</th>
                                  <th className="p-4 md:p-6 text-right text-emerald-400">Pago al Promotor</th>
                                  <th className="p-4 md:p-6 text-right" style={{ color: '#C9A84C' }}>Diferencia (Tuya)</th>
                                  <th className="p-4 md:p-6 text-center text-zinc-500">Editar Pago</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                              {(() => {
                                  const teamMemberIds = [myTeam.manager_id, ...myTeam.members_ids];
                                  const teamOrders = orders.filter(o => o.event_id === selectedEventFilter && o.status === 'completed' && o.payment_method !== 'guest_list');
                                  const eventTiers = getEventTiers(selectedEventFilter);

                                  let totalManagerComm = 0;
                                  let totalPromoterPay = 0;

                                  const rows = promoters
                                      .filter(p => teamMemberIds.includes(p.user_id))
                                      .map(p => {
                                          const staffOrders = teamOrders.filter(o => o.staff_id === p.user_id);
                                          const tickets = staffOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0);

                                          // commission_manager per ticket (weighted avg if multiple tiers)
                                          let commManagerTotal = 0;
                                          staffOrders.forEach(o => {
                                              o.items.forEach(item => {
                                                  const tier = eventTiers.find(t => t.id === item.tier_id);
                                                  commManagerTotal += (tier?.commission_manager || tier?.commission_fixed || 0) * item.quantity;
                                              });
                                          });

                                          const payout = promoterPayouts.find(pp => pp.event_id === selectedEventFilter && pp.manager_id === currentUser.user_id && pp.promoter_id === p.user_id);
                                          const payoutPerTicket = payout?.amount_per_ticket ?? (eventTiers[0]?.commission_promoter_min ?? 0);
                                          const promoterPayTotal = payoutPerTicket * tickets;
                                          const diff = commManagerTotal - promoterPayTotal;

                                          totalManagerComm += commManagerTotal;
                                          totalPromoterPay += promoterPayTotal;

                                          const draftKey = p.user_id;
                                          const draftVal = editingPayouts[draftKey] ?? String(payoutPerTicket);

                                          return (
                                              <tr key={p.user_id} className="hover:bg-white/[0.02] transition-colors">
                                                  <td className="p-4 md:p-6 font-bold text-white">
                                                      {p.name}
                                                      <span className="ml-2 text-[9px] text-zinc-500 font-normal uppercase">{p.role}</span>
                                                  </td>
                                                  <td className="p-4 md:p-6 text-right font-black text-white">{tickets}</td>
                                                  <td className="p-4 md:p-6 text-right font-bold text-neon-blue">${commManagerTotal.toLocaleString()}</td>
                                                  <td className="p-4 md:p-6 text-right font-bold text-emerald-400">${promoterPayTotal.toLocaleString()}</td>
                                                  <td className="p-4 md:p-6 text-right font-black text-lg" style={{ color: '#C9A84C' }}>${diff.toLocaleString()}</td>
                                                  <td className="p-4 md:p-6">
                                                      <div className="flex items-center gap-2 justify-center">
                                                          <input
                                                              type="number"
                                                              value={draftVal}
                                                              onChange={e => setEditingPayouts(prev => ({ ...prev, [draftKey]: e.target.value }))}
                                                              className="w-20 bg-black border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-emerald-400"
                                                              placeholder="0"
                                                          />
                                                          <button
                                                              disabled={savingPayout === p.user_id}
                                                              onClick={async () => {
                                                                  setSavingPayout(p.user_id);
                                                                  try {
                                                                      await upsertPromoterPayout(selectedEventFilter, currentUser.user_id, p.user_id, Number(draftVal) || 0);
                                                                      toast.success(`Pago actualizado para ${p.name}`);
                                                                  } catch (e: any) { toast.error(e.message); }
                                                                  finally { setSavingPayout(null); }
                                                              }}
                                                              className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                                                          >
                                                              {savingPayout === p.user_id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                                          </button>
                                                      </div>
                                                  </td>
                                              </tr>
                                          );
                                      });

                                  const totalDiff = totalManagerComm - totalPromoterPay;
                                  return (
                                      <>
                                          {rows}
                                          <tr className="bg-white/5 font-black border-t-2 border-white/10">
                                              <td className="p-4 md:p-6 text-white uppercase tracking-widest">TOTALES</td>
                                              <td className="p-4 md:p-6"></td>
                                              <td className="p-4 md:p-6 text-right text-neon-blue">${totalManagerComm.toLocaleString()}</td>
                                              <td className="p-4 md:p-6 text-right text-emerald-400">${totalPromoterPay.toLocaleString()}</td>
                                              <td className="p-4 md:p-6 text-right text-lg font-black" style={{ color: '#C9A84C' }}>${totalDiff.toLocaleString()}</td>
                                              <td className="p-4 md:p-6"></td>
                                          </tr>
                                      </>
                                  );
                              })()}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* RANKING GENERAL (OCULTO PARA PROMOTORES) */}
      {currentUser.role !== UserRole.PROMOTER && (
          <div className="mt-12 bg-zinc-900 border border-white/5 rounded-[2.5rem] p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                  <div>
                      <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                          <BarChart className="text-amber-500 w-6 h-6" /> Ranking General de Ventas
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1 font-bold">Rendimiento individual por unidades y revenue.</p>
                  </div>
                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                      {/* VIEW MODE SELECTOR */}
                      <div className="bg-black border border-white/10 rounded-xl p-1 flex">
                          <button 
                              onClick={() => setRankingViewMode('promoters')}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rankingViewMode === 'promoters' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                          >
                              Promotores
                          </button>
                          <button 
                              onClick={() => setRankingViewMode('teams')}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${rankingViewMode === 'teams' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
                          >
                              Squads
                          </button>
                      </div>

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
                              <th className="p-4">{rankingViewMode === 'teams' ? 'Squad / Equipo' : 'Promotor'}</th>
                              <th className="p-4 text-right">Tickets (Und)</th>
                              <th className="p-4 text-right">Revenue Generado</th>
                              <th className="p-4 text-right">Comisiones Ganadas</th>
                              <th className="p-4 rounded-r-xl text-center">Auditoría</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                          {generalRankingData.map((p: any, idx) => (
                              <tr key={p.user_id} className="hover:bg-white/5 transition-colors group">
                                  <td className="p-4 font-black text-amber-500 text-lg">{idx + 1}</td>
                                  <td className="p-4">
                                      <div className="font-bold text-white">{p.name}</div>
                                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-zinc-400">
                                          {rankingViewMode === 'teams' ? `Manager: ${p.manager_name || 'N/A'}` : p.role}
                                      </span>
                                  </td>
                                  <td className="p-4 text-right font-black text-white text-base">{p.ticketsSold}</td>
                                  <td className="p-4 text-right font-bold text-emerald-500">${p.revenue.toLocaleString()}</td>
                                  <td className="p-4 text-right font-bold text-neon-blue">${p.commission.toLocaleString()}</td>
                                  <td className="p-4 text-center">
                                      <button onClick={() => rankingViewMode === 'teams' ? setViewingTeamId(p.user_id) : setViewingStaffId(p.user_id)} className="p-2 bg-zinc-800 hover:bg-white/20 rounded-lg text-white transition-all text-[10px] font-bold uppercase flex items-center gap-1 mx-auto">
                                          {rankingViewMode === 'teams' ? <Users size={12}/> : <History size={12}/>} Ver Detalle
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {generalRankingData.length === 0 && (
                              <tr><td colSpan={6} className="p-8 text-center text-zinc-600 font-bold uppercase">No hay datos para este filtro</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* TABLA MIS VENTAS (PROMOTORES Y MANAGERS) */}
      {(currentUser.role === UserRole.PROMOTER || currentUser.role === UserRole.MANAGER) && (
          <div className="mt-12 bg-zinc-900 border border-white/5 rounded-[2.5rem] p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                  <div>
                      <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                          <ScrollText className="text-neon-blue w-6 h-6" /> Mis Ventas & Clientes
                      </h2>
                      <p className="text-xs text-zinc-500 mt-1 font-bold">Registro detallado de tus ventas personales.</p>
                  </div>
                  
                  <div className="flex gap-3 w-full md:w-auto">
                      <select 
                          value={orderFilterEvent} 
                          onChange={e => setOrderFilterEvent(e.target.value)}
                          className="bg-black border border-white/10 rounded-xl px-4 h-10 text-[10px] md:text-xs font-bold text-white uppercase focus:border-neon-blue outline-none flex-1 md:flex-none"
                      >
                          <option value="all">TODOS LOS EVENTOS</option>
                          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                      </select>
                      
                      <button 
                        onClick={() => setShowTopCustomers(!showTopCustomers)}
                        className={`px-4 h-10 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showTopCustomers ? 'bg-neon-blue text-black' : 'bg-white/5 text-zinc-400 border border-white/10'}`}
                      >
                        <Users size={14} /> {showTopCustomers ? 'Ver Ventas' : 'Top Clientes'}
                      </button>
                  </div>
              </div>

              {showTopCustomers ? (
                  <div className="animate-in fade-in duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(() => {
                              const customerStats = orders
                                  .filter(o => o.staff_id === currentUser.user_id && (orderFilterEvent === 'all' || o.event_id === orderFilterEvent))
                                  .reduce((acc: any, o) => {
                                      const email = o.customer_email.toLowerCase();
                                      if (!acc[email]) acc[email] = { name: o.customer_name, email, total: 0, count: 0 };
                                      acc[email].total += o.total;
                                      acc[email].count += 1;
                                      return acc;
                                  }, {});
                              
                              return Object.values(customerStats)
                                  .sort((a: any, b: any) => b.total - a.total)
                                  .slice(0, 12)
                                  .map((c: any, idx) => (
                                      <div key={c.email} className="bg-black/40 border border-white/5 p-5 rounded-2xl flex items-center gap-4">
                                          <div className="w-10 h-10 bg-neon-blue/10 rounded-full flex items-center justify-center text-neon-blue font-black text-sm">
                                              #{idx + 1}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-white font-bold truncate uppercase text-xs tracking-tight">{c.name}</p>
                                              <p className="text-[10px] text-zinc-500 truncate">{c.email}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-white font-black text-sm">${c.total.toLocaleString()}</p>
                                              <p className="text-[9px] text-zinc-600 font-bold uppercase">{c.count} Compras</p>
                                          </div>
                                      </div>
                                  ));
                          })()}
                      </div>
                  </div>
              ) : (
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-black/40 text-[9px] md:text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                              <tr>
                                  <th className="p-4 rounded-l-xl">Fecha</th>
                                  <th className="p-4">Cliente</th>
                                  <th className="p-4">Items / Etapa</th>
                                  <th className="p-4 text-right">Total</th>
                                  <th className="p-4 rounded-r-xl text-center">Estado</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                              {orders
                                  .filter(o => o.staff_id === currentUser.user_id && (orderFilterEvent === 'all' || o.event_id === orderFilterEvent))
                                  .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                  .map(order => (
                                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                                      <td className="p-4 text-zinc-400">
                                          {new Date(order.timestamp).toLocaleDateString()} <br/>
                                          <span className="text-[10px]">{new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </td>
                                      <td className="p-4">
                                          <div className="font-bold text-white">{order.customer_name}</div>
                                          <div className="text-[10px] text-zinc-500">{order.customer_email || 'Sin email'}</div>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex flex-col gap-1">
                                              {order.items.map((item, idx) => (
                                                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                                                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">{item.quantity}x</span>
                                                      <span className="text-zinc-300">{item.tier_name}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      </td>
                                      <td className="p-4 text-right font-black text-emerald-500">
                                          ${order.total.toLocaleString()}
                                      </td>
                                      <td className="p-4 text-center">
                                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                              {order.status === 'completed' ? 'Aprobado' : order.status}
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                              {orders.filter(o => o.staff_id === currentUser.user_id && (orderFilterEvent === 'all' || o.event_id === orderFilterEvent)).length === 0 && (
                                  <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-bold uppercase">No hay ventas registradas para este filtro.</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>
      )}

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
                                        const soldTickets = orders
                                            .filter(o => o.status === 'completed')
                                            .flatMap(o => o.items || [])
                                            .filter(i => i.tier_id === tier.id)
                                            .reduce((s, i) => s + (i.quantity || 1), 0);
                                        const available = tier.quantity - soldTickets;
                                        const soldOut = available <= 0;
                                        const atLimit = inCart >= available;
                                        return (
                                            <div key={tier.id} className={`flex justify-between items-center bg-zinc-800/50 p-2 rounded-lg ${soldOut ? 'opacity-40' : ''}`}>
                                                <div>
                                                    <p className="text-xs font-bold text-white">{tier.name}</p>
                                                    <p className="text-[10px] text-zinc-500">${tier.price.toLocaleString()}</p>
                                                    {soldOut && <p className="text-[9px] font-bold text-red-400 mt-0.5">AGOTADO</p>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => updateCart(tier.id, Math.max(0, inCart - 1))} disabled={inCart === 0} className="w-6 h-6 bg-zinc-700 rounded-full text-white hover:bg-zinc-600 flex items-center justify-center font-bold disabled:opacity-30">-</button>
                                                    <span className="font-bold text-white w-4 text-center text-sm">{inCart}</span>
                                                    <button onClick={() => updateCart(tier.id, inCart + 1)} disabled={atLimit || soldOut} className="w-6 h-6 bg-zinc-700 rounded-full text-white hover:bg-zinc-600 flex items-center justify-center font-bold disabled:opacity-30 disabled:cursor-not-allowed">+</button>
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
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Email del Cliente (Obligatorio)</label>
                                <input value={manualCustomerInfo.email} onChange={e => setManualCustomerInfo({...manualCustomerInfo, email: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold" placeholder="email@cliente.com" required />
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

                        <Button onClick={handleManualSale} disabled={isProcessingSale || cart.length === 0 || !selectedEventId || !manualCustomerInfo.email.includes('@')} fullWidth className="bg-white text-black font-black h-14 text-sm rounded-xl hover:bg-zinc-200">
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
                                <input
                                    value={newStaffCode}
                                    onChange={e => setNewStaffCode(e.target.value.replace(/\s/g, '').toUpperCase())}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-black uppercase tracking-widest text-center focus:border-neon-purple outline-none"
                                    placeholder="EJ: ANA2024"
                                />
                                <p className="text-[9px] text-zinc-600 mt-1 font-mono">Sin espacios · Solo letras y números</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Email (para inicio de sesión)</label>
                                <input type="email" value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-mono focus:border-neon-purple outline-none" placeholder="promotor@gmail.com" />
                            </div>

                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Asignar a Squad</label>
                                <select 
                                    value={selectedRecruitmentTeamId} 
                                    onChange={e => setSelectedRecruitmentTeamId(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 h-12 text-sm text-white font-bold focus:border-neon-purple outline-none appearance-none"
                                >
                                    {isAdmin && <option value="">-- Independiente (Sin Squad) --</option>}
                                    {recruitableTeams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="bg-zinc-800/50 p-4 rounded-xl border border-white/5 mt-2">
                                <p className="text-[10px] text-zinc-400 leading-relaxed">
                                    <span className="text-neon-purple font-bold">NOTA:</span> {selectedRecruitmentTeamId ? `El promotor será asignado al equipo seleccionado.` : `El promotor quedará como Independiente (sin Manager directo).`}
                                </p>
                            </div>

                            <Button onClick={handleManagerRecruit} disabled={!newStaffName || !newStaffEmail} fullWidth className="bg-white text-black font-black h-14 text-sm rounded-xl hover:bg-zinc-200 mt-2">
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
                                    {recruitableTeams.map(team => (
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

      {/* MODAL DETALLE PROMOTOR (Ranking General - modo promotores) */}
      <AnimatePresence>
        {viewingStaffId && (() => {
            const staffData = (generalRankingData as any[]).find((p: any) => p.user_id === viewingStaffId);
            if (!staffData) return null;
            return (
              <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-4xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setViewingStaffId(null)} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                  <div className="mb-6">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                      <User className="text-neon-purple"/> {staffData.name}
                    </h2>
                    <p className="text-zinc-500 font-bold uppercase text-xs mt-1">
                      {staffData.role} · Código: {staffData.code}
                    </p>
                    <div className="flex gap-6 mt-4">
                      <div><p className="text-[9px] text-zinc-500 uppercase font-bold">Tickets</p><p className="text-2xl font-black text-white">{staffData.ticketsSold}</p></div>
                      <div><p className="text-[9px] text-zinc-500 uppercase font-bold">Revenue</p><p className="text-2xl font-black text-emerald-400">${staffData.revenue.toLocaleString()}</p></div>
                      <div><p className="text-[9px] text-zinc-500 uppercase font-bold">Comisión</p><p className="text-2xl font-black text-neon-blue">${staffData.commission.toLocaleString()}</p></div>
                    </div>
                  </div>
                  <div className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden">
                    <div className="bg-zinc-800/50 p-3 border-b border-white/5 flex items-center gap-2">
                      <ScrollText size={14} className="text-neon-purple"/>
                      <span className="text-xs font-black text-white uppercase tracking-widest">Historial de Ventas ({staffData.orders?.length || 0} órdenes)</span>
                    </div>
                    {staffData.orders && staffData.orders.length > 0 ? (
                      <table className="w-full text-left text-[10px] md:text-xs">
                        <thead className="bg-black/20 text-zinc-500 uppercase font-bold">
                          <tr>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Cliente</th>
                            <th className="p-3">Boleta</th>
                            <th className="p-3 text-right">Método</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                          {staffData.orders.map((o: any) => (
                            <tr key={o.id} className="hover:bg-white/5">
                              <td className="p-3 text-zinc-500">{new Date(o.timestamp).toLocaleDateString()} {new Date(o.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                              <td className="p-3 font-bold text-white">{o.customer_name}</td>
                              <td className="p-3">{o.items?.map((i: any) => i.tier_name).join(', ')}</td>
                              <td className="p-3 text-right capitalize">{o.payment_method}</td>
                              <td className="p-3 text-right font-bold text-emerald-400">${o.total?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="p-8 text-center text-zinc-600 text-xs uppercase font-bold">Sin ventas registradas</p>
                    )}
                  </div>
                </motion.div>
              </div>
            );
        })()}
      </AnimatePresence>

      {showScanner && (
        <QRScanner
          eventId={scannerEventId}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};