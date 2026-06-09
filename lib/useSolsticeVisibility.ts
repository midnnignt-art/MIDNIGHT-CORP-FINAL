import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Feature flag: Solstice visibility en el Conjunction Portal ───────────
// Mientras Solstice no esté listo para mercado, solo admins pueden ver el
// planeta SOLSTICE. El público general ve solo MIDNIGHT centrado.
//
// El flag se persiste en la tabla `solstice_config` (key 'public_visible')
// con LECTURA PÚBLICA, para que cualquier visitante anónimo sepa si Solstice
// está activo. Antes estaba en Storage y no sincronizaba bien entre
// dispositivos (a veces el planeta no le salía a la gente). localStorage
// queda como cache para el primer paint.

const STORAGE_KEY = 'midnight_solstice_public_visible';
const CONFIG_KEY = 'public_visible';

export function useSolsticeVisibility(): [boolean, (next: boolean) => Promise<void>] {
  const initial = (() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  })();

  const [visible, setVisible] = useState<boolean>(initial);

  // Cargar el valor real de la tabla al montar (sobrescribe el cache local).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('solstice_config').select('value').eq('key', CONFIG_KEY).maybeSingle();
        if (cancelled || !data) return;
        const remoteValue = data.value === true || data.value === 'true';
        setVisible(remoteValue);
        try { localStorage.setItem(STORAGE_KEY, String(remoteValue)); } catch {}
      } catch { /* sin remoto, queda el cache local */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Listener para cambios desde otro componente en la misma sesión
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'boolean') setVisible(detail);
    };
    window.addEventListener('solstice-visibility-change', handler);
    return () => window.removeEventListener('solstice-visibility-change', handler);
  }, []);

  const update = async (next: boolean) => {
    setVisible(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
    window.dispatchEvent(new CustomEvent('solstice-visibility-change', { detail: next }));
    try {
      await supabase.from('solstice_config').upsert(
        { key: CONFIG_KEY, value: next, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (err: any) {
      console.warn('No se pudo persistir solstice_config:', err?.message);
    }
  };

  return [visible, update];
}
