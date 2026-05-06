-- Registro de asistencia por día para compradores Solstice
CREATE TABLE IF NOT EXISTS solstice_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES solstice_registrations(id),
  day_number      integer NOT NULL DEFAULT 1,
  checked_in_at   timestamptz DEFAULT now(),
  checked_in_by   uuid REFERENCES auth.users(id),
  notes           text,
  UNIQUE (registration_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_solstice_checkins_reg ON solstice_checkins(registration_id);
CREATE INDEX IF NOT EXISTS idx_solstice_checkins_day ON solstice_checkins(day_number);
