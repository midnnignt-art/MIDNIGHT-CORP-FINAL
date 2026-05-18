import { supabase } from './supabase';

export type PaseTier = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface PaseLevel {
  tier: PaseTier;
  events_count: number;
  total_spent: number;
  next_tier: PaseTier | null;
  next_tier_at: { events?: number; spent?: number; events_left?: number } | null;
}

export const TIER_META: Record<PaseTier, { label: string; color: string; bg: string; benefits: string[] }> = {
  NONE: {
    label: 'Sin Pase',
    color: '#6B6B7A',
    bg: 'rgba(107,107,122,0.10)',
    benefits: ['Hace tu primera compra y activa tu Pase MIDNIGHT'],
  },
  BRONZE: {
    label: 'Bronze',
    color: '#C9854C',
    bg: 'rgba(201,133,76,0.12)',
    benefits: ['Acceso a la app · QR único · Transferencia entre amigos'],
  },
  SILVER: {
    label: 'Silver',
    color: '#D5D5D5',
    bg: 'rgba(213,213,213,0.10)',
    benefits: ['10% off en próximo evento', 'Early access 24h antes del drop', 'Notificaciones prioritarias'],
  },
  GOLD: {
    label: 'Gold',
    color: '#E5C24A',
    bg: 'rgba(229,194,74,0.14)',
    benefits: ['Guest list automática en eventos elegibles', 'Drinks de cortesía', 'Lineup previews', 'Soporte prioritario'],
  },
  PLATINUM: {
    label: 'Platinum',
    color: '#B026FF',
    bg: 'rgba(176,38,255,0.14)',
    benefits: ['Acceso VIP a todos los eventos', 'Lineup previews 7 días antes', 'Eventos privados', 'Invitación al inner circle'],
  },
};

export async function fetchPaseLevel(email: string | null | undefined): Promise<PaseLevel | null> {
  if (!email) return null;
  try {
    const { data, error } = await supabase.rpc('fn_pase_level', { p_email: email });
    if (error) {
      console.warn('[pase] fn_pase_level failed:', error.message);
      return null;
    }
    return data as PaseLevel;
  } catch (err: any) {
    console.warn('[pase] error:', err?.message ?? err);
    return null;
  }
}
