import { SolsticeSeason, SolsticeWeek } from './types';

export const SOLSTICE_SEASON_MOCK: SolsticeSeason = {
  id: 'solstice-2026',
  name: 'SOLSTICE 2026',
  status: 'open',
  tagline: 'SELECTED BEATS. PRIVATE SUNSET.',
  entry_price: 40000,
  combo_total: 400000,
  installments: 5,
  commission_pct: 10,
  manager_commission_pct: 3,
};

export const SOLSTICE_WEEKS_MOCK: SolsticeWeek[] = [
  { id: 'w1', season_id: 'solstice-2026', university: 'Javeriana',  start_date: '2026-09-14', end_date: '2026-09-20', capacity: 120, reserved: 84 },
  { id: 'w2', season_id: 'solstice-2026', university: 'Los Andes',  start_date: '2026-09-28', end_date: '2026-10-03', capacity: 120, reserved: 105 },
  { id: 'w3', season_id: 'solstice-2026', university: 'CESA',        start_date: '2026-10-05', end_date: '2026-10-11', capacity: 80,  reserved: 42 },
];

export const SOLSTICE_DAYS = [
  { day: 1, title: 'Llegada',       subtitle: 'Apertura nocturna',          price: 70000  },
  { day: 2, title: 'Día libre',     subtitle: 'Fiesta nocturna',            price: 70000  },
  { day: 3, title: 'Catamarán',     subtitle: '50 p · DJ · AYCD · Bahía',  price: 130000, highlight: true },
  { day: 4, title: 'Playa privada', subtitle: 'All you can drink',          price: 100000 },
  { day: 5, title: 'Cierre',        subtitle: 'Última noche',               price: 70000  },
];
