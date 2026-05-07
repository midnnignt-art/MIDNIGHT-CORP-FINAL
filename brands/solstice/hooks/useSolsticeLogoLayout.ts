import { useState, useEffect, useCallback } from 'react';

export type SolsticeLogoAlign = 'left' | 'center' | 'right';

export interface SolsticeLogoLayout {
  align: SolsticeLogoAlign;
  x: number;
  y: number;
}

const EV_PREFIX = 'solstice-logo-layout-';
const KEY_PREFIX = 'solstice_logo_layout_';

const DEFAULTS: Record<string, SolsticeLogoLayout> = {
  landingHero: { align: 'center', x: 0, y: 0 },
};

const sanitize = (value: Partial<SolsticeLogoLayout> | null, fallback: SolsticeLogoLayout): SolsticeLogoLayout => ({
  align: value?.align === 'left' || value?.align === 'right' || value?.align === 'center'
    ? value.align
    : fallback.align,
  x: Number.isFinite(value?.x) ? Number(value?.x) : fallback.x,
  y: Number.isFinite(value?.y) ? Number(value?.y) : fallback.y,
});

export function useSolsticeLogoLayout(
  context: string
): [SolsticeLogoLayout, (layout: Partial<SolsticeLogoLayout>) => void] {
  const key = KEY_PREFIX + context;
  const ev = EV_PREFIX + context;
  const def = DEFAULTS[context] ?? { align: 'center', x: 0, y: 0 };

  const [layout, setLayout] = useState<SolsticeLogoLayout>(() => {
    const stored = localStorage.getItem(key);
    if (!stored) return def;
    try {
      return sanitize(JSON.parse(stored), def);
    } catch {
      return def;
    }
  });

  useEffect(() => {
    const handler = (e: CustomEvent) => setLayout(sanitize(e.detail, def));
    window.addEventListener(ev, handler as EventListener);
    return () => window.removeEventListener(ev, handler as EventListener);
  }, []);

  const update = useCallback((next: Partial<SolsticeLogoLayout>) => {
    setLayout(prev => {
      const merged = sanitize({ ...prev, ...next }, def);
      localStorage.setItem(key, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent(ev, { detail: merged }));
      return merged;
    });
  }, []);

  return [layout, update];
}
