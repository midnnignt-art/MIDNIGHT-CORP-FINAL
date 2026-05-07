import { useState, useEffect, useCallback } from 'react';

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

  const update = useCallback((px: number) => {
    localStorage.setItem(key, String(px));
    setSize(px);
    window.dispatchEvent(new CustomEvent(ev, { detail: px }));
  }, []);

  return [size, update];
}
