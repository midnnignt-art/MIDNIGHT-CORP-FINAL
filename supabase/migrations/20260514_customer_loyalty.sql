-- ─────────────────────────────────────────────────────────────────────────────
-- Customer Loyalty: preferences + referrals + Pase MIDNIGHT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Mueve al cliente final de "comprador one-time" a "miembro con perfil".
--
-- Componentes:
--   1. customer_preferences  — opt-ins de WhatsApp/email/cumpleaños
--   2. customer_referrals    — código personal de cada cliente + tracking
--   3. fn_pase_level(email)  — calcula tier, eventos asistidos, total invertido

-- ─── customer_preferences ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_preferences (
  email           text PRIMARY KEY,
  whatsapp_optin  boolean NOT NULL DEFAULT true,
  email_optin     boolean NOT NULL DEFAULT true,
  birthday        date,
  phone           text,
  full_name       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cp_select" ON customer_preferences;
CREATE POLICY "cp_select" ON customer_preferences
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cp_upsert" ON customer_preferences;
CREATE POLICY "cp_upsert" ON customer_preferences
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cp_update" ON customer_preferences;
CREATE POLICY "cp_update" ON customer_preferences
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── customer_referrals ────────────────────────────────────────────────────
-- Cada cliente con compras tiene un código personal: cuando alguien compra
-- con ese código (?ref=XXX) ambos suben en el Pase y el referente acumula
-- crédito convertible.

CREATE TABLE IF NOT EXISTS customer_referrals (
  email          text PRIMARY KEY,
  code           text UNIQUE NOT NULL,
  invites_count  integer NOT NULL DEFAULT 0,
  credit_amount  numeric NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_referrals_code_idx ON customer_referrals (code);

ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cr_select" ON customer_referrals;
CREATE POLICY "cr_select" ON customer_referrals
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cr_insert" ON customer_referrals;
CREATE POLICY "cr_insert" ON customer_referrals
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cr_update" ON customer_referrals;
CREATE POLICY "cr_update" ON customer_referrals
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── fn_pase_level(email) → calcula tier en tiempo real ─────────────────────
--
-- Tiers (alineados con la lógica de producto):
--   BRONZE   → 1 compra
--   SILVER   → 3+ eventos completados
--   GOLD     → 5+ eventos OR gasto total > 500K COP
--   PLATINUM → 10+ eventos OR gasto total > 2M COP

CREATE OR REPLACE FUNCTION fn_pase_level(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_events_count integer;
  v_total_spent  numeric;
  v_tier         text;
  v_next_tier    text;
  v_next_at      jsonb;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object('tier','NONE','events_count',0,'total_spent',0);
  END IF;

  SELECT COUNT(DISTINCT event_id), COALESCE(SUM(total), 0)
    INTO v_events_count, v_total_spent
  FROM orders
  WHERE LOWER(TRIM(customer_email)) = LOWER(TRIM(p_email))
    AND status = 'completed';

  IF v_events_count = 0 THEN
    v_tier := 'NONE';
    v_next_tier := 'BRONZE';
    v_next_at := jsonb_build_object('events', 1);
  ELSIF v_events_count >= 10 OR v_total_spent > 2000000 THEN
    v_tier := 'PLATINUM';
    v_next_tier := NULL;
    v_next_at := NULL;
  ELSIF v_events_count >= 5 OR v_total_spent > 500000 THEN
    v_tier := 'GOLD';
    v_next_tier := 'PLATINUM';
    v_next_at := jsonb_build_object('events', 10, 'spent', 2000000, 'events_left', GREATEST(0, 10 - v_events_count));
  ELSIF v_events_count >= 3 THEN
    v_tier := 'SILVER';
    v_next_tier := 'GOLD';
    v_next_at := jsonb_build_object('events', 5, 'spent', 500000, 'events_left', GREATEST(0, 5 - v_events_count));
  ELSE
    v_tier := 'BRONZE';
    v_next_tier := 'SILVER';
    v_next_at := jsonb_build_object('events', 3, 'events_left', GREATEST(0, 3 - v_events_count));
  END IF;

  RETURN jsonb_build_object(
    'tier',         v_tier,
    'events_count', v_events_count,
    'total_spent',  v_total_spent,
    'next_tier',    v_next_tier,
    'next_tier_at', v_next_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_pase_level(text) TO anon, authenticated;
