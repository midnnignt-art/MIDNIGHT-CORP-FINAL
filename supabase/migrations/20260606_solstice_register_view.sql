-- ─── Contador de vistas del link de vendedor ─────────────────────────────
-- El landing /sol/p/CODE lo visita gente NO autenticada (clientes anónimos),
-- así que registramos la vista vía un RPC SECURITY DEFINER que bypasea RLS
-- (la tabla solstice_referral_clicks solo permite insert a authenticated).
-- El dashboard del vendedor cuenta estos rows para mostrar "X vistas".

CREATE OR REPLACE FUNCTION solstice_register_view(p_ref_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_ref_code IS NULL OR length(trim(p_ref_code)) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO solstice_referral_clicks(ref_code, converted)
  VALUES (upper(trim(p_ref_code)), false);
END;
$$;

GRANT EXECUTE ON FUNCTION solstice_register_view(text) TO anon, authenticated;

-- Index para contar vistas por ref_code rápido
CREATE INDEX IF NOT EXISTS idx_sol_clicks_ref_code
  ON solstice_referral_clicks (ref_code);
