-- ── RLS policies: allow authenticated users to manage all solstice tables ──────
-- (acceso UI ya restringido a admins en el frontend)

ALTER TABLE solstice_seasons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_weeks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_sellers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_registrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_referral_clicks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_program_days     ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_checkins         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sol_seasons_all"           ON solstice_seasons;
DROP POLICY IF EXISTS "sol_weeks_all"             ON solstice_weeks;
DROP POLICY IF EXISTS "sol_sellers_all"           ON solstice_sellers;
DROP POLICY IF EXISTS "sol_registrations_all"     ON solstice_registrations;
DROP POLICY IF EXISTS "sol_payments_all"          ON solstice_payments;
DROP POLICY IF EXISTS "sol_schedules_all"         ON solstice_payment_schedules;
DROP POLICY IF EXISTS "sol_clicks_all"            ON solstice_referral_clicks;
DROP POLICY IF EXISTS "sol_program_days_all"      ON solstice_program_days;
DROP POLICY IF EXISTS "sol_commission_payouts_all" ON solstice_commission_payouts;
DROP POLICY IF EXISTS "sol_checkins_all"          ON solstice_checkins;

CREATE POLICY "sol_seasons_all"           ON solstice_seasons           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_weeks_all"             ON solstice_weeks             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_sellers_all"           ON solstice_sellers           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_registrations_all"     ON solstice_registrations     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_payments_all"          ON solstice_payments          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_schedules_all"         ON solstice_payment_schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_clicks_all"            ON solstice_referral_clicks   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_program_days_all"      ON solstice_program_days      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_commission_payouts_all" ON solstice_commission_payouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sol_checkins_all"          ON solstice_checkins          FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── New pricing fields ─────────────────────────────────────────────────────────
ALTER TABLE solstice_seasons
  ADD COLUMN IF NOT EXISTS combo1_total         integer DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS combo1_installments  integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS phase_increment      integer DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS phase_increment_type text    DEFAULT 'fixed'
    CHECK (phase_increment_type IN ('fixed','percent'));
