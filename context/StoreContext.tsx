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
    login: (code: string, password?: string) => Promise<boolean>;
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
                .select(`*, costs:event_costs(*)`)
                .order('created_at', { ascending: false });
            
            if (eventsError) throw eventsError;

            // 2. Fetch Tiers
            const { data: tiersData, error: tiersError } = await supabase
                .from('ticket_tiers')
                .select('*');
                
            if (tiersError) throw tiersError;

            // 3. Fetch Profiles (Staff)
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('*');

            // 4. Fetch Orders & Items
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select(`*, items:order_items(*)`)
                .order('created_at', { ascending: false });
            
            if (ordersError) throw ordersError;

            // 5. Fetch Teams
            const { data: teamsData, error: teamsError } = await supabase
                .from('sales_teams')
                .select('*');

            // --- TRANSFORMACIÓN DE DATOS ---
            
            const mappedEvents: Event[] = (eventsData || []).map((e: any) => ({
                ...e,
                gallery: [], 
                tags: [],    
                nft_benefits: [], 
                costs: e.costs || []
            }));

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

            const mappedOrders: Order[] = (ordersData || []).map((o: any) => ({
                ...o,
                timestamp: o.created_at,
                items: o.items.map((i: any) => ({
                    tier_id: i.tier_id,
                    tier_name: i.tier_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    subtotal: i.subtotal
                }))
            }));
            
            const mappedTeams: SalesTeam[] = (teamsData || []).map((t: any) => ({
                ...t,
                members_ids: (profilesData || [])
                    .filter((p: any) => p.sales_team_id === t.id)
                    .map((p: any) => p.id),
                total_revenue: 0
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

    const login = async (code: string, password?: string): Promise<boolean> => {
        const c = code.toUpperCase();
        
        // 1. BACKDOOR ADMIN (Emergencia)
        if (c === 'ADMIN123') {
             // Try to find admin in already loaded promoters, or fetch directly if needed
             let adminUser = promoters.find(p => p.role === UserRole.ADMIN);
             
             if (!adminUser) {
                 // Try fetching from DB if not in local state
                 const { data } = await supabase.from('profiles').select('*').eq('role', 'ADMIN').single();
                 if (data) {
                    adminUser = {
                        user_id: data.id,
                        name: data.full_name,
                        email: data.email,
                        code: data.code,
                        role: data.role,
                        total_sales: data.total_sales || 0,
                        total_commission_earned: data.total_commission_earned || 0
                    };
                 }
             }

             const user = adminUser || {
                 user_id: 'admin-local', // Fallback, but dangerous for creating orders
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

        // 2. Login Real contra Supabase (Código + Contraseña)
        try {
            let query = supabase
                .from('profiles')
                .select('*')
                .eq('code', c)
                .single();
            
            if (password) {
                const { data, error } = await query;
                
                if (error || !data) return false;

                // Verificación simple de texto plano (MVP)
                if (data.password === password) {
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
                    fetchData();
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
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
                    slug: eventData.title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, ''),
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

            if (eventError) {
                console.error("Supabase Event Error:", eventError);
                throw new Error("Fallo al crear el evento principal.");
            }

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
            if (tiersError) {
                console.error("Supabase Tiers Error:", tiersError);
                alert("Evento creado, pero hubo un error guardando los tickets. Por favor edita el evento.");
            }

            await fetchData();
        } catch (error: any) {
            console.error("Error creating event:", error);
            alert(`Error crítico: ${error.message || 'No se pudo conectar a la base de datos.'}`);
        }
    };

    const updateEvent = async (id: string, eventData: any, tierData: any[]) => {
        try {
            await supabase.from('events').update(eventData).eq('id', id);
            await fetchData();
        } catch (error) {
            console.error("Error updating event:", error);
        }
    };

    const deleteEvent = async (id: string) => {
        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if(error) throw error;
            await fetchData();
        } catch (error) {
            console.error("Error deleting event:", error);
            alert("No se pudo eliminar el evento (Verifica que no tenga ventas asociadas).");
        }
    };

    const addStaff = async (staffData: any) => {
        try {
            // Generamos un UUID random (Evitamos Auth users de Supabase)
            const tempId = crypto.randomUUID();
            
            const { error } = await supabase.from('profiles').insert({
                id: tempId,
                email: `${staffData.name.toLowerCase().replace(/\s+/g, '.')}@midnight.com`,
                full_name: staffData.name,
                code: staffData.code,
                password: staffData.password || '1234', // GUARDAMOS LA CONTRASEÑA
                role: staffData.role,
                sales_team_id: staffData.sales_team_id || null,
                manager_id: staffData.manager_id || null
            });

            if (error) throw error;
            
            await fetchData();
            alert("Usuario creado exitosamente. Ahora puede ingresar con su código y contraseña.");
        } catch (error: any) {
            console.error("Error creating staff:", error);
            alert(`Error al crear usuario: ${error.message}`);
        }
    };

    const deleteStaff = async (id: string) => {
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if(error) throw error;
            await fetchData();
        } catch(error) {
            console.error("Error deleting staff", error);
            alert("Error al eliminar usuario.");
        }
    };

    const createTeam = async (name: string, managerId: string) => {
        try {
            const { error } = await supabase.from('sales_teams').insert({ name, manager_id: managerId });
            if(error) throw error;
            await fetchData();
        } catch (error) {
            console.error("Error creating team:", error);
            alert("Error al crear equipo.");
        }
    };

    const createOrder = async (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => {
        try {
            const orderNumber = `MID-${Date.now().toString().slice(-6)}`;
            const total = cartItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
            
            let commission = 0;
            cartItems.forEach(item => {
                const tier = tiers.find(t => t.id === item.tier_id);
                if (tier) commission += (tier.commission_fixed || 0) * item.quantity;
            });
            
            // SANITIZE STAFF ID: Ensure it's a valid UUID, otherwise null.
            // This prevents 'admin-local' or other invalid strings from crashing the DB insert.
            const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            
            let finalStaffId = null;
            if (staffId && isValidUUID(staffId)) {
                finalStaffId = staffId;
            } else {
                 const storedId = localStorage.getItem('midnight_referral_code_id'); // Assuming this stores UUID
                 if (storedId && isValidUUID(storedId)) {
                     finalStaffId = storedId;
                 }
            }

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
                    staff_id: finalStaffId, // Use sanitized ID
                    commission_amount: finalStaffId ? commission : 0,
                    net_amount: total - (finalStaffId ? commission : 0)
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

            // 3. Update Inventory
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

            // 5. Update Promoter Stats
            if (finalStaffId) {
                const promoter = promoters.find(p => p.user_id === finalStaffId);
                if (promoter) {
                    await supabase.from('profiles').update({
                        total_sales: (promoter.total_sales || 0) + total,
                        total_commission_earned: (promoter.total_commission_earned || 0) + commission
                    }).eq('id', finalStaffId);
                }
            }

            await fetchData(); 
            return { ...order, items: cartItems };

        } catch (error: any) {
            console.error("Error creating order:", error);
            // More descriptive error for debugging
            alert(`Hubo un error al procesar la orden: ${error.message || JSON.stringify(error)}`);
            return null;
        }
    };

    const clearDatabase = async () => {
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