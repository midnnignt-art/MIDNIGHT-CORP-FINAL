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
  // Días activos de ESTA semana (ej. [1,2,3,4] = 4 días). El combo de la semana
  // = suma de los precios de estos días.
  days?: number[];
}
