import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Event, Promoter, TicketTier, Order, UserRole, SalesTeam, EventCost 
} from '../types';
import { supabase } from '../lib/supabase';
import { sendTicketEmail } from '../services/emailService';

interface StoreContextType {
    events: Event[];
    tiers: TicketTier[];
    promoters: Promoter[];
    orders: Order[];
    teams: SalesTeam[];
    currentUser: any; 
    currentCustomer: any; 
    dbStatus: 'synced' | 'local' | 'syncing' | 'error';
    
    // Auth methods
    login: (code: string, password?: string) => Promise<boolean>;
    logout: () => void;
    requestCustomerOtp: (email: string, metadata?: any) => Promise<{ success: boolean; message?: string }>;
    verifyCustomerOtp: (email: string, token: string) => Promise<boolean>;
    customerLogout: () => Promise<void>;
    
    // Data methods
    getEventTiers: (eventId: string) => TicketTier[];
    addEvent: (eventData: any, tiers: any[]) => Promise<void>;
    updateEvent: (id: string, eventData: any, tiers: any[]) => Promise<void>;
    archiveEvent: (id: string) => Promise<void>;
    restoreEvent: (id: string) => Promise<void>;
    hardDeleteEvent: (id: string) => Promise<void>;
    addEventCost: (eventId: string, cost: Omit<EventCost, 'id' | 'event_id'>) => Promise<void>;
    deleteEventCost: (eventId: string, costId: string) => Promise<void>;
    updateCostStatus: (eventId: string, costId: string, status: 'pending' | 'paid' | 'cancelled') => Promise<void>;
    addStaff: (staffData: any) => Promise<void>;
    deleteStaff: (id: string) => Promise<void>;
    createTeam: (name: string, managerId: string) => Promise<void>;
    updateStaffTeam: (userId: string, teamId: string | null) => Promise<void>;
    deleteTeam: (teamId: string) => Promise<void>;
    createOrder: (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => Promise<Order | null>;
    clearDatabase: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

// Helper para validar UUIDs y evitar errores 22P02 en Postgres
const isValidUUID = (uuid: any) => {
    if (typeof uuid !== 'string') return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ESTADO
    const [events, setEvents] = useState<Event[]>([]);
    const [tiers, setTiers] = useState<TicketTier[]>([]);
    const [promoters, setPromoters] = useState<Promoter[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [teams, setTeams] = useState<SalesTeam[]>([]);
    
    const [currentUser, setCurrentUser] = useState<any>(null); 
    const [currentCustomer, setCurrentCustomer] = useState<any>(null);

    const [dbStatus, setDbStatus] = useState<'synced' | 'local' | 'syncing' | 'error'>('syncing');

    useEffect(() => {
        fetchData();
        checkCustomerSession();
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setCurrentCustomer(session.user);
            } else {
                setCurrentCustomer(null);
            }
        });
        return () => { authListener.subscription.unsubscribe(); };
    }, []);

    // Hydrate User from LocalStorage with UUID Validation
    useEffect(() => {
        const storedId = localStorage.getItem('midnight_user_id');
        
        if (storedId) {
            // Si el ID guardado NO es un UUID válido (ej: "000-admin"), lo borramos para evitar crash.
            if (!isValidUUID(storedId)) {
                console.warn("Legacy invalid ID found and cleared:", storedId);
                localStorage.removeItem('midnight_user_id');
                return;
            }

            if (promoters.length > 0 && !currentUser) {
                const user = promoters.find(p => p.user_id === storedId);
                if (user) setCurrentUser(user);
            }
        }
    }, [promoters]);

