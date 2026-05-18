-- ─────────────────────────────────────────────────────────────────────────────
-- company_balance — datos contables de balance que vivían en localStorage
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hoy estos valores están en localStorage del browser del operador.
--   - Si limpia cookies → se pierde
--   - Si entra desde otro dispositivo → no los ve
--   - No hay audit trail de quién/cuándo los cambió
--
-- Esta tabla los persiste server-side. Solo hay UNA fila (singleton) con id=1.

CREATE TABLE IF NOT EXISTS company_balance (
  id             smallint PRIMARY KEY DEFAULT 1,
  capital_social numeric  NOT NULL DEFAULT 0,
  share_premium  numeric  NOT NULL DEFAULT 0,
  fixed_assets   numeric  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- Insertar fila singleton si no existe
INSERT INTO company_balance (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS: lectura para todos los authenticated; update solo admin (verificado en frontend por ahora)
ALTER TABLE company_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_balance_select" ON company_balance;
CREATE POLICY "company_balance_select"
  ON company_balance
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "company_balance_update" ON company_balance;
CREATE POLICY "company_balance_update"
  ON company_balance
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
