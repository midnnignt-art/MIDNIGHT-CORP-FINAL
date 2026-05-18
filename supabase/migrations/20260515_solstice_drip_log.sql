-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: log de drips de experiencia (D-7, D-1, D+0, D+1)
-- Separado de solstice_cobros_log (que es por cuota) — éste es por registration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_drip_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   uuid NOT NULL REFERENCES solstice_registrations(id) ON DELETE CASCADE,
  channel           text NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  kind              text NOT NULL CHECK (kind IN (
    'week_d_minus_7',
    'week_d_minus_1',
    'week_d_zero',
    'week_d_plus_1'
  )),
  status            text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  recipient         text,
  payload           jsonb,
  error_message     text,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_id, channel, kind)
);

CREATE INDEX IF NOT EXISTS solstice_drip_log_reg_idx     ON solstice_drip_log (registration_id);
CREATE INDEX IF NOT EXISTS solstice_drip_log_sent_at_idx ON solstice_drip_log (sent_at DESC);

ALTER TABLE solstice_drip_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drip_log_read"   ON solstice_drip_log;
DROP POLICY IF EXISTS "drip_log_write"  ON solstice_drip_log;

CREATE POLICY "drip_log_read"  ON solstice_drip_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "drip_log_write" ON solstice_drip_log FOR ALL    TO authenticated USING (true) WITH CHECK (true);
