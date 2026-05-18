-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log — tabla genérica para registrar cambios críticos del sistema
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Se llena desde el frontend (manualmente en cada mutation crítica) o desde
-- edge functions. NO se llena automáticamente con triggers para mantener
-- control granular sobre qué se loguea.
--
-- Acciones típicas a registrar:
--   - 'event.delete' / 'event.archive' / 'event.publish'
--   - 'tier.create' / 'tier.update' / 'tier.delete'
--   - 'staff.create' / 'staff.delete' / 'staff.role_change'
--   - 'settlement.create' / 'settlement.delete'
--   - 'capital.update' (cambios contables)
--   - 'campaign.delete'

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

-- Lectura: solo authenticated (el frontend filtra por role admin antes)
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select"
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserción: cualquier authenticated puede registrar su propia acción
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert"
  ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
