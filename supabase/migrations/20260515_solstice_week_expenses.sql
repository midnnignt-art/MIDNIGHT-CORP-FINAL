-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: gastos por semana
-- Para proyecciones financieras y P&G por semana.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_week_expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid NOT NULL REFERENCES solstice_weeks(id) ON DELETE CASCADE,
  season_id     uuid REFERENCES solstice_seasons(id) ON DELETE CASCADE,
  category      text NOT NULL,
  description   text,
  amount_estimated  numeric NOT NULL DEFAULT 0,
  amount_actual     numeric,
  status        text NOT NULL DEFAULT 'estimated' CHECK (status IN ('estimated','committed','paid')),
  vendor        text,
  due_date      date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swe_week_idx   ON solstice_week_expenses (week_id);
CREATE INDEX IF NOT EXISTS swe_season_idx ON solstice_week_expenses (season_id);

ALTER TABLE solstice_week_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "swe_all" ON solstice_week_expenses;
CREATE POLICY "swe_all" ON solstice_week_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
