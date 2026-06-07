import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';

// ─── Scope de visibilidad por rol en Solstice ────────────────────────────
// Devuelve los seller_ids que el rol actual tiene permitido ver:
//   - admin  → null  (sin filtro: ve TODO)
//   - manager→ los user_id de su squad (sales_team_id) + el suyo
//   - seller → [su propio user_id]
//   - buyer  → [] (no ve nada de ventas)
//
// `undefined` mientras carga (para no mostrar datos globales por un instante).
// Lo usan Cobros y Top Clientes para filtrar registros sin reintroducir el
// bug de que un manager/promotor vea info general. Alcance del Excel
// "Contenidos de la web" (hoja SOLSTICE).
export type SolsticeScopeRole = 'admin' | 'manager' | 'seller' | 'buyer';

export function useSolsticeScope(role: SolsticeScopeRole): string[] | null | undefined {
  const { currentUser } = useStore();
  const [sellerIds, setSellerIds] = useState<string[] | null | undefined>(
    role === 'admin' ? null : undefined
  );

  useEffect(() => {
    let cancelled = false;

    if (role === 'admin') { setSellerIds(null); return; }
    if (!currentUser) { setSellerIds([]); return; }

    if (role === 'seller' || role === 'buyer') {
      setSellerIds([currentUser.user_id]);
      return;
    }

    // manager → resolver su squad y los miembros
    (async () => {
      try {
        const { data: me } = await supabase
          .from('solstice_sellers')
          .select('sales_team_id')
          .eq('user_id', currentUser.user_id)
          .maybeSingle();

        if (!me?.sales_team_id) {
          // Sin squad asignado → solo lo propio
          if (!cancelled) setSellerIds([currentUser.user_id]);
          return;
        }

        const { data: team } = await supabase
          .from('solstice_sellers')
          .select('user_id')
          .eq('sales_team_id', me.sales_team_id);

        const ids = (team || []).map(t => t.user_id);
        if (!ids.includes(currentUser.user_id)) ids.push(currentUser.user_id);
        if (!cancelled) setSellerIds(ids);
      } catch {
        if (!cancelled) setSellerIds([currentUser.user_id]);
      }
    })();

    return () => { cancelled = true; };
  }, [role, currentUser]);

  return sellerIds;
}
