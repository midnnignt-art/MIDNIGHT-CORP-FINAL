-- Precio diferenciado por modalidad de pago en días individuales
ALTER TABLE solstice_program_days
  ADD COLUMN IF NOT EXISTS price_cash    integer,
  ADD COLUMN IF NOT EXISTS price_combo   integer,
  ADD COLUMN IF NOT EXISTS price_monthly integer;
