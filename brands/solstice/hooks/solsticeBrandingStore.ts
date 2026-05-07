import { supabase } from '../../../lib/supabase';
import type { SolsticeLogoLayout } from './useSolsticeLogoLayout';

const BRANDING_ID = '00000000-0000-0000-0000-000000000001';

export interface SolsticeBranding {
  logo_url?: string | null;
  logo_sizes?: Record<string, number>;
  logo_layouts?: Record<string, SolsticeLogoLayout>;
}

let cache: SolsticeBranding | null = null;
let loadPromise: Promise<SolsticeBranding | null> | null = null;

export async function loadSolsticeBranding(): Promise<SolsticeBranding | null> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('solstice_branding')
        .select('logo_url, logo_sizes, logo_layouts')
        .eq('id', BRANDING_ID)
        .maybeSingle();

      if (error || !data) return null;
      cache = {
        logo_url: data.logo_url,
        logo_sizes: data.logo_sizes || {},
        logo_layouts: data.logo_layouts || {},
      };
      return cache;
    } catch {
      return null;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export async function saveSolsticeBranding(patch: SolsticeBranding): Promise<void> {
  const next = {
    ...(cache || {}),
    ...patch,
    logo_sizes: { ...(cache?.logo_sizes || {}), ...(patch.logo_sizes || {}) },
    logo_layouts: { ...(cache?.logo_layouts || {}), ...(patch.logo_layouts || {}) },
  };
  cache = next;

  try {
    await supabase
      .from('solstice_branding')
      .upsert({
        id: BRANDING_ID,
        logo_url: next.logo_url || null,
        logo_sizes: next.logo_sizes || {},
        logo_layouts: next.logo_layouts || {},
        updated_at: new Date().toISOString(),
      });
  } catch {
    // Local fallback keeps the admin tool usable if the migration is not present yet.
  }
}
