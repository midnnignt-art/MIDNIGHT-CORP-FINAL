import React, { useState, useMemo, useEffect } from 'react';
import { toast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import {
    Trash2, Plus, Pencil, Save, Users, ShieldCheck,
    UserCog, BadgeCheck, Database, Download, Upload, AlertTriangle,
    HardDrive, RefreshCcw, Layers, Target, UserPlus, Calendar, MapPin, DollarSign, Ticket, Eye, ArrowLeft, Search, User, Filter, Share2, CheckCircle2, XCircle, MinusCircle, Lock, Key, X, UserMinus, UserCheck, Mail,
    Tag, Percent, Loader2, EyeOff
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Button } from '../components/ui/button';
import { UserRole, TicketTier, EventCost, Event, Promoter, SalesTeam, Order } from '../types';
import { Progress } from '../components/ui/progress';
import { motion as _motion, AnimatePresence } from 'framer-motion';

const motion = _motion as any;

interface AdminEventsProps {
    role: UserRole;
}

export const AdminEvents: React.FC<AdminEventsProps> = ({ role }) => {
    const {
        events, addEvent, updateEvent, archiveEvent, restoreEvent, hardDeleteEvent, setEventStatus, getEventTiers,
        promoters, addStaff, updateStaff, deleteStaff, teams, createTeam, updateStaffTeam, deleteTeam,
        superSquads, createSuperSquad, deleteSuperSquad, assignTeamToSuperSquad,
        orders, dbStatus, clearDatabase, fetchData
    } = useStore();
    
    const [activeTab, setActiveTab] = useState<'events' | 'archived' | 'staff' | 'system'>('events');
    const [staffView, setStaffView] = useState<'all' | 'teams'>('all');
    
    // --- ESTADO: Navegación de Detalles de Evento ---
    const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

    // --- ESTADO: Campañas & Participantes del evento seleccionado ---
    interface EventCampaignLead { id: string; name: string; email: string; benefit: string | null; registered_at: string; campaign_id: string; }
    interface EventCampaignInfo { id: string; label: string; type: 'guest_list' | 'discount' | 'ruleta'; code: string; discount_pct: number | null; tier_name: string | null; leads: EventCampaignLead[]; }
    const [eventCampaigns, setEventCampaigns] = useState<EventCampaignInfo[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);

    useEffect(() => {
        if (!selectedAuditId) return;
        setCampaignsLoading(true);
        setEventCampaigns([]);
        (async () => {
            const { data: camps } = await supabase
                .from('campaigns')
                .select('id, label, type, code, discount_pct, tier_name')
                .eq('event_id', selectedAuditId);
            if (!camps || camps.length === 0) { setCampaignsLoading(false); return; }
            const ids = camps.map((c: any) => c.id);
            const { data: leads } = await supabase
                .from('campaign_leads')
                .select('id, name, email, benefit, registered_at, campaign_id')
                .in('campaign_id', ids)
                .order('registered_at', { ascending: false });
            const leadsArr = (leads ?? []) as EventCampaignLead[];
            setEventCampaigns(
                (camps as any[]).map(c => ({
                    ...c,
                    leads: leadsArr.filter(l => l.campaign_id === c.id),
                }))
            );
            setCampaignsLoading(false);
        })();
    }, [selectedAuditId]);

    // --- STATE: Event Creation/Edit ---
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventForm, setEventForm] = useState({
        title: '', description: '', venue: '', city: '', 
        date: '', time: '', cover_image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'
    });
    
    const [tierRows, setTierRows] = useState<any[]>([
        { id: undefined, name: 'General Early Bird', price: 50, commission_manager: 0, commission_promoter_min: 0, quantity: 100, stage: 'early_bird' },
        { id: undefined, name: 'VIP Access', price: 150, commission_manager: 0, commission_promoter_min: 0, quantity: 50, stage: 'presale' }
    ]);

    // --- STATE: Squad/Staff Form ---
    const [newTeamName, setNewTeamName] = useState('');
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [viewingTeamEditId, setViewingTeamEditId] = useState<string | null>(null);

    // --- STATE: Super Squad ---
    const [newSuperSquadName, setNewSuperSquadName] = useState('');
    const [newSuperSquadHeadId, setNewSuperSquadHeadId] = useState('');
    const [squadAssignTeamId, setSquadAssignTeamId] = useState('');
    const [squadAssignSuperSquadId, setSquadAssignSuperSquadId] = useState('');

    // --- STATE: Edit Staff ---
    const [editingStaff, setEditingStaff] = useState<any | null>(null);
    const [editForm, setEditForm] = useState({ name: '', code: '', role: '', password: '' });
    const [isSavingStaff, setIsSavingStaff] = useState(false);

    // --- STATE: Edit Super Squad ---
    const [editingSuperSquad, setEditingSuperSquad] = useState<any | null>(null);
    const [editSsName, setEditSsName] = useState('');
    const [editSsHeadId, setEditSsHeadId] = useState('');
    
    // Staff Creation State
    const [staffName, setStaffName] = useState('');
    const [staffCode, setStaffCode] = useState(''); // LOGIN CREDENTIAL 1
    const [staffPassword, setStaffPassword] = useState('1234'); // LOGIN CREDENTIAL 2
    const [staffEmail, setStaffEmail] = useState(''); 
    const [staffRole, setStaffRole] = useState<'PROMOTER' | 'MANAGER' | 'HEAD_OF_SALES'>('PROMOTER');

    if (role !== UserRole.ADMIN) {
        return <div className="pt-32 text-center text-red-500 font-bold">ACCESO NO AUTORIZADO</div>;
    }

    // --- AUDITORÍA DE EVENTO: Cálculos ---
    const auditData = useMemo(() => {
        if (!selectedAuditId) return null;
        const event = events.find(e => e.id === selectedAuditId);
        if (!event) return null;

        const eventOrders = orders.filter(o => o.event_id === selectedAuditId && o.status === 'completed');
        // salesOrders excludes guest_list for financial calcs (liquidations, ranking, revenue)
        const salesOrders = eventOrders.filter(o => o.payment_method !== 'guest_list');
        const tiers = getEventTiers(selectedAuditId);

        // Ranking (financial — no guest_list)
        const rankingMap: {[key: string]: {name: string, tickets: number, revenue: number}} = {};
        salesOrders.forEach(o => {
            const pid = o.staff_id || 'organica';
            const pname = promoters.find(p => p.user_id === pid)?.name || 'Venta Directa';
            const tqty = o.items.reduce((acc, i) => acc + i.quantity, 0);
            
            if (!rankingMap[pid]) rankingMap[pid] = { name: pname, tickets: 0, revenue: 0 };
            rankingMap[pid].tickets += tqty;
            rankingMap[pid].revenue += o.total;
        });

        const sortedRanking = Object.entries(rankingMap)
            .sort(([, a], [, b]) => b.tickets - a.tickets)
            .map(([id, data]) => ({ id, ...data }));

        // Breakdown por Etapa (Tiers)
        const tierStats = tiers.map(tier => {
            const sold = eventOrders.reduce((acc, o) => {
                return acc + o.items.filter(i => i.tier_id === tier.id).reduce((s, i) => s + i.quantity, 0);
            }, 0);
            return {
                ...tier,
                realSold: sold,
                progress: Math.min((sold / tier.quantity) * 100, 100)
            };
        });

        // Stage Groups with revenue (using salesOrders for financial data)
        const stageGroups = Array.from(new Set(tiers.map(t => t.stage))).map(stage => {
            const stageTiers = tierStats.filter(t => t.stage === stage);
            const totalQty   = stageTiers.reduce((acc, t) => acc + t.quantity, 0);
            const totalSold  = stageTiers.reduce((acc, t) => acc + t.realSold, 0);
            const revenue    = salesOrders.reduce((acc, o) =>
                acc + o.items.filter(i => stageTiers.some(t => t.id === i.tier_id))
                             .reduce((s, i) => s + i.subtotal, 0), 0);
            return {
                stage,
                totalQty,
                totalSold,
                progress: totalQty > 0 ? (totalSold / totalQty) * 100 : 0,
                revenue,
            };
        });

        return { event, eventOrders, salesOrders, tiers, sortedRanking, tierStats, stageGroups };
    }, [selectedAuditId, events, orders, promoters]);

    // --- HELPER: TEAM EDITING ---
    const teamToEdit = teams.find(t => t.id === viewingTeamEditId);
    const teamMembers = promoters.filter(p => p.sales_team_id === viewingTeamEditId);
    const availableStaff = promoters.filter(p => !p.sales_team_id && p.role !== UserRole.ADMIN);

    // --- HANDLERS: Event ---
    const handleAddTierRow = () => {
        setTierRows([...tierRows, { id: undefined, name: '', price: 0, commission_manager: 0, commission_promoter_min: 0, quantity: 0, stage: 'general' }]);
    };

    const handleRemoveTierRow = (index: number) => {
        setTierRows(tierRows.filter((_, i) => i !== index));
    };

    const handleTierChange = (index: number, field: string, value: any) => {
        const newTiers = [...tierRows];
        newTiers[index] = { ...newTiers[index], [field]: value };
        setTierRows(newTiers);
    };

    const handleEditEvent = (event: Event) => {
        setEditingEventId(event.id);
        setEventForm({
            title: event.title,
            description: event.description,
            venue: event.venue,
            city: event.city,
            date: event.event_date.split('T')[0],
            time: event.doors_open,
            cover_image: event.cover_image
        });
        const currentTiers = getEventTiers(event.id);
        setTierRows(currentTiers.map(t => ({
            id: t.id,
            name: t.name,
            price: t.price,
            commission_manager: t.commission_manager || t.commission_fixed || 0,
            commission_promoter_min: t.commission_promoter_min || 0,
            quantity: t.quantity,
            stage: t.stage
        })));
        setIsCreatingEvent(true);
    };

    const compressImage = (base64Str: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; // Better quality for event covers
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality
            };
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("Máx 5MB por foto.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result as string);
                setEventForm({ ...eventForm, cover_image: compressed });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCreateOrUpdateEvent = async () => {
        if (!eventForm.title || !eventForm.date) { toast.error("Faltan datos básicos del evento"); return; }

        const eventData = {
            title: eventForm.title,
            description: eventForm.description,
            venue: eventForm.venue,
            city: eventForm.city,
            event_date: `${eventForm.date}T${eventForm.time || '20:00'}:00-05:00`,
            doors_open: eventForm.time || '20:00',
            cover_image: eventForm.cover_image
        };

        const cleanTiers: any[] = tierRows.map(t => ({
            id: t.id,
            name: t.name,
            price: Number(t.price) || 0,
            quantity: Number(t.quantity) || 0,
            commission_manager: Number(t.commission_manager) || 0,
            commission_promoter_min: Number(t.commission_promoter_min) || 0,
            stage: t.stage || 'general'
        }));

        try {
            if (editingEventId) {
                await updateEvent(editingEventId, eventData, cleanTiers);
                toast.success("Evento actualizado correctamente");
            } else {
                await addEvent(eventData, cleanTiers);
                toast.success("Evento creado correctamente");
            }
            setIsCreatingEvent(false);
            setEditingEventId(null);
            setEventForm({ title: '', description: '', venue: '', city: '', date: '', time: '', cover_image: '' });
            setTierRows([{ id: undefined, name: 'General', price: 0, commission_manager: 0, commission_promoter_min: 0, quantity: 0, stage: 'general' }]);
        } catch (e: any) {
            toast.error(`Error: ${e.message}`);
        }
    };

    const cancelEdit = () => {
        setIsCreatingEvent(false);
        setEditingEventId(null);
        setEventForm({ title: '', description: '', venue: '', city: '', date: '', time: '', cover_image: '' });
        setTierRows([{ id: undefined, name: 'General', price: 0, commission_manager: 0, commission_promoter_min: 0, quantity: 0, stage: 'general' }]);
    };

    const handleCreateTeam = () => {
        if (!newTeamName) { toast.error("Ingresa un nombre para el equipo."); return; }
        if (!selectedManagerId) { toast.error("Debes seleccionar un manager."); return; }
        createTeam(newTeamName, selectedManagerId);
        setNewTeamName(''); setSelectedManagerId('');
        toast.success('Squad creado exitosamente');
    };

    const handleCreateStaff = async () => {
        if (!staffName || !staffEmail) { toast.error("Nombre y Email son obligatorios."); return; }
        if (!staffEmail.includes('@')) { toast.error("Ingresa un email válido para el login OTP."); return; }

        const finalCode = staffCode.toUpperCase() || staffEmail.split('@')[0].toUpperCase();

        try {
            await addStaff({
                name: staffName,
                code: finalCode,
                email: staffEmail.toLowerCase().trim(),
                role: staffRole
            });
            setStaffName(''); setStaffCode(''); setStaffEmail('');
            toast.success(`Staff registrado. Login con email: ${staffEmail.toLowerCase().trim()}`);
        } catch (error: any) {
            toast.error(`Error al registrar staff: ${error.message || 'Verifica que el email no esté duplicado.'}`);
        }
    };

    const handleDeleteTeam = async (id: string) => {
        if (confirm('¿Eliminar equipo? Los miembros quedarán como independientes.')) {
            await deleteTeam(id);
            setViewingTeamEditId(null);
        }
    };

    const handleExportDatabase = async () => {
        if (!auditData) return;
        const XLSX = await import('xlsx');
        const rows: any[] = [];
        auditData.eventOrders.forEach(order => {
            const promoterName = promoters.find(p => p.user_id === order.staff_id)?.name || 'Venta Directa';
            order.items.forEach(item => {
                const tier = auditData.tiers.find(t => t.id === item.tier_id);
                rows.push({
                    'Nombre Cliente': order.customer_name,
                    'Correo Electrónico': order.customer_email,
                    'Cantidad': item.quantity,
                    'Tipo Boleta': item.tier_name,
                    'Valor Total ($)': item.subtotal,
                    'Fecha Compra': new Date(order.timestamp).toLocaleString('es-CO'),
                    'Medio de Pago': order.payment_method,
                    'Promotor': promoterName,
                    'Etapa': tier?.stage || 'general',
                });
            });
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 24 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
        XLSX.writeFile(wb, `DB_Ventas_${auditData.event.title.replace(/\s+/g, '_')}.xlsx`);
        toast.success('Base de datos exportada correctamente');
    };

    return (
        <div className="min-h-screen pt-24 px-4 max-w-7xl mx-auto pb-12">
            
            {/* Nav Tabs */}
            {!selectedAuditId && (
                <div className="flex gap-4 mb-8 border-b border-white/5 overflow-x-auto">
                    <button onClick={() => setActiveTab('events')} className={`pb-4 px-4 font-black transition-all whitespace-nowrap ${activeTab === 'events' ? 'text-white border-b-2 border-neon-purple' : 'text-zinc-600'}`}>
                        LANZAMIENTO
                    </button>
                    <button onClick={() => setActiveTab('archived')} className={`pb-4 px-4 font-black transition-all whitespace-nowrap ${activeTab === 'archived' ? 'text-white border-b-2 border-zinc-500' : 'text-zinc-600'}`}>
                        CEMENTERIO (ARCHIVADOS)
                    </button>
                    <button onClick={() => setActiveTab('staff')} className={`pb-4 px-4 font-black transition-all whitespace-nowrap ${activeTab === 'staff' ? 'text-white border-b-2 border-neon-blue' : 'text-zinc-600'}`}>
                        ESTRUCTURA STAFF
                    </button>
                    <button onClick={() => setActiveTab('system')} className={`pb-4 px-4 font-black transition-all whitespace-nowrap ${activeTab === 'system' ? 'text-white border-b-2 border-emerald-500' : 'text-zinc-600'}`}>
                        SISTEMA
                    </button>
                </div>
            )}

            {activeTab === 'events' && (
                <div className="space-y-6">

                    {/* ── Event selector row ── */}
                    {!isCreatingEvent && (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                value={selectedAuditId ?? ''}
                                onChange={e => setSelectedAuditId(e.target.value || null)}
                                className="flex-1 bg-zinc-900 border border-white/10 rounded-2xl px-5 py-3.5 text-white font-black text-sm focus:outline-none focus:border-neon-purple/40 appearance-none cursor-pointer"
                            >
                                <option value="">— Seleccionar evento —</option>
                                {events.filter(e => e.status !== 'archived').map(ev => (
                                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                                ))}
                            </select>
                            <div className="flex gap-2 flex-shrink-0">
                                {selectedAuditId && auditData && (
                                    <>
                                        <Button onClick={() => handleEditEvent(auditData.event)} variant="outline" className="h-12"><Pencil size={16}/></Button>
                                        {auditData.event.status === 'draft' ? (
                                            <Button
                                                onClick={async () => { await setEventStatus(selectedAuditId, 'published'); }}
                                                variant="outline"
                                                title="Activar en vitrina"
                                                className="h-12 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400"
                                            ><Eye size={16}/></Button>
                                        ) : (
                                            <Button
                                                onClick={async () => { await setEventStatus(selectedAuditId, 'draft'); }}
                                                variant="outline"
                                                title="Ocultar de vitrina"
                                                className="h-12 border-zinc-500/30 hover:bg-zinc-500/10 text-zinc-400"
                                            ><EyeOff size={16}/></Button>
                                        )}
                                        <Button
                                            onClick={async () => {
                                                if (confirm(`¿ELIMINAR permanentemente "${auditData.event.title}"? No se puede deshacer.`)) {
                                                    await hardDeleteEvent(selectedAuditId);
                                                    setSelectedAuditId(null);
                                                }
                                            }}
                                            variant="outline"
                                            className="h-12 border-red-500/30 hover:bg-red-500/10 text-red-500"
                                        ><Trash2 size={16}/></Button>
                                        <Button onClick={handleExportDatabase} className="bg-emerald-500 text-black font-black text-xs h-12">
                                            <Download className="mr-2 w-4 h-4"/> Exportar
                                        </Button>
                                    </>
                                )}
                                <Button onClick={() => { setIsCreatingEvent(true); setEditingEventId(null); setTierRows([{id: undefined, name: 'General', price: 0, commission_manager: 0, commission_promoter_min: 0, quantity: 0, stage: 'general'}]) }} className="bg-neon-purple text-white font-black h-12">
                                    <Plus className="mr-2" size={16}/> Nuevo
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Content ── */}
                    {isCreatingEvent ? null : !selectedAuditId ? (
                        <div className="py-20 text-center text-zinc-600 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                            Selecciona un evento para ver su información
                        </div>
                    ) : null}

                    {!isCreatingEvent && selectedAuditId && auditData && (
                        <div className="animate-in fade-in duration-400 space-y-8">

                            {/* ── Stage banners ── */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {auditData.stageGroups.map(sg => {
                                    const pct = Math.round(sg.progress);
                                    const stageLabel: Record<string, string> = {
                                        early_bird: 'Early Bird', presale: 'Preventa',
                                        general: 'General', door: 'Puerta'
                                    };
                                    return (
                                        <div key={sg.stage} className="bg-zinc-900 border border-white/8 rounded-2xl p-5">
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">{stageLabel[sg.stage] ?? sg.stage}</p>
                                            <p className="text-3xl font-black text-white tabular-nums leading-none">{sg.totalSold}</p>
                                            <p className="text-[10px] text-zinc-600 mb-3 mt-0.5">/ {sg.totalQty} boletos</p>
                                            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
                                                <div className="h-full bg-neon-purple rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                            </div>
                                            <p className="text-sm font-black text-neon-green tabular-nums">${sg.revenue.toLocaleString()}</p>
                                            <p className="text-[9px] text-zinc-600">{pct}% vendido</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Existing audit content (no header row) ── */}
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-8">
                                    {/* CONTROL DE ACCESO (REAL TIME) */}
                                    <div className="bg-zinc-900 border border-[#490F7C]/30 p-8 rounded-[2.5rem] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-neon-purple rounded-full animate-pulse"></div>
                                                <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">Live</span>
                                            </div>
                                        </div>
                                        
                                        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                                            <ShieldCheck className="text-neon-purple"/> Control de Acceso
                                        </h3>

                                        {(() => {
                                            const totalTickets = auditData.eventOrders.reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0);
                                            const scannedTickets = auditData.eventOrders.filter(o => o.used).reduce((acc, o) => acc + o.items.reduce((s, i) => s + i.quantity, 0), 0);
                                            const occupancy = totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0;

                                            return (
                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-4xl font-black text-white tracking-tighter">
                                                                {scannedTickets} <span className="text-xl text-zinc-600">/ {totalTickets}</span>
                                                            </p>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Tickets Escaneados</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-black text-neon-purple">{Math.round(occupancy)}%</p>
                                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Ocupación</p>
                                                        </div>
                                                    </div>

                                                    <div className="h-4 bg-[#161344] rounded-full overflow-hidden border border-white/5">
                                                        <motion.div 
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${occupancy}%` }}
                                                            className="h-full bg-[#490F7C] rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* PROGRESS BAR PER STAGE */}
                                    <div className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem]">
                                        <h3 className="text-xl font-black text-white mb-6">Progreso Comercial por Etapa</h3>
                                        <div className="space-y-6">
                                            {auditData.stageGroups.map(stage => (
                                                <div key={stage.stage} className="space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-xs font-bold text-white uppercase tracking-widest">{stage.stage.replace('_', ' ')}</span>
                                                        <span className="text-xs font-mono text-zinc-400">{stage.totalSold} / {stage.totalQty}</span>
                                                    </div>
                                                    <Progress value={stage.progress} className="h-3 bg-zinc-800" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* DETAIL TIERS */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {auditData.tierStats.map(t => (
                                            <div key={t.id} className="bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                                                <p className="text-xs text-zinc-500 uppercase font-bold">{t.name}</p>
                                                <p className="text-xl font-black text-white mt-1">{t.realSold} <span className="text-xs font-normal text-zinc-600">vendidos</span></p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-1 space-y-8">
                                    <div className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem]">
                                        <h3 className="text-xl font-black text-white mb-6">Ranking del Evento</h3>
                                        {auditData.sortedRanking.slice(0, 10).map((rank, idx) => (
                                            <div key={rank.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl mb-2">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black text-zinc-600 w-4">{idx + 1}</span>
                                                    <span className="text-sm font-bold text-white">{rank.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-neon-green">${rank.revenue.toLocaleString()}</p>
                                                    <p className="text-[9px] text-zinc-500">{rank.tickets} tickets</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* ── Campañas & Participantes ── */}
                            <div className="mt-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <Tag className="text-[#C9A84C]" size={18} />
                                    <h3 className="text-xl font-black text-white">Campañas & Participantes</h3>
                                    {campaignsLoading && <Loader2 size={14} className="animate-spin text-zinc-500" />}
                                </div>

                                {!campaignsLoading && eventCampaigns.length === 0 && (
                                    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-8 text-center">
                                        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No hay campañas para este evento</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {eventCampaigns.map(camp => {
                                        const typeColor  = camp.type === 'guest_list' ? '#4A9EFF' : camp.type === 'discount' ? '#4ADE80' : '#C9A84C';
                                        const typeLabel  = camp.type === 'guest_list' ? 'Guest List' : camp.type === 'discount' ? 'Descuento' : 'Ruleta';
                                        const TypeIcon   = camp.type === 'guest_list' ? Users : camp.type === 'discount' ? Percent : Tag;
                                        return (
                                            <div key={camp.id} className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden">
                                                {/* Campaign header */}
                                                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <TypeIcon size={14} style={{ color: typeColor }} />
                                                        <span className="text-white font-black text-sm">{camp.label}</span>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ color: typeColor, borderColor: typeColor + '40', background: typeColor + '15', fontFamily: 'monospace' }}>
                                                            {typeLabel}
                                                        </span>
                                                        {camp.type === 'discount' && camp.discount_pct && (
                                                            <span className="text-[9px] font-bold text-[#4ADE80]" style={{ fontFamily: 'monospace' }}>
                                                                {camp.discount_pct}% off{camp.tier_name ? ` · ${camp.tier_name}` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-zinc-600" style={{ fontFamily: 'monospace' }}>
                                                        {camp.leads.length} participante{camp.leads.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>

                                                {/* Leads table */}
                                                {camp.leads.length === 0 ? (
                                                    <div className="px-6 py-5 text-center text-zinc-600 text-xs font-bold uppercase tracking-widest">
                                                        Sin registros
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead>
                                                                <tr className="border-b border-white/5">
                                                                    {['Nombre', 'Email', ...(camp.type === 'ruleta' ? ['Beneficio'] : []), 'Fecha'].map(h => (
                                                                        <th key={h} className="text-left px-6 py-3 text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">
                                                                            {h}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {camp.leads.map(l => (
                                                                    <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                                                        <td className="px-6 py-3 text-white/80 font-medium">{l.name}</td>
                                                                        <td className="px-6 py-3 text-zinc-500 text-xs" style={{ fontFamily: 'monospace' }}>{l.email}</td>
                                                                        {camp.type === 'ruleta' && (
                                                                            <td className="px-6 py-3">
                                                                                {l.benefit ? (
                                                                                    <span className="text-[#C9A84C] text-xs font-bold" style={{ fontFamily: 'monospace' }}>{l.benefit}</span>
                                                                                ) : (
                                                                                    <span className="text-zinc-600 text-xs">—</span>
                                                                                )}
                                                                            </td>
                                                                        )}
                                                                        <td className="px-6 py-3 text-zinc-600 text-[10px]" style={{ fontFamily: 'monospace' }}>
                                                                            {new Date(l.registered_at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                        </div>
                    )}

                    {isCreatingEvent && (
                        <div className="bg-zinc-900 border border-white/10 p-8 rounded-[2rem] max-w-4xl mx-auto">
                            <h2 className="text-2xl font-black text-white mb-6">Configurar Evento</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Detalles Generales</label>
                                    <input value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white" placeholder="Título del Evento" />
                                    <input value={eventForm.venue} onChange={e => setEventForm({...eventForm, venue: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white" placeholder="Lugar / Venue" />
                                    <div className="flex gap-4">
                                        <input type="date" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white" />
                                        <input type="time" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white" />
                                    </div>
                                    <input value={eventForm.city} onChange={e => setEventForm({...eventForm, city: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white" placeholder="Ciudad" />
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Multimedia</label>
                                    <div className="flex gap-2">
                                        <input 
                                            value={eventForm.cover_image.startsWith('data:') ? 'Imagen Subida' : eventForm.cover_image} 
                                            onChange={e => setEventForm({...eventForm, cover_image: e.target.value})} 
                                            disabled={eventForm.cover_image.startsWith('data:')}
                                            className="flex-1 bg-black border border-white/10 p-3 rounded-xl text-white text-xs disabled:opacity-50" 
                                            placeholder="URL Imagen Portada" 
                                        />
                                        <label className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-xl cursor-pointer transition-colors flex items-center justify-center">
                                            <Upload className="w-5 h-5 text-white" />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </label>
                                        {eventForm.cover_image && (
                                            <button 
                                                onClick={() => setEventForm({...eventForm, cover_image: ''})}
                                                className="bg-red-500/20 hover:bg-red-500/40 p-3 rounded-xl text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="aspect-video rounded-xl overflow-hidden bg-black border border-white/5 relative group">
                                        {eventForm.cover_image ? (
                                            <img src={eventForm.cover_image} className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
                                                <Calendar size={48} className="mb-2 opacity-20" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Sin Imagen</span>
                                            </div>
                                        )}
                                    </div>
                                    <textarea value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white h-24" placeholder="Descripción del evento..." />
                                </div>
                            </div>
                            
                            {/* --- SECCIÓN DE ETAPAS --- */}
                            <div className="border-t border-white/10 pt-8 mb-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-white flex items-center gap-2"><Ticket className="text-neon-purple"/> Etapas / Tickets</h3>
                                    <Button onClick={handleAddTierRow} variant="outline" size="sm"><Plus className="w-4 h-4 mr-2"/> Agregar Etapa</Button>
                                </div>
                                <div className="space-y-4">
                                    {tierRows.map((tier, idx) => (
                                        <div key={idx} className="bg-black/40 p-4 rounded-xl border border-white/5 grid grid-cols-2 md:grid-cols-12 gap-4 items-end animate-in slide-in-from-left-4">
                                            <div className="col-span-2 md:col-span-3">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre Etapa</label>
                                                <input value={tier.name} onChange={e => handleTierChange(idx, 'name', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-purple" placeholder="Ej: Early Bird" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Precio</label>
                                                <input type="number" value={tier.price} onChange={e => handleTierChange(idx, 'price', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-green" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold text-neon-blue">Com. Manager</label>
                                                <input type="number" value={tier.commission_manager} onChange={e => handleTierChange(idx, 'commission_manager', e.target.value)} className="w-full bg-transparent border-b border-neon-blue/30 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-blue" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold text-emerald-400">Com. Promotor Mín</label>
                                                <input type="number" value={tier.commission_promoter_min} onChange={e => handleTierChange(idx, 'commission_promoter_min', e.target.value)} className="w-full bg-transparent border-b border-emerald-500/30 py-2 text-white font-bold text-sm focus:outline-none focus:border-emerald-400" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Cantidad</label>
                                                <input type="number" value={tier.quantity} onChange={e => handleTierChange(idx, 'quantity', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-white" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-1 flex justify-end">
                                                <button onClick={() => handleRemoveTierRow(idx)} className="text-zinc-600 hover:text-red-500 transition-colors pb-2"><MinusCircle/></button>
                                            </div>
                                            <div className="col-span-2 md:col-span-12">
                                                 <label className="text-[10px] text-zinc-500 uppercase font-bold">Tipo de Etapa (Sistema)</label>
                                                 <select
                                                    value={tier.stage}
                                                    onChange={e => handleTierChange(idx, 'stage', e.target.value)}
                                                    className="w-full bg-black border border-white/10 p-2 rounded text-xs text-white uppercase font-bold mt-1"
                                                 >
                                                     <option value="early_bird">Early Bird</option>
                                                     <option value="presale">Preventa</option>
                                                     <option value="general">General</option>
                                                     <option value="door">Puerta</option>
                                                 </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* ------------------------------------- */}

                            <div className="flex gap-4 pt-6 border-t border-white/10">
                                <Button onClick={handleCreateOrUpdateEvent} className="bg-white text-black font-black h-12 flex-1">GUARDAR EVENTO</Button>
                                <Button onClick={cancelEdit} variant="outline" className="h-12">CANCELAR</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'archived' && (
                <div className="space-y-6">
                    <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                        <h2 className="text-2xl font-black text-white">Cementerio de Eventos</h2>
                        <p className="text-zinc-500 text-sm">Eventos archivados. Puedes restaurarlos o eliminarlos permanentemente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.filter(e => e.status === 'archived').map(event => (
                            <div key={event.id} className="group relative bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 opacity-75 hover:opacity-100 transition-all">
                                <div className="h-56 overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-500">
                                    <img src={event.cover_image} className="w-full h-full object-cover" alt={event.title} />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <span className="text-white font-black uppercase tracking-widest border border-white px-4 py-2 rounded-lg">Archivado</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <h3 className="text-xl font-black text-white mb-4">{event.title}</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button onClick={() => {if(confirm('¿Restaurar evento?')) restoreEvent(event.id)}} variant="outline" className="h-12 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10">
                                            <RefreshCcw className="mr-2 w-4 h-4"/> Restaurar
                                        </Button>
                                        <Button onClick={() => {if(confirm('¿ELIMINAR PERMANENTEMENTE? Esta acción no se puede deshacer.')) hardDeleteEvent(event.id)}} variant="danger" className="h-12">
                                            <Trash2 className="mr-2 w-4 h-4"/> Eliminar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {events.filter(e => e.status === 'archived').length === 0 && (
                            <div className="col-span-full py-20 text-center text-zinc-600 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                                El cementerio está vacío.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'staff' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="space-y-8">
                            <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl">
                                <h2 className="text-xl font-black mb-6 text-neon-blue">Autorizar Staff</h2>
                                <p className="text-xs text-zinc-500 mb-4">El staff ingresa con su email — recibirá un código cada vez que quiera acceder.</p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre Completo</label>
                                        <input value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold" placeholder="Ej: Juan Pérez" />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold text-neon-blue flex items-center gap-1"><Mail size={10}/> Email de Acceso</label>
                                        <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold" placeholder="staff@ejemplo.com" />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Código Identificador (opcional)</label>
                                        <input value={staffCode} onChange={e => setStaffCode(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase font-black tracking-wider text-center" placeholder="EJ: JUANP" />
                                        <p className="text-[9px] text-zinc-600 mt-1">Se usa para el link de referidos. Si lo dejas vacío se genera automático.</p>
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Rol</label>
                                        <select value={staffRole} onChange={(e:any) => setStaffRole(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase font-bold text-xs">
                                            <option value="PROMOTER">Promotor</option>
                                            <option value="MANAGER">Manager (Gerente)</option>
                                            <option value="HEAD">Cabeza de Super Squad</option>
                                            <option value="HEAD_OF_SALES">Head of Sales (Director Global)</option>
                                        </select>
                                    </div>

                                    <Button onClick={handleCreateStaff} fullWidth className="bg-white text-black font-black mt-2">REGISTRAR STAFF</Button>
                                </div>
                            </div>

                            {/* --- SECCIÓN SQUADS --- */}
                            <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl">
                                <h2 className="text-xl font-black mb-6 text-neon-purple">Crear Squad</h2>
                                <div className="space-y-4">
                                    <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white" placeholder="Nombre del Equipo" />
                                    <select value={selectedManagerId} onChange={e => setSelectedManagerId(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white">
                                        <option value="">Seleccionar Manager</option>
                                        {promoters.filter(p => p.role === 'MANAGER' || p.role === 'HEAD_OF_SALES').map(p => (
                                            <option key={p.user_id} value={p.user_id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <Button onClick={handleCreateTeam} fullWidth className="bg-neon-purple text-white">CREAR EQUIPO</Button>
                                </div>
                            </div>

                            {/* --- SUPER SQUADS --- */}
                            <div className="bg-zinc-900 border border-[#C9A84C]/20 p-6 rounded-3xl">
                                <h2 className="text-xl font-black mb-1" style={{ color: '#C9A84C' }}>Super Squad</h2>
                                <p className="text-[10px] text-zinc-500 mb-5">Una Cabeza lidera múltiples squads y/o promotores directos.</p>
                                <div className="space-y-3 mb-4">
                                    <input value={newSuperSquadName} onChange={e => setNewSuperSquadName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white" placeholder="Nombre del Super Squad" />
                                    <select value={newSuperSquadHeadId} onChange={e => setNewSuperSquadHeadId(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white">
                                        <option value="">Seleccionar Cabeza</option>
                                        {promoters.filter(p => p.role === UserRole.HEAD_OF_SALES || p.role === UserRole.MANAGER).map(p => (
                                            <option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>
                                        ))}
                                    </select>
                                    <Button onClick={async () => {
                                        if (!newSuperSquadName || !newSuperSquadHeadId) { toast.error('Nombre y Cabeza son obligatorios'); return; }
                                        try { await createSuperSquad(newSuperSquadName, newSuperSquadHeadId); setNewSuperSquadName(''); setNewSuperSquadHeadId(''); toast.success('Super Squad creado'); }
                                        catch (e: any) { toast.error(e.message); }
                                    }} fullWidth style={{ background: '#C9A84C', color: '#000' }}>CREAR SUPER SQUAD</Button>
                                </div>

                                {superSquads.length > 0 && (
                                    <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Asignar squad a super squad</p>
                                        <select value={squadAssignTeamId} onChange={e => setSquadAssignTeamId(e.target.value)} className="w-full bg-black border border-zinc-800 p-2.5 rounded-xl text-white text-sm">
                                            <option value="">Seleccionar Squad</option>
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                        <select value={squadAssignSuperSquadId} onChange={e => setSquadAssignSuperSquadId(e.target.value)} className="w-full bg-black border border-zinc-800 p-2.5 rounded-xl text-white text-sm">
                                            <option value="">Seleccionar Super Squad</option>
                                            {superSquads.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                                        </select>
                                        <Button onClick={async () => {
                                            if (!squadAssignTeamId || !squadAssignSuperSquadId) { toast.error('Selecciona squad y super squad'); return; }
                                            await assignTeamToSuperSquad(squadAssignTeamId, squadAssignSuperSquadId);
                                            toast.success('Squad asignado'); setSquadAssignTeamId(''); setSquadAssignSuperSquadId('');
                                        }} fullWidth variant="outline" className="border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10">ASIGNAR</Button>
                                    </div>
                                )}
                            </div>
                            {/* ------------------------------- */}
                        </div>

                        <div className="lg:col-span-2 space-y-8">
                            <div>
                                <h3 className="text-lg font-black text-white mb-4">Equipos Activos</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {teams.length === 0 && <p className="text-zinc-500 text-sm">No hay equipos creados.</p>}
                                    {teams.map(team => (
                                        <div key={team.id} className="bg-black/40 border border-white/5 p-4 rounded-2xl">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-white">{team.name}</h4>
                                                    <p className="text-xs text-zinc-500 mt-1">Manager: {promoters.find(p => p.user_id === team.manager_id)?.name || 'N/A'}</p>
                                                </div>
                                                <button onClick={() => setViewingTeamEditId(team.id)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-colors">
                                                    <Pencil className="w-4 h-4"/>
                                                </button>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                                                 <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white">{team.members_ids.length} Miembros</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {superSquads.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-black mb-4" style={{ color: '#C9A84C' }}>Super Squads Activos</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {superSquads.map(ss => {
                                            const head = promoters.find(p => p.user_id === ss.head_id);
                                            const linkedTeams = teams.filter(t => t.super_squad_id === ss.id);
                                            return (
                                                <div key={ss.id} className="bg-black/40 border p-4 rounded-2xl" style={{ borderColor: '#C9A84C30' }}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-bold text-white">{ss.name}</h4>
                                                            <p className="text-xs text-zinc-500 mt-0.5">Cabeza: {head?.name || 'Sin asignar'}</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => { setEditingSuperSquad(ss); setEditSsName(ss.name); setEditSsHeadId(ss.head_id); }} className="text-zinc-500 hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                                                            <button onClick={async () => { if (confirm('¿Eliminar Super Squad?')) await deleteSuperSquad(ss.id); }} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-1">
                                                        {linkedTeams.length === 0
                                                            ? <span className="text-[10px] text-zinc-600">Sin squads asignados</span>
                                                            : linkedTeams.map(t => (
                                                                <span key={t.id} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#C9A84C20', color: '#C9A84C' }}>
                                                                    {t.name}
                                                                    <button onClick={async () => { await assignTeamToSuperSquad(t.id, null); toast.success(`${t.name} desvinculado`); }} className="opacity-50 hover:opacity-100 ml-0.5">×</button>
                                                                </span>
                                                            ))
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-lg font-black text-white mb-4">Lista Maestra</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {promoters.map(p => (
                                        <div key={p.user_id} className="bg-zinc-900 border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                                            <div>
                                                <p className="font-bold">{p.name}</p>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    <span className="text-neon-blue font-black text-xs">CODE: {p.code}</span>
                                                    <span className="text-zinc-500 text-[10px]">{p.email}</span>
                                                    <span className="text-zinc-500 text-xs uppercase font-bold">{p.role}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setEditingStaff(p); setEditForm({ name: p.name, code: p.code, role: p.role, password: '' }); }} className="text-zinc-500 hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => { if (confirm(`¿Eliminar a ${p.name}?`)) deleteStaff(p.user_id); }} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'system' && (
                <div className="space-y-8 max-w-4xl mx-auto">
                    <div className="bg-zinc-900 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                                <HardDrive className="text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Modo Offline Local</h2>
                                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Almacenamiento en Memoria</p>
                            </div>
                        </div>

                        <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl mb-8">
                            <p className="text-xs text-emerald-500 font-bold leading-relaxed">
                                El sistema está operando en modo local. Los datos se mantienen mientras la ventana del navegador esté abierta. Ideal para demos o gestión temporal rápida sin configurar bases de datos externas.
                            </p>
                        </div>

                        <Button 
                            onClick={() => { if(confirm('¡ADVERTENCIA! ¿Borrar todo?')) clearDatabase() }} 
                            variant="danger" 
                            fullWidth 
                            className="h-14 font-black"
                        >
                            RESETEAR SISTEMA LOCAL
                        </Button>
                    </div>
                </div>
            )}

            {/* TEAM EDIT MODAL */}
            <AnimatePresence>
                {viewingTeamEditId && teamToEdit && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-white/10 p-6 md:p-8 rounded-[2.5rem] w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                            <button onClick={() => setViewingTeamEditId(null)} className="absolute top-6 right-6 text-zinc-600 hover:text-white"><X size={24}/></button>
                            
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Users className="text-neon-purple w-6 h-6"/>
                                    <h2 className="text-2xl font-black text-white uppercase">Editar Squad</h2>
                                </div>
                                <p className="text-xl font-bold text-white">{teamToEdit.name}</p>
                                <p className="text-xs text-zinc-500 uppercase mt-1">Manager: {promoters.find(p => p.user_id === teamToEdit.manager_id)?.name}</p>
                            </div>

                            <div className="space-y-6">
                                {/* MIEMBROS ACTUALES */}
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                    <h4 className="text-xs font-black text-zinc-500 uppercase mb-4 flex items-center gap-2"><UserCheck size={14}/> Miembros Actuales</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {teamMembers.length === 0 && <p className="text-center text-zinc-600 text-xs py-4">Sin miembros.</p>}
                                        {teamMembers.map(member => (
                                            <div key={member.user_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{member.name}</p>
                                                        <p className="text-[9px] text-zinc-500 font-mono">{member.code}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => updateStaffTeam(member.user_id, null)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors" title="Remover del equipo">
                                                    <UserMinus size={16}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* STAFF DISPONIBLE */}
                                <div className="bg-black/40 p-4 rounded-3xl border border-white/5">
                                    <h4 className="text-xs font-black text-zinc-500 uppercase mb-4 flex items-center gap-2"><UserPlus size={14}/> Agregar Staff Disponible</h4>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {availableStaff.length === 0 && <p className="text-center text-zinc-600 text-xs py-4">No hay staff disponible.</p>}
                                        {availableStaff.map(staff => (
                                            <div key={staff.user_id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white">
                                                        {staff.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white">{staff.name}</p>
                                                        <p className="text-[9px] text-zinc-500 font-mono">{staff.code}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => updateStaffTeam(staff.user_id, teamToEdit.id)} className="p-2 hover:bg-neon-green/10 text-zinc-500 hover:text-neon-green rounded-lg transition-colors" title="Agregar al equipo">
                                                    <Plus size={16}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10">
                                    <Button onClick={() => handleDeleteTeam(teamToEdit.id)} fullWidth variant="danger" className="font-black text-xs h-12">
                                        <Trash2 className="mr-2 w-4 h-4"/> ELIMINAR SQUAD COMPLETO
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── MODAL: EDITAR STAFF ── */}
            <AnimatePresence>
                {editingStaff && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-zinc-900 border border-white/10 p-6 rounded-[2rem] w-full max-w-md shadow-2xl relative">
                            <button onClick={() => setEditingStaff(null)} className="absolute top-5 right-5 text-zinc-500 hover:text-white"><X size={20}/></button>
                            <h2 className="text-xl font-black text-white mb-1">Editar Usuario</h2>
                            <p className="text-[10px] text-zinc-600 mb-6 font-bold uppercase tracking-widest">{editingStaff.email} · no editable</p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre</label>
                                    <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold mt-1" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Código Identificador</label>
                                    <input value={editForm.code} onChange={e => setEditForm({...editForm, code: e.target.value.replace(/\s/g, '').toUpperCase()})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-black tracking-wider uppercase mt-1" />
                                    <p className="text-[9px] text-zinc-600 mt-1 font-mono">Sin espacios · Solo letras y números</p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Rol</label>
                                    <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase font-bold text-xs mt-1">
                                        <option value="PROMOTER">Promotor</option>
                                        <option value="MANAGER">Manager (Gerente)</option>
                                        <option value="HEAD">Cabeza de Super Squad</option>
                                        <option value="HEAD_OF_SALES">Head of Sales (Director Global)</option>
                                        <option value="BOUNCER">Bouncer</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Nueva Contraseña <span className="text-zinc-700">(dejar vacío para no cambiar)</span></label>
                                    <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold mt-1" placeholder="••••••••" />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={async () => {
                                        if (/\s/.test(editForm.code)) { toast.error('El código no puede contener espacios.'); return; }
                                        if (!editForm.code.trim()) { toast.error('El código no puede estar vacío.'); return; }
                                        setIsSavingStaff(true);
                                        try {
                                            const payload: any = { name: editForm.name, code: editForm.code.replace(/\s/g, '').toUpperCase(), role: editForm.role };
                                            if (editForm.password) payload.password = editForm.password;
                                            await updateStaff(editingStaff.user_id, payload);
                                            toast.success('Usuario actualizado');
                                            setEditingStaff(null);
                                        } catch (e: any) { toast.error(e.message); }
                                        finally { setIsSavingStaff(false); }
                                    }} disabled={isSavingStaff} className="flex-1 bg-white text-black font-black h-12">
                                        {isSavingStaff ? 'Guardando...' : 'GUARDAR'}
                                    </Button>
                                    <Button onClick={() => setEditingStaff(null)} variant="outline" className="h-12">Cancelar</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── MODAL: EDITAR SUPER SQUAD ── */}
            <AnimatePresence>
                {editingSuperSquad && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-zinc-900 border border-[#C9A84C]/20 p-6 rounded-[2rem] w-full max-w-md shadow-2xl relative">
                            <button onClick={() => setEditingSuperSquad(null)} className="absolute top-5 right-5 text-zinc-500 hover:text-white"><X size={20}/></button>
                            <h2 className="text-xl font-black mb-6" style={{ color: '#C9A84C' }}>Editar Super Squad</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre</label>
                                    <input value={editSsName} onChange={e => setEditSsName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold mt-1" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Cabeza</label>
                                    <select value={editSsHeadId} onChange={e => setEditSsHeadId(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white mt-1">
                                        <option value="">Sin asignar</option>
                                        {promoters.filter(p => p.role === 'HEAD' || p.role === 'HEAD_OF_SALES' || p.role === 'MANAGER').map(p => (
                                            <option key={p.user_id} value={p.user_id}>{p.name} ({p.role})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={async () => {
                                        try {
                                            const { error } = await supabase.from('super_squads').update({ name: editSsName, head_id: editSsHeadId || null }).eq('id', editingSuperSquad.id);
                                            if (error) throw error;
                                            await fetchData();
                                            toast.success('Super Squad actualizado');
                                            setEditingSuperSquad(null);
                                        } catch (e: any) { toast.error(e.message); }
                                    }} className="flex-1 font-black h-12" style={{ background: '#C9A84C', color: '#000' }}>
                                        GUARDAR
                                    </Button>
                                    <Button onClick={() => setEditingSuperSquad(null)} variant="outline" className="h-12">Cancelar</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};