-- ─── Wompi: campos de tracking en solstice_registrations ─────────────────
-- Cuando integramos Wompi como pasarela alternativa a Bold para one-shot
-- (full_combo + individual_days), necesitamos guardar el transaction_id de
-- Wompi que vuelve en el webhook + el provider usado para que el dashboard
-- de utilidades pueda separar fees por pasarela.

ALTER TABLE solstice_registrations
  ADD COLUMN IF NOT EXISTS wompi_transaction_id text,
  ADD COLUMN IF NOT EXISTS payment_provider text;

-- payment_provider: 'bold' | 'wompi' | NULL (cuando sea sub/no-online)
-- Default null para registraciones existentes; las nuevas lo setean al crear.

CREATE INDEX IF NOT EXISTS idx_sol_reg_wompi_tx
  ON solstice_registrations(wompi_transaction_id)
  WHERE wompi_transaction_id IS NOT NULL;
