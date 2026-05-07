import { useState, useEffect, useCallback } from 'react';
import { loadSolsticeBranding, saveSolsticeBranding } from './solsticeBrandingStore';

const EV_PREFIX = 'solstice-logo-size-';
const KEY_PREFIX = 'solstice_logo_size_';

const DEFAULTS: Record<string, number> = {
  splash:  80,
  landing: 110,
  drawer:  26,
  trigger: 16,
};

export function useSolsticeLogoSize(context: string): [number, (px: number) => void] {
  const key = KEY_PREFIX + context;
  const ev  = EV_PREFIX + context;
  const def = DEFAULTS[context] ?? 40;

  const [size, setSize] = useState<number>(() => {
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : def;
  });

  useEffect(() => {
    const handler = (e: CustomEvent) => setSize(e.detail ?? def);
    window.addEventListener(ev, handler as EventListener);
    return () => window.removeEventListener(ev, handler as EventListener);
  }, []);

  useEffect(() => {
    let active = true;
    loadSolsticeBranding().then(branding => {
      const remoteSize = branding?.logo_sizes?.[context];
      if (!active || typeof remoteSize !== 'number') return;
      localStorage.setItem(key, String(remoteSize));
      setSize(remoteSize);
      window.dispatchEvent(new CustomEvent(ev, { detail: remoteSize }));
    });
    return () => { active = false; };
  }, [context]);

  const update = useCallback((px: number) => {
    localStorage.setItem(key, String(px));
    setSize(px);
    window.dispatchEvent(new CustomEvent(ev, { detail: px }));
    saveSolsticeBranding({ logo_sizes: { [context]: px } });
  }, []);

  return [size, update];
}
