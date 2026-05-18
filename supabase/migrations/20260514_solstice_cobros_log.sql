-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: log de comunicaciones de cobranza
-- Evita duplicar mensajes cuando el cron corre varias veces al día.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_cobros_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id       uuid NOT NULL REFERENCES solstice_payment_schedules(id) ON DELETE CASCADE,
  registration_id   uuid REFERENCES solstice_registrations(id) ON DELETE CASCADE,
  channel           text NOT NULL CHECK (channel IN ('email','whatsapp','sms')),
  kind              text NOT NULL CHECK (kind IN ('reminder_pre','reminder_due','overdue_1','overdue_3','overdue_7','blocked')),
  status            text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  recipient         text,
  payload           jsonb,
  error_message     text,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, channel, kind)
);

CREATE INDEX IF NOT EXISTS solstice_cobros_log_schedule_idx  ON solstice_cobros_log (schedule_id);
CREATE INDEX IF NOT EXISTS solstice_cobros_log_reg_idx       ON solstice_cobros_log (registration_id);
CREATE INDEX IF NOT EXISTS solstice_cobros_log_sent_at_idx   ON solstice_cobros_log (sent_at DESC);

ALTER TABLE solstice_cobros_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobros_log_read"   ON solstice_cobros_log;
DROP POLICY IF EXISTS "cobros_log_write"  ON solstice_cobros_log;

CREATE POLICY "cobros_log_read"  ON solstice_cobros_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "cobros_log_write" ON solstice_cobros_log FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- ─── Función helper: marca como overdue las cuotas vencidas ───────────────
-- Llamada idempotente — no duplica trabajo. Se invoca desde el edge cron.

CREATE OR REPLACE FUNCTION fn_mark_solstice_overdue()
RETURNS integer AS $$
DECLARE
  rows_updated integer;
BEGIN
  WITH updated AS (
    UPDATE solstice_payment_schedules
    SET status = 'overdue'
    WHERE status = 'pending'
      AND due_date < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO rows_updated FROM updated;
  RETURN rows_updated;
END;
$$ LANGUAGE plpgsql;
