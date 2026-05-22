import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// ─── Feature flag: Solstice visibility en el Conjunction Portal ───────────
// Mientras Solstice no esté listo para mercado, solo admins pueden ver el
// planeta SOLSTICE. El público general ve solo MIDNIGHT centrado.
// El flag se persiste en Supabase Storage (bucket assets, path
// 'config/solstice_visibility.json') para que se sincronice entre devices
// del owner sin necesidad de tabla nueva. Localstorage queda como cache.

const STORAGE_KEY = 'midnight_solstice_public_visible';
const REMOTE_PATH = 'config/solstice_visibility.json';

export function useSolsticeVisibility(): [boolean, (next: boolean) => Promise<void>] {
  const initial = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw === 'true';
    } catch {
      return false;
    }
  })();

  const [visible, setVisible] = useState<boolean>(initial);

  // Cargar valor remoto al montar (sobrescribe cache local)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.storage.from('assets').download(REMOTE_PATH);
        if (!data || cancelled) return;
        const text = await data.text();
        const json = JSON.parse(text);
        const remoteValue = !!json.solstice_public_visible;
        if (!cancelled) {
          setVisible(remoteValue);
          localStorage.setItem(STORAGE_KEY, String(remoteValue));
        }
      } catch {
        // Si el archivo no existe todavía, el default es false (oculto).
      }
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
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent('solstice-visibility-change', { detail: next }));
    try {
      const blob = new Blob([JSON.stringify({ solstice_public_visible: next, updated_at: new Date().toISOString() })], {
        type: 'application/json',
      });
      await supabase.storage.from('assets').upload(REMOTE_PATH, blob, { upsert: true });
    } catch (err: any) {
      console.warn('No se pudo persistir solstice_visibility en Storage:', err?.message);
    }
  };

  return [visible, update];
}
