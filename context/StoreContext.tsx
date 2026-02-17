import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Event, Promoter, TicketTier, Order, UserRole, SalesTeam, EventCost 
} from '../types';

// DATOS MOCK INICIALES (Para que la app no esté vacía al iniciar)
const INITIAL_EVENTS: Event[] = [
    {
        id: 'evt-1',
        title: 'Midnight Launch Party',
        slug: 'midnight-launch',
        description: 'El inicio de una nueva era en entretenimiento nocturno.',
        cover_image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
        venue: 'The Grand Hall',
        venue_address: '123 Main St',
        city: 'Ciudad de México',
        event_date: '2024-12-31T22:00:00',
        doors_open: '21:00',
        status: 'published',
        current_stage: 'early_bird',
        total_capacity: 500,
        tickets_sold: 0,
        total_revenue: 0,
        available_funds: 0,
        operational_reserve: 0,
        commission_pool: 0,
        featured: true,
        tags: ['Party', 'Launch'],
        artists: ['Daft Punk Tribute', 'Local Heroes'],
        nft_benefits: [],
        costs: [],
        gallery: []
    }
];

const INITIAL_TIERS: TicketTier[] = [
    { id: 't-1', event_id: 'evt-1', name: 'General Early Bird', price: 50, quantity: 200, sold: 0, commission_fixed: 5, stage: 'early_bird', active: true, commission_percent: 0, operational_percent: 0, color: '', description: '', perks: [] },
    { id: 't-2', event_id: 'evt-1', name: 'VIP Access', price: 150, quantity: 50, sold: 0, commission_fixed: 15, stage: 'presale', active: true, commission_percent: 0, operational_percent: 0, color: '', description: '', perks: [] }
];

const INITIAL_PROMOTERS: Promoter[] = [
    { user_id: '000-admin', name: 'Midnight Admin', email: 'admin@midnight.com', code: 'ADMIN123', role: UserRole.ADMIN, total_sales: 0, total_commission_earned: 0 },
    { user_id: '001-manager', name: 'Jefe de Ventas', email: 'sales@midnight.com', code: 'SALES1', role: UserRole.HEAD_OF_SALES, total_sales: 0, total_commission_earned: 0 }
];

interface StoreContextType {
    events: Event[];
    tiers: TicketTier[];
    promoters: Promoter[];
    orders: Order[];
    teams: SalesTeam[];
    currentUser: any;
    dbStatus: 'synced' | 'local';
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
    // ESTADO LOCAL (Simulando Base de Datos)
    const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
    const [tiers, setTiers] = useState<TicketTier[]>(INITIAL_TIERS);
    const [promoters, setPromoters] = useState<Promoter[]>(INITIAL_PROMOTERS);
    const [orders, setOrders] = useState<Order[]>([]);
    const [teams, setTeams] = useState<SalesTeam[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [dbStatus] = useState<'synced' | 'local'>('local');

    // Recuperar sesión si existe
    useEffect(() => {
        const storedId = localStorage.getItem('midnight_referral_code_id');
        if (storedId) {
            const user = promoters.find(p => p.user_id === storedId);
            if (user) setCurrentUser(user);
        }
    }, []);

    const login = async (code: string) => {
        const c = code.toUpperCase();
        // Backdoor para Admin
        if (c === 'ADMIN123') {
             const adminUser = promoters.find(p => p.code === 'ADMIN123');
             if(adminUser) {
                 setCurrentUser(adminUser);
                 localStorage.setItem('midnight_referral_code_id', adminUser.user_id);
                 return true;
             }
        }
        
        const user = promoters.find(p => p.code === c);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('midnight_referral_code_id', user.user_id);
            return true;
        }
        return false;
    };

    const logout = () => { 
        setCurrentUser(null); 
        localStorage.removeItem('midnight_referral_code_id'); 
    };

    const getEventTiers = (eventId: string) => tiers.filter(t => t.event_id === eventId);

    const addEvent = async (eventData: any, tierData: any[]) => {
        const newEventId = `evt-${Date.now()}`;
        const newEvent: Event = {
            id: newEventId,
            ...eventData,
            slug: eventData.title.toLowerCase().replace(/ /g, '-'),
            status: 'published',
            tickets_sold: 0,
            total_revenue: 0,
            available_funds: 0,
            operational_reserve: 0,
            commission_pool: 0,
            featured: false,
            tags: [],
            artists: [],
            nft_benefits: [],
            created_at: new Date().toISOString(),
            costs: []
        };

        const newTiers = tierData.map((t, idx) => ({
            id: `tier-${newEventId}-${idx}`,
            event_id: newEventId,
            ...t,
            sold: 0,
            active: true
        }));

        setEvents(prev => [...prev, newEvent]);
        setTiers(prev => [...prev, ...newTiers]);
    };

