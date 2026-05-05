export interface SolsticeSeason {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed';
  tagline: string;
  entry_price: number;
  combo_total: number;
  installments: number;
  phase1_price?: number;
  phase1_limit?: number;
  phase2_price?: number;
  early_bird_price?: number;
  early_bird_deadline?: string;
  commission_pct: number;
  manager_commission_pct: number;
}

export interface SolsticeWeek {
  id: string;
  season_id: string;
  university: string;
  start_date: string;
  end_date: string;
  capacity: number;
  reserved: number; // computed from registrations
}

export interface SolsticeSeller {
  id: string;
  user_id: string;
  season_id: string;
  university: string;
  role: 'seller' | 'manager';
  ref_code: string;
  status: 'active' | 'inactive';
  name: string;
}

export interface SolsticeRegistration {
  id: string;
  season_id: string;
  week_id: string;
  user_id: string;
  seller_id?: string;
  ref_code?: string;
  payment_mode: 'auto_subscription' | 'manual_monthly' | 'cash_to_seller' | 'individual_days' | 'full_combo';
  status: 'reserved' | 'active' | 'completed' | 'cancelled' | 'suspended';
  total_amount: number;
  amount_paid: number;
  installments_remaining?: number;
  days_purchased?: number[];
  created_at: string;
}
