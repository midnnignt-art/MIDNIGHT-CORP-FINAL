import React, { useState, useMemo } from 'react';
import { 
    Trash2, Plus, Pencil, Save, Users, ShieldCheck, 
    UserCog, BadgeCheck, Database, Download, Upload, AlertTriangle, 
    HardDrive, RefreshCcw, Layers, Target, UserPlus, Calendar, MapPin, DollarSign, Ticket, Eye, ArrowLeft, Search, User, Filter, Share2, CheckCircle2, XCircle, MinusCircle, Lock
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Button } from '../components/ui/button';
import { UserRole, TicketTier, EventCost, Event, Promoter, SalesTeam, Order } from '../types';

interface AdminEventsProps {
    role: UserRole;
}

export const AdminEvents: React.FC<AdminEventsProps> = ({ role }) => {
    const { 
        events, addEvent, updateEvent, deleteEvent, getEventTiers,
        promoters, addStaff, deleteStaff, teams, createTeam,
        orders, dbStatus, clearDatabase
    } = useStore();
    
    const [activeTab, setActiveTab] = useState<'events' | 'staff' | 'system'>('events');
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
        { name: 'General Early Bird', price: 50, commission_fixed: 5, quantity: 100, stage: 'early_bird' },
        { name: 'VIP Access', price: 150, commission_fixed: 15, quantity: 50, stage: 'presale' }
    ]);

    // --- STATE: Squad/Staff Form ---
    const [newTeamName, setNewTeamName] = useState('');
    const [selectedManagerId, setSelectedManagerId] = useState('');
    const [staffName, setStaffName] = useState('');
    const [staffCode, setStaffCode] = useState('');
    const [staffEmail, setStaffEmail] = useState(''); // NEW EMAIL FIELD
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

        return { event, eventOrders, tiers, sortedRanking };
    }, [selectedAuditId, events, orders, promoters]);

    // --- HANDLERS: Event ---
    const handleAddTierRow = () => {
        setTierRows([...tierRows, { name: '', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
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
            name: t.name,
            price: t.price,
            commission_fixed: t.commission_fixed,
            quantity: t.quantity,
            stage: t.stage
        })));
        setIsCreatingEvent(true);
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

        const cleanTiers: Partial<TicketTier>[] = tierRows.map(t => ({
            ...t,
            price: Number(t.price) || 0,
            quantity: Number(t.quantity) || 0,
            commission_fixed: Number(t.commission_fixed) || 0
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
            setTierRows([{ name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
        } catch (e: any) {
            console.error(e);
            alert(`Error: ${e.message}`);
        }
    };

    const cancelEdit = () => {
        setIsCreatingEvent(false);
        setEditingEventId(null);
        setEventForm({ title: '', description: '', venue: '', city: '', date: '', time: '', cover_image: '' });
        setTierRows([{ name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general' }]);
    };

    const handleCreateTeam = () => {
        if (!newTeamName) return alert("Ingresa un nombre para el equipo.");
        if (!selectedManagerId) return alert("Debes seleccionar un manager.");
        createTeam(newTeamName, selectedManagerId);
        setNewTeamName(''); setSelectedManagerId('');
        alert('Squad creado exitosamente');
    };

    const handleCreateStaff = () => {
        if (!staffName || !staffCode || !staffEmail) return alert("Completa Nombre, Código y Email.");
        addStaff({ name: staffName, code: staffCode.toUpperCase(), email: staffEmail, role: staffRole }); 
        setStaffName(''); setStaffCode(''); setStaffEmail('');
        alert('Staff registrado. Podrá ingresar vía Email OTP.');
    };

    return (
        <div className="min-h-screen pt-24 px-4 max-w-7xl mx-auto pb-12">
            
            {/* Nav Tabs */}
            {!selectedAuditId && (
                <div className="flex gap-4 mb-8 border-b border-white/5 overflow-x-auto">
                    <button onClick={() => setActiveTab('events')} className={`pb-4 px-4 font-black transition-all whitespace-nowrap ${activeTab === 'events' ? 'text-white border-b-2 border-neon-purple' : 'text-zinc-600'}`}>
                        LANZAMIENTO
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
                                <Button onClick={() => { setIsCreatingEvent(true); setEditingEventId(null); setTierRows([{name: 'General', price: 0, commission_fixed: 0, quantity: 0, stage: 'general'}]) }} className="bg-neon-purple text-white font-black h-12">
                                    <Plus className="mr-2" /> CREAR EVENTO
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.map(event => (
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
                                                <Button onClick={() => {if(confirm('¿Eliminar?')) deleteEvent(event.id)}} variant="danger" className="h-12"><Trash2 size={18}/></Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {events.length === 0 && <div className="col-span-full py-20 text-center text-zinc-600 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">No hay eventos. Pulsa "Crear Evento" para empezar.</div>}
                            </div>
                        </div>
                    ) : selectedAuditId && auditData ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button onClick={() => setSelectedAuditId(null)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest mb-8">
                                <ArrowLeft size={20}/> Volver
                            </button>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-1 space-y-8">
                                    <div className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem]">
                                        <h3 className="text-xl font-black text-white mb-6">Ranking del Evento</h3>
                                        {auditData.sortedRanking.map((rank, idx) => (
                                            <div key={rank.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl mb-2">
                                                <span className="text-sm font-bold text-white">{rank.name}</span>
                                                <p className="text-sm font-black text-neon-green">${rank.revenue.toLocaleString()}</p>
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
                                    <input value={eventForm.cover_image} onChange={e => setEventForm({...eventForm, cover_image: e.target.value})} className="w-full bg-black border border-white/10 p-3 rounded-xl text-white text-xs" placeholder="URL Imagen Portada" />
                                    <div className="aspect-video rounded-xl overflow-hidden bg-black border border-white/5">
                                        {eventForm.cover_image && <img src={eventForm.cover_image} className="w-full h-full object-cover opacity-60" />}
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

            {activeTab === 'staff' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="space-y-8">
                            <div className="bg-zinc-900 border border-white/10 p-6 rounded-3xl">
                                <h2 className="text-xl font-black mb-6 text-neon-blue">Autorizar Staff</h2>
                                <div className="space-y-4">
                                    <input value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white" placeholder="Nombre" />
                                    <input value={staffCode} onChange={e => setStaffCode(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase" placeholder="CÓDIGO (USUARIO)" />
                                    
                                    {/* CAMBIO: INPUT EMAIL REQUERIDO PARA OTP */}
                                    <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white" placeholder="EMAIL (Requerido para OTP)" />
                                    
                                    <select value={staffRole} onChange={(e:any) => setStaffRole(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 rounded-xl text-white uppercase">
                                        <option value="PROMOTER">Promotor</option>
                                        <option value="MANAGER">Manager</option>
                                        <option value="HEAD_OF_SALES">Head of Sales</option>
                                    </select>

                                    <Button onClick={handleCreateStaff} fullWidth>REGISTRAR</Button>
                                </div>
                            </div>

                            {/* --- SECCIÓN SQUADS RESTAURADA --- */}
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
                                                <BadgeCheck className="text-neon-purple w-5 h-5"/>
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
                                                    <span className="text-neon-blue font-mono text-xs">[{p.code}]</span>
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
        </div>
    );
};