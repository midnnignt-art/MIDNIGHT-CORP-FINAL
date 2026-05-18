import { useState, useEffect, useCallback } from 'react';
import { loadSolsticeBranding, saveSolsticeBranding } from './solsticeBrandingStore';

const STORAGE_KEY = 'solstice_logo_url';
const EV = 'solstice-logo-change';
// Logo oficial servido desde /public — fallback consistente entre devices
// cuando admin no ha subido nada o cuando localStorage está vacío.
const DEFAULT_LOGO = '/brand-logo.png';

export function useSolsticeLogo(): [string, (url: string) => void] {
  const [logoUrl, setLogoUrlState] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY) || DEFAULT_LOGO
  );

  useEffect(() => {
    const handler = (e: CustomEvent) => setLogoUrlState(e.detail || DEFAULT_LOGO);
    window.addEventListener(EV, handler as EventListener);
    return () => window.removeEventListener(EV, handler as EventListener);
  }, []);

  useEffect(() => {
    let active = true;
    loadSolsticeBranding().then(branding => {
      if (!active) return;
      const url = branding?.logo_url || DEFAULT_LOGO;
      localStorage.setItem(STORAGE_KEY, url);
      setLogoUrlState(url);
      window.dispatchEvent(new CustomEvent(EV, { detail: url }));
    });
    return () => { active = false; };
  }, []);

  const setLogoUrl = useCallback((url: string) => {
    const final = url || DEFAULT_LOGO;
    localStorage.setItem(STORAGE_KEY, final);
    setLogoUrlState(final);
    window.dispatchEvent(new CustomEvent(EV, { detail: final }));
    // En Supabase guardamos null si el admin "borra" el logo, así otros devices
    // también vuelven al default.
    saveSolsticeBranding({ logo_url: url || null });
  }, []);

  return [logoUrl, setLogoUrl];
}
