import { useState, useEffect, useCallback } from 'react';
import { loadSolsticeBranding, saveSolsticeBranding } from './solsticeBrandingStore';

const STORAGE_KEY = 'solstice_logo_url';
const EV = 'solstice-logo-change';

export function useSolsticeLogo(): [string, (url: string) => void] {
  const [logoUrl, setLogoUrlState] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY) || ''
  );

  useEffect(() => {
    const handler = (e: CustomEvent) => setLogoUrlState(e.detail || '');
    window.addEventListener(EV, handler as EventListener);
    return () => window.removeEventListener(EV, handler as EventListener);
  }, []);

  useEffect(() => {
    let active = true;
    loadSolsticeBranding().then(branding => {
      if (!active || !branding?.logo_url) return;
      localStorage.setItem(STORAGE_KEY, branding.logo_url);
      setLogoUrlState(branding.logo_url);
      window.dispatchEvent(new CustomEvent(EV, { detail: branding.logo_url }));
    });
    return () => { active = false; };
  }, []);

  const setLogoUrl = useCallback((url: string) => {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
    setLogoUrlState(url);
    window.dispatchEvent(new CustomEvent(EV, { detail: url }));
    saveSolsticeBranding({ logo_url: url || null });
  }, []);

  return [logoUrl, setLogoUrl];
}