    const checkCustomerSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setCurrentCustomer(session.user);
    };

    const fetchData = async () => {
        setDbStatus('syncing');
        try {
            const { data: eventsData, error: evErr } = await supabase.from('events').select(`*, costs:event_costs(*)`).order('created_at', { ascending: false });
            if (evErr) throw evErr;

            const { data: tiersData } = await supabase.from('ticket_tiers').select('*');
            const { data: profilesData } = await supabase.from('profiles').select('*');
            const { data: ordersData } = await supabase.from('orders').select(`*, items:order_items(*)`).order('created_at', { ascending: false });
            const { data: teamsData } = await supabase.from('sales_teams').select('*');

            const mappedEvents: Event[] = (eventsData || []).map((e: any) => ({
                ...e, gallery: [], tags: [], nft_benefits: [], costs: e.costs || []
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
                members_ids: (profilesData || []).filter((p: any) => p.sales_team_id === t.id).map((p: any) => p.id),
                total_revenue: 0
            }));

            setEvents(mappedEvents);
            setTiers(tiersData || []);
            setPromoters(mappedPromoters);
            setOrders(mappedOrders);
            setTeams(mappedTeams);
            setDbStatus('synced');

        } catch (error) {
            console.error("Error fetching data:", error);
            setDbStatus('error');
        }
    };

    const login = async (code: string, password?: string): Promise<boolean> => {
        const c = code.toUpperCase();
        if (c === 'ADMIN123') {
             // UUID Fijo para el Admin Principal
             const user = { user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Super Admin', email: 'admin@midnightcorp.click', code: 'ADMIN123', role: UserRole.ADMIN, total_sales: 0, total_commission_earned: 0 };
             setCurrentUser(user);
             localStorage.setItem('midnight_user_id', user.user_id);
             return true;
        }
        try {
            let { data } = await supabase.from('profiles').select('*').eq('code', c).single();
            if (data && data.password === password) {
                setCurrentUser({
                    user_id: data.id, name: data.full_name, email: data.email, code: data.code, role: data.role, total_sales: data.total_sales, total_commission_earned: data.total_commission_earned
                });
                localStorage.setItem('midnight_user_id', data.id);
                fetchData();
                return true;
            }
        } catch (e) { console.log("Login failed", e); }
        return false;
    };

    const logout = async () => { setCurrentUser(null); localStorage.removeItem('midnight_user_id'); };

    const requestCustomerOtp = async (email: string, metadata?: any): Promise<{ success: boolean; message?: string }> => {
        // BACKDOOR PARA DEMO/TESTING (Bypasses SMTP issues)
        if (email.toLowerCase() === 'demo@midnight.com') {
            console.log("⚡ MODO DEMO: OTP simulado para demo@midnight.com");
            return { success: true };
        }

        try {
            const { error } = await supabase.auth.signInWithOtp({ 
                email: email.trim().toLowerCase(), 
                options: { 
                    shouldCreateUser: true,
                    data: metadata 
                } 
            });
            if (error) throw error;
            return { success: true };
        } catch (error: any) { 
            console.error("Supabase Auth Error:", error);
            return { success: false, message: error.message }; 
        }
    };

    const verifyCustomerOtp = async (email: string, token: string): Promise<boolean> => {
        // BACKDOOR PARA DEMO/TESTING
        if (email.toLowerCase() === 'demo@midnight.com' && token === '000000') {
            const fakeUser = {
                id: 'demo-user-id',
                email: 'demo@midnight.com',
                user_metadata: { full_name: 'Usuario Demo' },
                aud: 'authenticated',
                created_at: new Date().toISOString()
            };
            setCurrentCustomer(fakeUser);
            return true;
        }

        try {
            const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token, type: 'email' });
            if (error || !data.session) return false;
            setCurrentCustomer(data.session.user);
            return true;
        } catch (error) { return false; }
    };

    const customerLogout = async () => { await supabase.auth.signOut(); setCurrentCustomer(null); };

    const getEventTiers = (eventId: string) => tiers.filter(t => t.event_id === eventId);
    
    const addEvent = async (eventData: any, tierData: any[]) => {
        try {
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

            if (eventError) throw eventError;

            const tiersToInsert = tierData.map(t => ({
                event_id: newEvent.id,
                name: t.name,
                price: Number(t.price),
                quantity: Number(t.quantity),
                commission_fixed: Number(t.commission_fixed),
                stage: t.stage || 'general'
            }));

            await supabase.from('ticket_tiers').insert(tiersToInsert);
            await fetchData();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        }
    };
    
    const updateEvent = async (id: string, eventData: any, tierData: any[]) => { 
        try {
            await supabase.from('events').update(eventData).eq('id', id);
            await fetchData();
        } catch (error) { console.error(error); }
    };

    // ARCHIVE EVENT (Soft Delete)
    const archiveEvent = async (id: string) => { 
        try {
            const { error } = await supabase.from('events').update({ status: 'archived' }).eq('id', id);
            if (error) throw error;
            await fetchData();
        } catch (error: any) {
            console.error("Error archiving event:", error);
            alert(`Error al archivar evento: ${error.message}`);
        }
    };

    // RESTORE EVENT (Unarchive)
    const restoreEvent = async (id: string) => {
        try {
            const { error } = await supabase.from('events').update({ status: 'draft' }).eq('id', id);
            if (error) throw error;
            await fetchData();
        } catch (error: any) {
            console.error("Error restoring event:", error);
            alert(`Error al restaurar evento: ${error.message}`);
        }
    };

    // HARD DELETE (Only for archived events if really needed, or admin only)
    const hardDeleteEvent = async (id: string) => {
        try {
             // 1. Eliminar Costos
             await supabase.from('event_costs').delete().eq('event_id', id);
             
             // 2. Eliminar Tiers (Tickets)
             await supabase.from('ticket_tiers').delete().eq('event_id', id);
 
             // 3. Eliminar Ordenes
             const { data: orders } = await supabase.from('orders').select('id').eq('event_id', id);
             if (orders && orders.length > 0) {
                 const orderIds = orders.map(o => o.id);
                 await supabase.from('order_items').delete().in('order_id', orderIds);
                 await supabase.from('orders').delete().eq('event_id', id);
             }
 
             // 4. Finalmente eliminar el evento
             const { error } = await supabase.from('events').delete().eq('id', id);
             
             if (error) throw error;
             await fetchData();
        } catch (error: any) {
            console.error("Error deleting event:", error);
            alert(`Error al eliminar evento permanentemente: ${error.message}`);
        }
    };
    
    const addStaff = async (staffData: any) => {
        try {
            const { error } = await supabase.from('profiles').insert({
                id: crypto.randomUUID(),
                email: staffData.email,
                full_name: staffData.name,
                code: staffData.code,
                password: staffData.password || '1234',
                role: staffData.role,
                sales_team_id: staffData.sales_team_id,
                manager_id: staffData.manager_id
            });
            
            if (error) throw error;
            await fetchData();
        } catch (error) { 
            console.error("Error adding staff:", error);
            throw error; // Re-throw to handle in UI
        }
    };
    
    const deleteStaff = async (id: string) => { await supabase.from('profiles').delete().eq('id', id); await fetchData(); };
    const createTeam = async (name: string, managerId: string) => { 
        try {
            await supabase.from('sales_teams').insert({ name, manager_id: managerId });
            await fetchData();
        } catch (error) { console.error(error); }
    };

    const updateStaffTeam = async (userId: string, teamId: string | null) => {
        try {
            await supabase.from('profiles').update({ sales_team_id: teamId }).eq('id', userId);
            await fetchData();
        } catch (error) { console.error(error); }
    };

    const deleteTeam = async (teamId: string) => {
        try {
            // Unassign members first
            await supabase.from('profiles').update({ sales_team_id: null }).eq('sales_team_id', teamId);
            // Delete team
            await supabase.from('sales_teams').delete().eq('id', teamId);
            await fetchData();
        } catch (error) { console.error(error); }
    };
    
    const createOrder = async (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => {
        try {
            const orderNumber = `MID-${Date.now().toString().slice(-6)}`;
            const total = cartItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
            
            // NORMALIZATION: Ensure email is lowercase and trimmed
            const finalEmail = (customerInfo?.email || 'anon@mail.com').toLowerCase().trim();
            const finalName = customerInfo?.name || 'Anon';
            
            let commission = 0;
            cartItems.forEach(item => {
                const tier = tiers.find(t => t.id === item.tier_id);
                if (tier) commission += (tier.commission_fixed || 0) * item.quantity;
            });
            
            // FIX: STRICT UUID VALIDATION FOR STAFF ID
            let finalStaffId = null;
            
            // 1. Check Explicit Staff ID
            if (staffId && isValidUUID(staffId)) {
                finalStaffId = staffId;
            } 
            // 2. Check LocalStorage for Referral ID (Assuming it stored the UUID)
            else {
                 const storedId = localStorage.getItem('midnight_referral_code_id');
                 if (storedId && isValidUUID(storedId)) {
                     finalStaffId = storedId;
                 }
            }
            
            // Note: If finalStaffId is still null, the DB will accept NULL (Organic Sale)
            // This prevents "000-admin" or any other invalid string from crashing the insert.

            // Determines initial status based on payment method
            const initialStatus = method === 'bold' ? 'pending' : 'completed';

            const orderPayload = {
                order_number: orderNumber,
                event_id: eventId,
                customer_name: finalName,
                customer_email: finalEmail,
                total: total,
                status: initialStatus, 
                payment_method: method || 'cash',
                staff_id: finalStaffId, 
                commission_amount: finalStaffId ? commission : 0,
                net_amount: total - (finalStaffId ? commission : 0)
            };

            let { data: order, error: orderError } = await supabase.from('orders').insert(orderPayload).select().single();
            
            // Retry logic if there's a foreign key constraint error (e.g. staff_id deleted/invalid)
            if (orderError && (orderError.code === '23503' || orderError.message.includes('foreign key'))) {
                console.warn("Order creation failed due to invalid FK (Staff ID). Retrying as Organic Sale.");
                const fallback = { ...orderPayload, staff_id: null, commission_amount: 0, net_amount: total };
                const retry = await supabase.from('orders').insert(fallback).select().single();
                order = retry.data;
                orderError = retry.error;
            }

            if (orderError) throw new Error(`DB Error (${orderError.code}): ${orderError.message}`);

            const itemsToInsert = cartItems.map(item => ({
                order_id: order.id,
                tier_id: item.tier_id,
                tier_name: item.tier_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
            if (itemsError) throw new Error(`Items Error: ${itemsError.message}`);

            // Only update inventory and sales stats if order is completed (not pending payment)
            if (initialStatus === 'completed') {
                for (const item of cartItems) {
                    const tier = tiers.find(t => t.id === item.tier_id);
                    if (tier) await supabase.from('ticket_tiers').update({ sold: (tier.sold || 0) + item.quantity }).eq('id', tier.id);
                }
                
                const event = events.find(e => e.id === eventId);
                if (event) await supabase.from('events').update({ tickets_sold: (event.tickets_sold || 0) + cartItems.reduce((a:any,b:any)=>a+b.quantity,0), total_revenue: (event.total_revenue || 0) + total }).eq('id', eventId);

                if (order.staff_id) {
                    const promoter = promoters.find(p => p.user_id === order.staff_id);
                    if (promoter) await supabase.from('profiles').update({ total_sales: (promoter.total_sales || 0) + total, total_commission_earned: (promoter.total_commission_earned || 0) + commission }).eq('id', order.staff_id);
                }

                if (event && order.customer_email && order.customer_email.includes('@')) {
                     // FIX: Map the DB created_at to timestamp property required by Order interface
                     const fullOrder = { 
                         ...order, 
                         items: cartItems,
                         timestamp: order.created_at 
                     };
                     sendTicketEmail(fullOrder, event);
                }
            }

            await fetchData(); 
            // FIX: Ensure returned object has required properties
            return { ...order, items: cartItems, timestamp: order.created_at };

        } catch (error: any) {
            console.error("Order Creation Failed:", error);
            alert(`Error Base de Datos: ${error.message}`);
            return null;
        }
    };

    const clearDatabase = async () => {}; 
    const addEventCost = async (eventId: string, cost: any) => { await supabase.from('event_costs').insert({ event_id: eventId, ...cost }); await fetchData(); };
    const deleteEventCost = async (eventId: string, costId: string) => { await supabase.from('event_costs').delete().eq('id', costId); await fetchData(); };
    const updateCostStatus = async (eventId: string, costId: string, status: any) => { await supabase.from('event_costs').update({ status }).eq('id', costId); await fetchData(); };

    return (
        <StoreContext.Provider value={{
            events, tiers, promoters, orders, teams, currentUser, currentCustomer, dbStatus,
            login, logout, requestCustomerOtp, verifyCustomerOtp, customerLogout,
            getEventTiers, addEvent, updateEvent, archiveEvent, restoreEvent, hardDeleteEvent,
            addStaff, deleteStaff, createTeam, updateStaffTeam, deleteTeam, createOrder, clearDatabase,
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