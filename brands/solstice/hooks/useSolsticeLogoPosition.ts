import { useState, useEffect, useCallback } from 'react';

const KEY = 'solstice_logo_pos';
const EV  = 'solstice-logo-pos';

export type LogoPos = { x: number; y: number };

export function useSolsticeLogoPosition(): [LogoPos, (pos: LogoPos) => void] {
  const [pos, setPosState] = useState<LogoPos>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { x: 0, y: 0 }; }
    catch { return { x: 0, y: 0 }; }
  });

  useEffect(() => {
    const handler = (e: CustomEvent) => setPosState(e.detail ?? { x: 0, y: 0 });
    window.addEventListener(EV, handler as EventListener);
    return () => window.removeEventListener(EV, handler as EventListener);
  }, []);

  const setPos = useCallback((newPos: LogoPos) => {
    localStorage.setItem(KEY, JSON.stringify(newPos));
    setPosState(newPos);
    window.dispatchEvent(new CustomEvent(EV, { detail: newPos }));
  }, []);

  return [pos, setPos];
}
