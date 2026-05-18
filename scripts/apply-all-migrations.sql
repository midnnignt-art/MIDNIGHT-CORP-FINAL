-- ============================================================================
-- MIDNIGHT CORP — BUNDLE DE MIGRATIONS PENDIENTES (mayo 2026)
-- ============================================================================
--
-- Para aplicar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Pegar TODO este archivo
--   3. Run
--
-- Idempotente: se puede correr múltiples veces sin romper nada (usa IF NOT EXISTS).
-- ============================================================================

-- ─── 1. SOLSTICE RLS — lectura pública catálogo (20260512) ──────────────────

DROP POLICY IF EXISTS "sol_seasons_public_read"      ON solstice_seasons;
DROP POLICY IF EXISTS "sol_weeks_public_read"        ON solstice_weeks;
DROP POLICY IF EXISTS "sol_program_days_public_read" ON solstice_program_days;

CREATE POLICY "sol_seasons_public_read"      ON solstice_seasons      FOR SELECT TO anon USING (true);
CREATE POLICY "sol_weeks_public_read"        ON solstice_weeks        FOR SELECT TO anon USING (true);
CREATE POLICY "sol_program_days_public_read" ON solstice_program_days FOR SELECT TO anon USING (true);

-- ─── 2. AUDIT LOG — tabla y RLS (20260513) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid,
  actor_name  text,
  actor_role  text,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  entity_label text,
  details     jsonb,
  ip_address  text
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx     ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx      ON audit_log (actor_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ─── 3. EVENTS — campos editables (dress_code, min_age, faq) (20260514) ─────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS dress_code text     DEFAULT 'Strict Nightlife',
  ADD COLUMN IF NOT EXISTS min_age    smallint DEFAULT 18,
  ADD COLUMN IF NOT EXISTS faq        jsonb    DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.dress_code IS 'Dress code visible en página del evento';
COMMENT ON COLUMN events.min_age    IS 'Edad mínima para entrar (default 18)';
COMMENT ON COLUMN events.faq        IS 'Array de {q,a} para FAQ del evento. Si vacío, se muestra el FAQ genérico.';

-- ─── 4. COMPANY BALANCE — mueve capital social de localStorage a BD ─────────

CREATE TABLE IF NOT EXISTS company_balance (
  id             smallint PRIMARY KEY DEFAULT 1,
  capital_social numeric  NOT NULL DEFAULT 0,
  share_premium  numeric  NOT NULL DEFAULT 0,
  fixed_assets   numeric  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  CONSTRAINT only_one_row CHECK (id = 1)
);

INSERT INTO company_balance (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_balance_select" ON company_balance;
CREATE POLICY "company_balance_select" ON company_balance FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "company_balance_update" ON company_balance;
CREATE POLICY "company_balance_update" ON company_balance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FIN
-- Para verificar:
--   SELECT * FROM events LIMIT 1;             -- debería mostrar dress_code, min_age, faq
--   SELECT * FROM company_balance;            -- 1 fila
--   SELECT * FROM audit_log LIMIT 1;          -- vacío
-- ============================================================================
