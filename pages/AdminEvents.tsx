import React, { useState, useMemo } from 'react';
import { 
    Trash2, Plus, Pencil, Save, Users, ShieldCheck, 
    UserCog, BadgeCheck, Database, Download, Upload, AlertTriangle, 
    HardDrive, RefreshCcw, Layers, Target, UserPlus, Calendar, MapPin, DollarSign, Ticket, Eye, ArrowLeft, Search, User, Filter, Share2, CheckCircle2, XCircle, MinusCircle, Lock, Key, X, UserMinus, UserCheck
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
        events, addEvent, updateEvent, archiveEvent, restoreEvent, hardDeleteEvent, getEventTiers,
        promoters, addStaff, deleteStaff, teams, createTeam, updateStaffTeam, deleteTeam,
        orders, dbStatus, clearDatabase
    } = useStore();
    
    const [activeTab, setActiveTab] = useState<'events' | 'archived' | 'staff' | 'system'>('events');
    const [staffView, setStaffView] = useState<'all' | 'teams'>('all');
    
    // --- ESTADO: Navegación de Detalles de Evento ---
    const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

    // --- STATE: Event Creation/Edit ---
    const [isCreatingEvent, setIsCreatingEvent] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventForm, setEventForm] = useState({
        title: '', description: '', venue: '', city: '', 
        date: '', time: '', cover_image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000'
    });
    
    const [tierRows, setTierRows] = useState<any[]>([
        { id: undefined, name: 'General Early Bird', price: 50, commission_fixed: 5, quantity: 100, stage: 'early_bird' },
        { id: undefined, name: 'VIP Access', price: 150, commission_fixed: 15, quantity: 50, stage: 'presale' }
    ]);

    // --- STATE: Squad/Staff Form ---
    const [newTeamName, setNewTeamName] = useState('');
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [viewingTeamEditId, setViewingTeamEditId] = useState<string | null>(null);
    
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

        const eventOrders = orders.filter(o => o.event_id === selectedAuditId);
        const tiers = getEventTiers(selectedAuditId);

        // Ranking
        const rankingMap: {[key: string]: {name: string, tickets: number, revenue: number}} = {};
        eventOrders.forEach(o => {
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

        // Stage Groups (Early Bird, Presale, etc)
        const stageGroups = Array.from(new Set(tiers.map(t => t.stage))).map(stage => {
            const stageTiers = tierStats.filter(t => t.stage === stage);
            const totalQty = stageTiers.reduce((acc, t) => acc + t.quantity, 0);
            const totalSold = stageTiers.reduce((acc, t) => acc + t.realSold, 0);
            return {
                stage: stage,
                totalQty,
                totalSold,
                progress: totalQty > 0 ? (totalSold / totalQty) * 100 : 0
            };
        });

        return { event, eventOrders, tiers, sortedRanking, tierStats, stageGroups };
    }, [selectedAuditId, events, orders, promoters]);

    // --- HELPER: TEAM EDITING ---
    const teamToEdit = teams.find(t => t.id === viewingTeamEditId);
    const teamMembers = promoters.filter(p => p.sales_team_id === viewingTeamEditId);
    const availableStaff = promoters.filter(p => !p.sales_team_id && p.role !== UserRole.ADMIN);

    // --- HANDLERS: Event ---
    const handleAddTierRow = () => {
        setTierRows([...tierRows, { id: undefined, name: '', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
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
            commission_fixed: t.commission_fixed,
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
                alert("Máx 5MB por foto.");
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
        if (!eventForm.title || !eventForm.date) return alert("Faltan datos básicos del evento");
        
        const eventData = {
            title: eventForm.title,
            description: eventForm.description,
            venue: eventForm.venue,
            city: eventForm.city,
            event_date: `${eventForm.date}T${eventForm.time || '20:00'}:00`,
            doors_open: eventForm.time || '20:00',
            cover_image: eventForm.cover_image
        };

        const cleanTiers: any[] = tierRows.map(t => ({
            id: t.id,
            name: t.name,
            price: Number(t.price) || 0,
            quantity: Number(t.quantity) || 0,
            commission_fixed: Number(t.commission_fixed) || 0,
            stage: t.stage || 'general'
        }));

        try {
            if (editingEventId) {
                await updateEvent(editingEventId, eventData, cleanTiers);
                alert("Evento actualizado correctamente");
            } else {
                await addEvent(eventData, cleanTiers);
                alert("Evento creado correctamente");
            }
            setIsCreatingEvent(false);
            setEditingEventId(null);
            setEventForm({ title: '', description: '', venue: '', city: '', date: '', time: '', cover_image: '' });
            setTierRows([{ id: undefined, name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
        } catch (e: any) {
            console.error(e);
            alert(`Error: ${e.message}`);
        }
    };

    const cancelEdit = () => {
        setIsCreatingEvent(false);
        setEditingEventId(null);
        setEventForm({ title: '', description: '', venue: '', city: '', date: '', time: '', cover_image: '' });
        setTierRows([{ id: undefined, name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
    };

    const handleCreateTeam = () => {
        if (!newTeamName) return alert("Ingresa un nombre para el equipo.");
        if (!selectedManagerId) return alert("Debes seleccionar un manager.");
        createTeam(newTeamName, selectedManagerId);
        setNewTeamName(''); setSelectedManagerId('');
        alert('Squad creado exitosamente');
    };

    const handleCreateStaff = () => {
        if (!staffName || !staffCode || !staffPassword) return alert("Nombre, Código y Contraseña son obligatorios para el acceso.");
        // Email es opcional para Staff administrativo, pero requerido si quisieran recuperar cuenta (aunque aquí es acceso por código)
        const finalEmail = staffEmail || `${staffCode.toLowerCase()}@midnight.staff`; 
        
        addStaff({ 
            name: staffName, 
            code: staffCode.toUpperCase(), 
            password: staffPassword,
            email: finalEmail, 
            role: staffRole 
        }); 
        
        setStaffName(''); setStaffCode(''); setStaffPassword('1234'); setStaffEmail('');
        alert(`Staff registrado. Acceso con CÓDIGO: ${staffCode.toUpperCase()}`);
    };

    const handleDeleteTeam = async (id: string) => {
        if (confirm('¿Eliminar equipo? Los miembros quedarán como independientes.')) {
            await deleteTeam(id);
            setViewingTeamEditId(null);
        }
    };

    const handleExportDatabase = () => {
        if (!auditData) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        // Header Row
        csvContent += "Nombre Cliente,Correo Electronico,Cantidad,Tipo Boleta,Valor Total,Fecha Compra,Medio Pago,Promotor,Etapa\n";
        
        auditData.eventOrders.forEach(order => {
            const promoterName = promoters.find(p => p.user_id === order.staff_id)?.name || 'Venta Directa';
            
            // For each item in the order, we could list them differently, but usually we just list items
            // However, to be precise with "Tipo de Boleta" and "Etapa", we iterate items.
            order.items.forEach(item => {
                const tier = auditData.tiers.find(t => t.id === item.tier_id);
                const stage = tier?.stage || 'general';
                
                // Construct Row
                const row = [
                    order.customer_name,
                    order.customer_email,
                    item.quantity,
                    item.tier_name,
                    item.subtotal,
                    new Date(order.timestamp).toLocaleString(),
                    order.payment_method,
                    promoterName,
                    stage
                ];
                csvContent += row.join(",") + "\n";
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `DB_Ventas_${auditData.event.title}.csv`);
        document.body.appendChild(link);
        link.click();
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
                <div className="space-y-8">
                    {!isCreatingEvent && !selectedAuditId ? (
                        <div className="space-y-6">
                             <div className="flex justify-between items-center bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                                <div>
                                    <h2 className="text-2xl font-black text-white">Eventos Activos</h2>
                                    <p className="text-zinc-500 text-sm">Gestiona la cartelera y el inventario de tickets.</p>
                                </div>
                                <Button onClick={() => { setIsCreatingEvent(true); setEditingEventId(null); setTierRows([{id: undefined, name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general'}]) }} className="bg-neon-purple text-white font-black h-12">
                                    <Plus className="mr-2" /> CREAR EVENTO
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.filter(e => e.status !== 'archived').map(event => (
                                    <div key={event.id} className="group relative bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-white/20 transition-all shadow-xl">
                                        <div className="h-56 overflow-hidden relative">
                                            <img src={event.cover_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60" alt={event.title} />
                                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
                                            <div className="absolute bottom-4 left-6">
                                                <h3 className="text-2xl font-black text-white mb-2">{event.title}</h3>
                                                <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(event.event_date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            <div className="grid grid-cols-3 gap-2">
                                                <Button onClick={() => setSelectedAuditId(event.id)} variant="outline" className="h-12 border-neon-blue/20 text-neon-blue hover:bg-neon-blue/10"><Eye size={18}/></Button>
                                                <Button onClick={() => handleEditEvent(event)} variant="outline" className="h-12"><Pencil size={18}/></Button>
                                                <Button onClick={() => {if(confirm('¿Archivar evento? Pasará al Cementerio.')) archiveEvent(event.id)}} variant="danger" className="h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700"><Trash2 size={18}/></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {events.filter(e => e.status !== 'archived').length === 0 && <div className="col-span-full py-20 text-center text-zinc-600 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">No hay eventos activos.</div>}
                            </div>
                        </div>
                    ) : selectedAuditId && auditData ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center mb-8">
                                <button onClick={() => setSelectedAuditId(null)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest">
                                    <ArrowLeft size={20}/> Volver
                                </button>
                                <Button onClick={handleExportDatabase} className="bg-emerald-500 text-black font-black text-xs">
                                    <Download className="mr-2 w-4 h-4"/> EXPORTAR BASE DE DATOS
                                </Button>
                            </div>
                            
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
                        </div>
                    ) : (
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
                                        <div key={idx} className="bg-black/40 p-4 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center animate-in slide-in-from-left-4">
                                            <div className="md:col-span-4">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre Etapa</label>
                                                <input value={tier.name} onChange={e => handleTierChange(idx, 'name', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-purple" placeholder="Ej: Early Bird" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Precio</label>
                                                <input type="number" value={tier.price} onChange={e => handleTierChange(idx, 'price', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-green" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Comisión</label>
                                                <input type="number" value={tier.commission_fixed} onChange={e => handleTierChange(idx, 'commission_fixed', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-neon-blue" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] text-zinc-500 uppercase font-bold">Cantidad</label>
                                                <input type="number" value={tier.quantity} onChange={e => handleTierChange(idx, 'quantity', e.target.value)} className="w-full bg-transparent border-b border-white/20 py-2 text-white font-bold text-sm focus:outline-none focus:border-white" placeholder="0" />
                                            </div>
                                            <div className="md:col-span-2 flex justify-end">
                                                <button onClick={() => handleRemoveTierRow(idx)} className="text-zinc-600 hover:text-red-500 transition-colors"><MinusCircle/></button>
                                            </div>
                                            <div className="md:col-span-12">
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
                                <p className="text-xs text-zinc-500 mb-4">Crea un código de acceso único para que el staff ingrese al Command Center.</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Nombre Completo</label>
                                        <input value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-bold" placeholder="Ej: Juan Pérez" />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold text-neon-purple flex items-center gap-1"><Key size={10}/> Código de Acceso (Usuario)</label>
                                        <input value={staffCode} onChange={e => setStaffCode(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase font-black tracking-wider text-center" placeholder="EJ: JUANP123" />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Contraseña</label>
                                        <input type="text" value={staffPassword} onChange={e => setStaffPassword(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white font-mono" placeholder="1234" />
                                    </div>

                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Email (Contacto Opcional)</label>
                                        <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-zinc-400 text-xs" placeholder="contacto@ejemplo.com" />
                                    </div>
                                    
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase font-bold">Rol</label>
                                        <select value={staffRole} onChange={(e:any) => setStaffRole(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase font-bold text-xs">
                                            <option value="PROMOTER">Promotor</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="HEAD_OF_SALES">Head of Sales</option>
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
                                            <button onClick={() => deleteStaff(p.user_id)} className="text-zinc-700 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
        </div>
    );
};