

export enum UserRole {
  GUEST = 'GUEST',
  PROMOTER = 'PROMOTER', 
  MANAGER = 'MANAGER',   
  HEAD_OF_SALES = 'HEAD_OF_SALES', 
  ADMIN = 'ADMIN', 
  BOUNCER = 'BOUNCER',
}

export type EventStatus = 'draft' | 'published' | 'sold_out' | 'cancelled' | 'completed' | 'archived';
export type EventStage = 'early_bird' | 'presale' | 'general' | 'door';
export type WalletType = 'event' | 'operational' | 'commission' | 'general';
export type TransactionType = 'sale' | 'commission' | 'withdrawal' | 'transfer' | 'refund' | 'fee';

export interface GalleryItem {
  id: string;
  image_url: string;
  city: string;
  date: string;
  row: 1 | 2;
  order: number;
}

export interface EventCost {
  id: string;
  event_id: string;
  concept: string;
  category: 'venue' | 'production' | 'staff' | 'marketing' | 'artists' | 'logistics' | 'other';
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  notes?: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image: string;
  gallery: string[];
  venue: string;
  venue_address: string;
  city: string;
  event_date: string;
  doors_open: string;
  status: EventStatus;
  current_stage: EventStage;
  total_capacity: number;
  tickets_sold: number;
  total_revenue: number;
  available_funds: number;
  operational_reserve: number;
  commission_pool: number;
  featured: boolean;
  tags: string[];
  artists: string[];
  nft_benefits: string[];
  costs: EventCost[]; 
}

export interface TicketTier {
  id: string;
  event_id: string;
  name: string;
  description: string;
  stage: EventStage;
  price: number;
  quantity: number;
  sold: number;
  commission_fixed: number;
  commission_percent: number;
  operational_percent: number;
  color: string;
  perks: string[];
  active: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  event_id: string;
  customer_email: string;
  customer_name: string;
  total: number;
  status: 'pending' | 'completed' | 'failed';
  payment_method?: string;
  used: boolean;
  used_at?: string;
  items: {
    tier_id: string;
    tier_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  timestamp: string;
  staff_id?: string; // Atribución de venta
  commission_amount: number;
  operational_amount: number;
  net_amount: number;
}

export interface SalesTeam {
  id: string;
  name: string;
  manager_id: string; // ID del Manager que lidera el equipo
  team_lead_id?: string; // Head of Sales superior
  total_revenue: number;
  members_ids: string[];
}

export interface Promoter {
  user_id: string;
  name: string;
  email: string;
  code: string; 
  role: UserRole | 'team_lead' | 'manager' | 'promoter';
  sales_team_id?: string; // Equipo al que pertenece
  manager_id?: string; // Jefe directo
  total_sales: number; // Ventas propias
  total_commission_earned: number;
  team_sales_volume?: number; // Ventas de su equipo (si es manager)
}

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  event_id?: string;
  balance: number;
  available_balance: number;
  pending_balance: number;
  total_inflow: number;
  total_outflow: number;
  status: 'active' | 'frozen' | 'closed';
  auto_distribute: boolean;
  distribution_rules: {
    operational_percent: number;
    commission_percent: number;
    free_percent: number;
  };
}

export interface Transaction {
  id: string;
  wallet_id: string;
  event_id?: string;
  order_id?: string;
  type: TransactionType;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  reference?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  promoter_id?: string;
  timestamp: string;
}