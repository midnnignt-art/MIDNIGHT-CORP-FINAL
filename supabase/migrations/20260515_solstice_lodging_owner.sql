-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: contacto del dueño/operador del hospedaje
-- Permite mandar email automático al recibir reserva del cliente.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE solstice_lodgings
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_name  text;

-- Ops fallback email — si la lodging no tiene owner_email, manda aquí.
-- Esta columna es solo para documentación; el edge function lee este valor
-- desde la env var OPS_FALLBACK_EMAIL.
COMMENT ON COLUMN solstice_lodgings.owner_email IS
  'Email del operador del hospedaje. Si null, las notificaciones van al fallback ops.';
