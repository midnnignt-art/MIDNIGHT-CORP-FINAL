-- Registro de pagos de comisión a vendedores Solstice
CREATE TABLE IF NOT EXISTS solstice_commission_payouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id       uuid REFERENCES solstice_seasons(id),
  seller_user_id  uuid REFERENCES auth.users(id),
  amount          integer NOT NULL,
  method          text DEFAULT 'transfer' CHECK (method IN ('transfer','cash','mixed')),
  notes           text,
  paid_by         uuid REFERENCES auth.users(id),
  paid_at         timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);
