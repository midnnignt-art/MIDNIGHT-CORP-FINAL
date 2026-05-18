// Detección de dispositivos low-end para activar modo lite automáticamente.
// Importante: con 20k+ visitas concurrentes, una porción significativa estará
// en hardware modesto (Android budget, laptops viejas). El modo lite mantiene
// el look pero quita los filtros caros (feTurbulence) y reduce conteos.

import { useEffect, useState } from 'react';

export function detectLowEnd(): boolean {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as any).deviceMemory ?? 4;
  const ua = navigator.userAgent || '';
  const isOldAndroid = /Android\s[1-7]\./.test(ua);
  // Save-data hint del usuario
  const saveData = (navigator as any).connection?.saveData === true;
  return cores < 4 || mem < 4 || isOldAndroid || saveData;
}

export function useLowEnd(): boolean {
  const [lite, setLite] = useState(false);
  useEffect(() => { setLite(detectLowEnd()); }, []);
  return lite;
}
