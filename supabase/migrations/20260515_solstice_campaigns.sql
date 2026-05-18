-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: campañas (guest list, descuentos, ruleta)
-- Equivalente a las campaigns de Midnight pero específico para Solstice.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid REFERENCES solstice_seasons(id) ON DELETE CASCADE,
  week_id       uuid REFERENCES solstice_weeks(id) ON DELETE SET NULL,
  type          text NOT NULL CHECK (type IN ('guest_list','discount_code','wheel')),
  label         text NOT NULL,
  code          text,
  discount_pct  numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  benefits      jsonb DEFAULT '[]'::jsonb,
  max_uses      integer,
  used_count    integer NOT NULL DEFAULT 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','expired','archived')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sc_season_idx  ON solstice_campaigns (season_id);
CREATE INDEX IF NOT EXISTS sc_week_idx    ON solstice_campaigns (week_id);
CREATE INDEX IF NOT EXISTS sc_code_idx    ON solstice_campaigns (code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS solstice_campaign_participants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES solstice_campaigns(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES solstice_registrations(id) ON DELETE SET NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  benefit_label text,
  redeemed_at   timestamptz,
  joined_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scp_campaign_idx ON solstice_campaign_participants (campaign_id);
CREATE INDEX IF NOT EXISTS scp_reg_idx      ON solstice_campaign_participants (registration_id);

ALTER TABLE solstice_campaigns               ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_campaign_participants   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_public_read" ON solstice_campaigns;
DROP POLICY IF EXISTS "sc_mutate"      ON solstice_campaigns;
DROP POLICY IF EXISTS "scp_all"        ON solstice_campaign_participants;

CREATE POLICY "sc_public_read" ON solstice_campaigns FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "sc_mutate"      ON solstice_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "scp_all"        ON solstice_campaign_participants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
