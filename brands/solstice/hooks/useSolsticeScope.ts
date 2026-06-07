import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useStore } from '../../../context/StoreContext';

// ─── Scope de visibilidad por rol en Solstice ────────────────────────────
// Devuelve los seller_ids que el rol actual tiene permitido ver:
//   - admin  → null  (sin filtro: ve TODO)
//   - head   → todos los sellers de TODOS los squads de su super_squad
//   - manager→ los user_id de su squad (sales_team_id) + el suyo
//   - seller → [su propio user_id]
//   - buyer  → [] (no ve nada de ventas)
//
// `undefined` mientras carga (para no mostrar datos globales por un instante).
// Lo usan Cobros y Top Clientes para filtrar registros sin reintroducir el
// bug de que un manager/promotor vea info general. Alcance del Excel
// "Contenidos de la web" (hoja SOLSTICE + TIPOS DE USUARIOS).
//
// FK chain: solstice_sellers.sales_team_id → sales_teams.super_squad_id →
//           super_squads.head_id (la Cabeza).
export type SolsticeScopeRole = 'admin' | 'head' | 'manager' | 'seller' | 'buyer';

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

    // head (Cabeza) → todos los squads de su super_squad
    if (role === 'head') {
      (async () => {
        try {
          // super_squads que lidera
          const { data: squads } = await supabase
            .from('super_squads')
            .select('id')
            .eq('head_id', currentUser.user_id);
          const squadIds = (squads || []).map(s => s.id);
          if (squadIds.length === 0) {
            if (!cancelled) setSellerIds([currentUser.user_id]);
            return;
          }
          // teams dentro de esos super_squads
          const { data: teams } = await supabase
            .from('sales_teams')
            .select('id')
            .in('super_squad_id', squadIds);
          const teamIds = (teams || []).map(t => t.id);
          // sellers de esos teams
          const { data: sellers } = teamIds.length
            ? await supabase.from('solstice_sellers').select('user_id').in('sales_team_id', teamIds)
            : { data: [] as { user_id: string }[] };
          const ids = (sellers || []).map(s => s.user_id);
          if (!ids.includes(currentUser.user_id)) ids.push(currentUser.user_id);
          if (!cancelled) setSellerIds(ids);
        } catch {
          if (!cancelled) setSellerIds([currentUser.user_id]);
        }
      })();
      return () => { cancelled = true; };
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
