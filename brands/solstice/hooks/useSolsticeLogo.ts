import { useState, useEffect, useCallback } from 'react';

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

  const setLogoUrl = useCallback((url: string) => {
    if (url) localStorage.setItem(STORAGE_KEY, url);
    else localStorage.removeItem(STORAGE_KEY);
    setLogoUrlState(url);
    window.dispatchEvent(new CustomEvent(EV, { detail: url }));
  }, []);

  return [logoUrl, setLogoUrl];
}
