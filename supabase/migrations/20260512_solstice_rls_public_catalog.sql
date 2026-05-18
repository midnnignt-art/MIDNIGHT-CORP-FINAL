-- ─────────────────────────────────────────────────────────────────────────────
-- Solstice RLS — Sprint 1 (lectura pública explícita)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠️ DEUDA DE SEGURIDAD CONOCIDA — PLAN SPRINT 3
--
-- Las policies actuales (ver 20260506_solstice_rls_and_pricing.sql) son
-- `FOR ALL TO authenticated USING (true) WITH CHECK (true)`, lo que permite
-- a CUALQUIER usuario autenticado por Supabase Auth (incluido cualquier
-- cliente que se registró por OTP) leer/escribir todas las tablas Solstice.
--
-- No se endurece en este Sprint 1 porque:
--   1. El staff de Midnight puede entrar por dos vías:
--        a) `login(code, password)` → NO crea sesión Supabase Auth (rol = anon)
--        b) `verifyOtpUnified(email, otp)` → SÍ crea sesión Auth
--      → No hay forma confiable desde Postgres de saber "este usuario es admin"
--   2. Endurecer la RLS hoy rompería las páginas admin cuando el staff entra
--      por código, y rompería el flujo de reserva público.
--
-- PLAN para Sprint 3 (refactor de auth):
--   - Migrar el login de staff a Supabase Auth (OTP únicamente).
--   - Mover `role` a custom JWT claims vía Auth Hook o tabla `user_roles`
--     leída desde la policy.
--   - Reemplazar `USING (true)` por checks de role en cada tabla:
--       * Lectura pública (anon + authenticated): seasons, weeks, program_days
--       * Inserción pública: registrations, payment_schedules, referral_clicks
--       * Solo admin: sellers, commission_payouts, checkins, payments
--
-- Lo único que hacemos AHORA, sin romper nada, es exponer la lectura pública
-- de las tablas de catálogo a `anon`. Antes la landing dependía de la session
-- de OTP de algún usuario para leer (lo que es funcional pero frágil).
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sol_seasons_public_read"      ON solstice_seasons;
DROP POLICY IF EXISTS "sol_weeks_public_read"        ON solstice_weeks;
DROP POLICY IF EXISTS "sol_program_days_public_read" ON solstice_program_days;

CREATE POLICY "sol_seasons_public_read"
  ON solstice_seasons
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "sol_weeks_public_read"
  ON solstice_weeks
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "sol_program_days_public_read"
  ON solstice_program_days
  FOR SELECT
  TO anon
  USING (true);
