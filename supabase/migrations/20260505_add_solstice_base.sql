-- SOLSTICE base tables — no modifica ninguna tabla existente de Midnight
-- Reversible: ver 20260505_drop_solstice_base.sql

CREATE TABLE IF NOT EXISTS solstice_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  tagline text,
  entry_price integer NOT NULL DEFAULT 40000,
  combo_total integer NOT NULL DEFAULT 400000,
  installments integer NOT NULL DEFAULT 5,
  phase1_price integer,
  phase1_limit integer,
  phase2_price integer,
  early_bird_price integer,
  early_bird_deadline timestamptz,
  penalty_catamaran_at integer DEFAULT 1,
  warning_days_before integer DEFAULT 15,
  commission_pct numeric DEFAULT 10,
  manager_commission_pct numeric DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solstice_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES solstice_seasons(id),
  university text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  capacity integer NOT NULL DEFAULT 120,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solstice_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  season_id uuid REFERENCES solstice_seasons(id),
  university text NOT NULL,
  role text DEFAULT 'seller' CHECK (role IN ('seller','manager')),
  ref_code text UNIQUE NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solstice_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code text NOT NULL,
  visited_at timestamptz DEFAULT now(),
  converted boolean DEFAULT false,
  registration_id uuid
);

CREATE TABLE IF NOT EXISTS solstice_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  season_id uuid REFERENCES solstice_seasons(id),
  week_id uuid REFERENCES solstice_weeks(id),
  user_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  ref_code text,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  customer_university text,
  payment_mode text NOT NULL CHECK (payment_mode IN (
    'auto_subscription','manual_monthly','cash_to_seller','individual_days','full_combo'
  )),
  status text DEFAULT 'reserved' CHECK (status IN (
    'reserved','active','completed','cancelled','suspended'
  )),
  total_amount integer NOT NULL,
  amount_paid integer DEFAULT 0,
  installments_remaining integer,
  days_purchased jsonb,
  bold_order_id text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solstice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES solstice_registrations(id),
  amount integer NOT NULL,
  method text NOT NULL CHECK (method IN ('bold_card','bold_subscription','cash')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  confirmed_by uuid REFERENCES auth.users(id),
  bold_transaction_id text,
  notes text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solstice_payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES solstice_registrations(id),
  installment_number integer NOT NULL,
  amount integer NOT NULL,
  due_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue')),
  payment_id uuid REFERENCES solstice_payments(id),
  reminder_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Seed inicial con la temporada 2026
INSERT INTO solstice_seasons (name, status, tagline, entry_price, combo_total, installments)
VALUES ('SOLSTICE 2026', 'open', 'SELECTED BEATS. PRIVATE SUNSET.', 40000, 400000, 5)
ON CONFLICT DO NOTHING;

-- Semanas (requiere el season_id insertado arriba)
INSERT INTO solstice_weeks (season_id, university, start_date, end_date, capacity)
SELECT id, 'Javeriana',  '2026-09-14', '2026-09-20', 120 FROM solstice_seasons WHERE name = 'SOLSTICE 2026'
ON CONFLICT DO NOTHING;
INSERT INTO solstice_weeks (season_id, university, start_date, end_date, capacity)
SELECT id, 'Los Andes',  '2026-09-28', '2026-10-03', 120 FROM solstice_seasons WHERE name = 'SOLSTICE 2026'
ON CONFLICT DO NOTHING;
INSERT INTO solstice_weeks (season_id, university, start_date, end_date, capacity)
SELECT id, 'CESA',        '2026-10-05', '2026-10-11', 80  FROM solstice_seasons WHERE name = 'SOLSTICE 2026'
ON CONFLICT DO NOTHING;