    const updateEvent = async (id: string, eventData: any, tierData: any[]) => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, ...eventData } : e));
        
        // Reemplazar tiers (estrategia simple: borrar y crear nuevos para este evento)
        const keptTiers = tiers.filter(t => t.event_id !== id);
        const newTiers = tierData.map((t, idx) => ({
            id: t.id || `tier-${id}-${Date.now()}-${idx}`,
            event_id: id,
            ...t,
            sold: t.sold || 0, // Mantener vendidos si existen
            active: true
        }));
        
        setTiers([...keptTiers, ...newTiers]);
    };

    const deleteEvent = async (id: string) => {
        setEvents(prev => prev.filter(e => e.id !== id));
        setTiers(prev => prev.filter(t => t.event_id !== id));
    };

    const addStaff = async (staffData: any) => {
        const newStaff: Promoter = {
            user_id: `user-${Date.now()}`,
            ...staffData,
            total_sales: 0,
            total_commission_earned: 0,
            email: `${staffData.name.toLowerCase().replace(' ', '.')}@midnight.com`
        };
        setPromoters(prev => [...prev, newStaff]);
        
        // Si pertenece a un equipo, actualizar el equipo
        if (staffData.sales_team_id) {
            setTeams(prev => prev.map(t => 
                t.id === staffData.sales_team_id 
                ? { ...t, members_ids: [...t.members_ids, newStaff.user_id] }
                : t
            ));
        }
    };

    const deleteStaff = async (id: string) => {
        setPromoters(prev => prev.filter(p => p.user_id !== id));
    };

    const createTeam = async (name: string, managerId: string) => {
        const newTeam: SalesTeam = {
            id: `team-${Date.now()}`,
            name,
            manager_id: managerId,
            total_revenue: 0,
            members_ids: []
        };
        setTeams(prev => [...prev, newTeam]);
    };

    const createOrder = async (eventId: string, cartItems: any[], method: string, staffId?: string, customerInfo?: any) => {
        const orderNumber = `MID-${Date.now().toString().slice(-6)}`;
        const total = cartItems.reduce((acc, i) => acc + (i.unit_price * i.quantity), 0);
        
        // Atribución de venta
        // FIX: Ensure it is string | undefined, never null
        const attributedStaffId = staffId || localStorage.getItem('midnight_referral_code_id') || undefined;
        let commission = 0;
        
        cartItems.forEach(item => {
            const tier = tiers.find(t => t.id === item.tier_id);
            if (tier) commission += (tier.commission_fixed || 0) * item.quantity;
        });

        const newOrder: Order = {
            id: `ord-${Date.now()}`,
            order_number: orderNumber,
            event_id: eventId,
            customer_name: customerInfo?.name || 'Anon',
            customer_email: customerInfo?.email || 'anon@mail.com',
            total,
            status: 'completed',
            items: cartItems,
            staff_id: attributedStaffId,
            commission_amount: attributedStaffId ? commission : 0,
            timestamp: new Date().toISOString(),
            operational_amount: 0,
            net_amount: total - commission
        };

        setOrders(prev => [newOrder, ...prev]);

        // Actualizar contadores
        setTiers(prev => prev.map(t => {
            const item = cartItems.find(i => i.tier_id === t.id);
            if (item) return { ...t, sold: t.sold + item.quantity };
            return t;
        }));

        setEvents(prev => prev.map(e => {
            if (e.id === eventId) {
                const qty = cartItems.reduce((a, b) => a + b.quantity, 0);
                return { 
                    ...e, 
                    tickets_sold: e.tickets_sold + qty,
                    total_revenue: e.total_revenue + total
                };
            }
            return e;
        }));

        // Actualizar métricas del promotor
        if (attributedStaffId) {
            setPromoters(prev => prev.map(p => {
                if (p.user_id === attributedStaffId) {
                    return {
                        ...p,
                        total_sales: p.total_sales + total,
                        total_commission_earned: p.total_commission_earned + commission
                    };
                }
                return p;
            }));
        }

        return newOrder;
    };

    const clearDatabase = async () => {
        setEvents([]);
        setOrders([]);
        setTiers([]);
        setTeams([]);
        // Mantener admin
        setPromoters(INITIAL_PROMOTERS);
    };

    const addEventCost = async (eventId: string, cost: any) => {
        setEvents(prev => prev.map(e => {
            if (e.id === eventId) {
                return { ...e, costs: [...e.costs, { ...cost, id: `cost-${Date.now()}`, event_id: eventId }] };
            }
            return e;
        }));
    };

    const deleteEventCost = async (eventId: string, costId: string) => {
        setEvents(prev => prev.map(e => {
            if (e.id === eventId) {
                return { ...e, costs: e.costs.filter(c => c.id !== costId) };
            }
            return e;
        }));
    };

    const updateCostStatus = async (eventId: string, costId: string, status: 'pending' | 'paid' | 'cancelled') => {
        setEvents(prev => prev.map(e => {
            if (e.id === eventId) {
                return {
                    ...e,
                    costs: e.costs.map(c => c.id === costId ? { ...c, status } : c)
                };
            }
            return e;
        }));
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