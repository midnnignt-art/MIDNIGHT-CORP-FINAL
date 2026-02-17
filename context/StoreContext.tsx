import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Event, Promoter, TicketTier, Order, UserRole, SalesTeam, EventCost 
} from '../types';
import { supabase } from '../lib/supabase';

interface StoreContextType {
    events: Event[];
    tiers: TicketTier[];
    promoters: Promoter[];
    orders: Order[];
    teams: SalesTeam[];
    currentUser: any;
    dbStatus: 'synced' | 'local' | 'syncing' | 'error';
    login: (code: string) => Promise<boolean>;
    logout: () => void;
    getEventTiers: (eventId: string) => TicketTier[];
    
    addEvent: (eventData: any, tiers: any[]) => Promise<void>;
    updateEvent: (id: string, eventData: any, tiers: any[]) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
    addEventCost: (eventId: string, cost: Omit<EventCost, 'id' | 'event_id'>) => Promise<void>;
    deleteEventCost: (eventId: string, costId: string) => Promise<void>;
    updateCostStatus: (eventId: string, costId: string, status: 'pending' | 'paid' | 'cancelled') => Promise<void>;

    addStaff: (staffData: any) => Promise<void>;
    deleteStaff: (id: string) => Promise<void>;
    createTeam: (name: string, managerId: string) => Promise<void>;
    createOrder: (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => Promise<Order | null>;
    clearDatabase: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ESTADO
    const [events, setEvents] = useState<Event[]>([]);
    const [tiers, setTiers] = useState<TicketTier[]>([]);
    const [promoters, setPromoters] = useState<Promoter[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [teams, setTeams] = useState<SalesTeam[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [dbStatus, setDbStatus] = useState<'synced' | 'local' | 'syncing' | 'error'>('syncing');

    // CARGA INICIAL DE DATOS
    useEffect(() => {
        fetchData();
        
        // Recuperar sesión local si existe
        const storedId = localStorage.getItem('midnight_user_id');
        if (storedId) {
            // Intentamos recuperar el usuario de la lista cargada
            // Nota: Esto depende de que 'promoters' ya se haya cargado o se actualice
        }
    }, []);

    // Efecto secundario para reconectar usuario cuando carguen los promotores
    useEffect(() => {
        const storedId = localStorage.getItem('midnight_user_id');
        if (storedId && promoters.length > 0 && !currentUser) {
            const user = promoters.find(p => p.user_id === storedId);
            if (user) setCurrentUser(user);
        }
    }, [promoters]);

    const fetchData = async () => {
        setDbStatus('syncing');
        try {
            // 1. Fetch Events & Costs
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select(`*, costs:event_costs(*)`);
            
            if (eventsError) throw eventsError;

            // 2. Fetch Tiers
            const { data: tiersData, error: tiersError } = await supabase
                .from('ticket_tiers')
                .select('*');
                
            if (tiersError) throw tiersError;

            // 3. Fetch Profiles (Staff)
            // Nota: RLS podría bloquear esto si no somos Admin. 
            // Para el MVP, intentamos traer lo que podamos.
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*');

            // 4. Fetch Orders & Items
            // Obtenemos ordenes y sus items
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select(`*, items:order_items(*)`);
            
            if (ordersError) throw ordersError;

            // 5. Fetch Teams
            const { data: teamsData, error: teamsError } = await supabase
                .from('sales_teams')
                .select('*');

            // --- TRANSFORMACIÓN DE DATOS ---
            
            // Map Events (Asegurar estructura de costs)
            const mappedEvents: Event[] = (eventsData || []).map((e: any) => ({
                ...e,
                gallery: [], // Campo UI no en DB
                tags: [],    // Campo UI no en DB
                nft_benefits: [], // Campo UI no en DB
                costs: e.costs || []
            }));

            // Map Promoters
            const mappedPromoters: Promoter[] = (profilesData || []).map((p: any) => ({
                user_id: p.id,
                name: p.full_name || 'Sin Nombre',
                email: p.email,
                code: p.code || 'N/A',
                role: p.role,
                sales_team_id: p.sales_team_id,
                manager_id: p.manager_id,
                total_sales: p.total_sales || 0,
                total_commission_earned: p.total_commission_earned || 0
            }));

            // Map Orders
            const mappedOrders: Order[] = (ordersData || []).map((o: any) => ({
                ...o,
                timestamp: o.created_at,
                // Mapear items de DB a estructura de frontend
                items: o.items.map((i: any) => ({
                    tier_id: i.tier_id,
                    tier_name: i.tier_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    subtotal: i.subtotal
                }))
            }));
            
            // Map Teams
            // Necesitamos calcular los members_ids manualmente ya que en SQL la relación está en profiles.sales_team_id
            const mappedTeams: SalesTeam[] = (teamsData || []).map((t: any) => ({
                ...t,
                members_ids: (profilesData || [])
                    .filter((p: any) => p.sales_team_id === t.id)
                    .map((p: any) => p.id),
                total_revenue: 0 // Se podría calcular sumando ventas
            }));

            setEvents(mappedEvents);
            setTiers(tiersData || []);
            setPromoters(mappedPromoters);
            setOrders(mappedOrders);
            setTeams(mappedTeams);
            setDbStatus('synced');

        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
            setDbStatus('error');
        }
    };

    const login = async (code: string): Promise<boolean> => {
        const c = code.toUpperCase();
        
        // 1. BACKDOOR ADMIN: Si usa el código maestro, forzamos un login local de Admin
        // Esto es útil si RLS impide leer la tabla de perfiles antes de loguearse
        if (c === 'ADMIN123') {
             // Creamos un objeto de admin ficticio si no existe en DB, o buscamos uno con rol admin
             const adminUser = promoters.find(p => p.role === UserRole.ADMIN);
             const user = adminUser || {
                 user_id: 'admin-local',
                 name: 'Super Admin',
                 email: 'admin@midnight.com',
                 code: 'ADMIN123',
                 role: UserRole.ADMIN,
                 total_sales: 0,
                 total_commission_earned: 0
             };
             setCurrentUser(user);
             localStorage.setItem('midnight_user_id', user.user_id);
             return true;
        }

        // 2. Intento Normal: Buscar en los promotores ya cargados (cache local)
        // Esto evita pelear con RLS en el momento del login si ya logramos bajar la data pública
        const user = promoters.find(p => p.code === c);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('midnight_user_id', user.user_id);
            return true;
        }

        // 3. Intento Directo a DB (Fallback)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('code', c)
                .single();
            
            if (data && !error) {
                const mappedUser: Promoter = {
                    user_id: data.id,
                    name: data.full_name,
                    email: data.email,
                    code: data.code,
                    role: data.role,
                    total_sales: data.total_sales,
                    total_commission_earned: data.total_commission_earned
                };
                setCurrentUser(mappedUser);
                localStorage.setItem('midnight_user_id', mappedUser.user_id);
                // Si encontramos uno nuevo, refrescamos todo
                fetchData(); 
                return true;
            }
        } catch (e) {
            console.log("Login lookup failed", e);
        }

        return false;
    };

    const logout = () => { 
        setCurrentUser(null); 
        localStorage.removeItem('midnight_user_id'); 
    };

    const getEventTiers = (eventId: string) => tiers.filter(t => t.event_id === eventId);

    const addEvent = async (eventData: any, tierData: any[]) => {
        try {
            // 1. Insert Event
            const { data: newEvent, error: eventError } = await supabase
                .from('events')
                .insert({
                    title: eventData.title,
                    slug: eventData.title.toLowerCase().replace(/ /g, '-'),
                    description: eventData.description,
                    venue: eventData.venue,
                    city: eventData.city,
                    event_date: eventData.event_date,
                    doors_open: eventData.doors_open,
                    cover_image: eventData.cover_image,
                    status: 'published',
                    current_stage: 'early_bird',
                    total_capacity: tierData.reduce((acc, t) => acc + Number(t.quantity), 0)
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // 2. Insert Tiers
            const tiersToInsert = tierData.map(t => ({
                event_id: newEvent.id,
                name: t.name,
                price: Number(t.price),
                quantity: Number(t.quantity),
                commission_fixed: Number(t.commission_fixed),
                stage: t.stage || 'general'
            }));

            const { error: tiersError } = await supabase.from('ticket_tiers').insert(tiersToInsert);
            if (tiersError) throw tiersError;

            await fetchData(); // Refresh
        } catch (error) {
            console.error("Error creating event:", error);
            alert("Error al crear evento en la nube.");
        }
    };

    const updateEvent = async (id: string, eventData: any, tierData: any[]) => {
        // Implementación simplificada: Actualizar evento, borrar tiers viejos, insertar nuevos
        try {
            await supabase.from('events').update(eventData).eq('id', id);
            
            // Tiers: Borrar y Recrear (estrategia simple para MVP)
            // Nota: En producción esto es peligroso si hay ventas asociadas a los tiers.
            // Lo ideal sería hacer 'upsert' o marcar como inactivos.
            // Para MVP, solo actualizamos el evento y refrescamos.
            // TODO: Implementar lógica robusta de actualización de tiers
            
            await fetchData();
        } catch (error) {
            console.error("Error updating event:", error);
        }
    };

    const deleteEvent = async (id: string) => {
        try {
            await supabase.from('events').delete().eq('id', id);
            await fetchData();
        } catch (error) {
            console.error("Error deleting event:", error);
        }
    };

    const addStaff = async (staffData: any) => {
        // En Supabase, los usuarios deben crearse en Auth. 
        // Como estamos en un modo "híbrido/MVP", insertaremos en profiles directamente si la política lo permite,
        // o simularemos la creación. 
        // **IMPORTANTE**: La tabla profiles tiene FK a auth.users. No podemos insertar un perfil sin un usuario de Auth real.
        // SOLUCIÓN MVP: Usaremos un RPC o Edge Function en el futuro.
        // POR AHORA: Solo actualizamos el estado local para la UI, pero alertamos que no se guardará en DB sin backend auth.
        alert("Nota: Para crear Staff real en Supabase, debes invitarlos desde el panel de Auth de Supabase. Esta acción solo simula la creación en esta sesión.");
        
        const newStaff: Promoter = {
            user_id: `temp-${Date.now()}`,
            ...staffData,
            total_sales: 0,
            total_commission_earned: 0,
            email: `${staffData.name.toLowerCase().replace(' ', '.')}@midnight.com`
        };
        setPromoters(prev => [...prev, newStaff]);
    };

    const deleteStaff = async (id: string) => {
        // Solo para visualización local por ahora
        setPromoters(prev => prev.filter(p => p.user_id !== id));
    };

    const createTeam = async (name: string, managerId: string) => {
        try {
            await supabase.from('sales_teams').insert({ name, manager_id: managerId });
            await fetchData();
        } catch (error) {
            console.error("Error creating team:", error);
        }
    };

    const createOrder = async (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => {
        try {
            const orderNumber = `MID-${Date.now().toString().slice(-6)}`;
            const total = cartItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
            
            // Calcular comisión
            let commission = 0;
            cartItems.forEach(item => {
                const tier = tiers.find(t => t.id === item.tier_id);
                if (tier) commission += (tier.commission_fixed || 0) * item.quantity;
            });
            
            const attributedStaffId = staffId || localStorage.getItem('midnight_referral_code_id') || null;

            // 1. Insert Order
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert({
                    order_number: orderNumber,
                    event_id: eventId,
                    customer_name: customerInfo?.name || 'Anon',
                    customer_email: customerInfo?.email || 'anon@mail.com',
                    total: total,
                    status: 'completed',
                    payment_method: method,
                    staff_id: attributedStaffId,
                    commission_amount: attributedStaffId ? commission : 0,
                    net_amount: total - (attributedStaffId ? commission : 0)
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Insert Order Items
            const itemsToInsert = cartItems.map(item => ({
                order_id: order.id,
                tier_id: item.tier_id,
                tier_name: item.tier_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw itemsError;

            // 3. Update Inventory (RPC call or manual update)
            // Manual update loop for MVP
            for (const item of cartItems) {
                const tier = tiers.find(t => t.id === item.tier_id);
                if (tier) {
                    await supabase
                        .from('ticket_tiers')
                        .update({ sold: (tier.sold || 0) + item.quantity })
                        .eq('id', tier.id);
                }
            }

            // 4. Update Event Stats
            const event = events.find(e => e.id === eventId);
            if (event) {
                await supabase.from('events').update({
                    tickets_sold: (event.tickets_sold || 0) + cartItems.reduce((a:any,b:any) => a + b.quantity, 0),
                    total_revenue: (event.total_revenue || 0) + total
                }).eq('id', eventId);
            }

            // 5. Update Promoter Stats if applicable
            if (attributedStaffId) {
                const promoter = promoters.find(p => p.user_id === attributedStaffId);
                if (promoter) {
                    await supabase.from('profiles').update({
                        total_sales: (promoter.total_sales || 0) + total,
                        total_commission_earned: (promoter.total_commission_earned || 0) + commission
                    }).eq('id', attributedStaffId);
                }
            }

            await fetchData(); // Refresh UI
            
            // Reconstruct full order object for return
            return { ...order, items: cartItems };

        } catch (error) {
            console.error("Error creating order:", error);
            return null;
        }
    };

    const clearDatabase = async () => {
        // Dangerous action, only enabled for local mode usually. 
        // In supabase mode, we might want to restrict this or implement it carefully.
        alert("Acción deshabilitada en modo Producción (Supabase).");
    };

    const addEventCost = async (eventId: string, cost: any) => {
        try {
            await supabase.from('event_costs').insert({
                event_id: eventId,
                ...cost
            });
            await fetchData();
        } catch (error) {
            console.error("Error adding cost", error);
        }
    };

    const deleteEventCost = async (eventId: string, costId: string) => {
        try {
            await supabase.from('event_costs').delete().eq('id', costId);
            await fetchData();
        } catch (error) {
            console.error("Error deleting cost", error);
        }
    };

    const updateCostStatus = async (eventId: string, costId: string, status: 'pending' | 'paid' | 'cancelled') => {
        try {
            await supabase.from('event_costs').update({ status }).eq('id', costId);
            await fetchData();
        } catch (error) {
            console.error("Error updating cost", error);
        }
    };

    return (
        <StoreContext.Provider value={{
            events, tiers, promoters, orders, teams, currentUser, dbStatus,
            login, logout, getEventTiers, addEvent, updateEvent, deleteEvent,
            addStaff, deleteStaff, createTeam, createOrder, clearDatabase,
            addEventCost, deleteEventCost, updateCostStatus
        }}>
            {children}
        </StoreContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error("useStore must be used within StoreProvider");
    return context;
};
