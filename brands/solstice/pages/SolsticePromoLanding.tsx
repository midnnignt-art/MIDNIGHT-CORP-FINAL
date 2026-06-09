import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Props {
  refCode: string;
}

const C = { bg: '#000', red: '#E6392F' };

// Link de vendedor /sol/p/CODE — NO muestra una landing dedicada (esa pantalla
// intermedia frena ventas). Captura la atribución (ref_code, descuento, nombre
// del promotor) en sessionStorage y redirige DIRECTO a la vitrina /sol, que
// muestra el banner "Atendido por X" — mismo patrón que el link de Midnight.
export default function SolsticePromoLanding({ refCode }: Props) {
  useEffect(() => {
    document.body.style.backgroundColor = '#000';
    document.documentElement.style.backgroundColor = '#000';

    const code = refCode.toUpperCase();
    sessionStorage.setItem('ms_ref_code', code);

    // Registrar la vista del link (contador de vistas) una vez por sesión.
    if (!sessionStorage.getItem(`ms_viewed_${code}`)) {
      sessionStorage.setItem(`ms_viewed_${code}`, '1');
      supabase.rpc('solstice_register_view', { p_ref_code: code }).then(() => {}, () => {});
    }

    (async () => {
      try {
        // El visitante es ANÓNIMO y no puede leer solstice_sellers (RLS), así
        // que usamos un RPC SECURITY DEFINER que devuelve solo lo público.
        const { data } = await supabase.rpc('solstice_seller_public_info', { p_ref_code: code });
        const seller = Array.isArray(data) ? data[0] : data;
        if (seller) {
          // Descuento → el checkout lo aplica a quien compre por este link.
          const discount = Number(seller.discount_pct) || 0;
          if (discount > 0) sessionStorage.setItem('ms_seller_discount', String(discount));
          else sessionStorage.removeItem('ms_seller_discount');
          // Nombre del promotor → banner "Atendido por X" en la vitrina.
          sessionStorage.setItem('ms_ref_name', (seller.name || '').trim() || 'tu promotor');
        }
      } catch { /* igual redirigimos; la atribución se resuelve en checkout */ }

      window.location.replace('/sol');
    })();
  }, [refCode]);

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }} className="flex items-center justify-center">
      <Loader2 className="animate-spin" size={28} style={{ color: C.red }} />
    </div>
  );
}
