-- Info pública del vendedor para el link /sol/p/CODE: el visitante es anónimo
-- y no puede leer solstice_sellers (RLS). Este RPC SECURITY DEFINER devuelve
-- solo lo necesario para el banner + descuento.
CREATE OR REPLACE FUNCTION solstice_seller_public_info(p_ref_code text)
RETURNS TABLE(user_id uuid, discount_pct numeric, name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.user_id, s.discount_pct, p.full_name
  FROM solstice_sellers s
  LEFT JOIN profiles p ON p.id = s.user_id
  WHERE s.ref_code ILIKE p_ref_code
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION solstice_seller_public_info(text) TO anon, authenticated;
