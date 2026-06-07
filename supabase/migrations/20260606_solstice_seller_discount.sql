-- ─── Descuento por vendedor ──────────────────────────────────────────────
-- Cada vendedor puede tener un % de descuento fijo que aplica automáticamente
-- a quien compre por su link /sol/p/CODE. Lo configura el admin.
-- Default 0 = sin descuento.

ALTER TABLE solstice_sellers
  ADD COLUMN IF NOT EXISTS discount_pct numeric NOT NULL DEFAULT 0;

-- Guardas: el descuento debe estar entre 0 y 100.
ALTER TABLE solstice_sellers
  DROP CONSTRAINT IF EXISTS solstice_sellers_discount_pct_range;
ALTER TABLE solstice_sellers
  ADD CONSTRAINT solstice_sellers_discount_pct_range
  CHECK (discount_pct >= 0 AND discount_pct <= 100);
