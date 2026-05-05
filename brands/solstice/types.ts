export interface SolsticeSeason {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'closed';
  tagline: string;
  entry_price: number;
  combo_total: number;
  installments: number;
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
  reserved: number;
}
