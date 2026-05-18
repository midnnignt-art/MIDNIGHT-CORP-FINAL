-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: Lanchas + Hospedaje + Penalidades
-- Cierra gaps del Excel de contenidos (Vitrina 1b/1c + Config 5/7).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── solstice_boats ─────────────────────────────────────────────────────────
-- Inventario de lanchas/catamaranes que el cliente puede elegir cuando su
-- combo incluye Día 3 (Catamarán).

CREATE TABLE IF NOT EXISTS solstice_boats (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id         uuid REFERENCES solstice_seasons(id) ON DELETE CASCADE,
  name              text NOT NULL,
  image_url         text,
  capacity          integer NOT NULL CHECK (capacity > 0),
  price_per_person  numeric NOT NULL DEFAULT 0,
  description       text,
  amenities         jsonb DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','sold_out','hidden','archived')),
  sort_order        integer DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solstice_boats_season_idx ON solstice_boats (season_id);

-- ─── solstice_boat_reservations ─────────────────────────────────────────────
-- Un líder reserva una lancha. Genera invite_code que comparte con invitados.

CREATE TABLE IF NOT EXISTS solstice_boat_reservations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id                  uuid NOT NULL REFERENCES solstice_boats(id) ON DELETE RESTRICT,
  leader_registration_id   uuid REFERENCES solstice_registrations(id) ON DELETE CASCADE,
  leader_name              text,
  leader_email             text,
  invite_code              text UNIQUE NOT NULL,
  total_capacity           integer NOT NULL,
  slots_claimed            integer NOT NULL DEFAULT 1, -- el líder ya ocupa 1
  status                   text NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','full','closed','cancelled')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  closed_at                timestamptz
);

CREATE INDEX IF NOT EXISTS sbr_boat_idx ON solstice_boat_reservations (boat_id);
CREATE INDEX IF NOT EXISTS sbr_invite_idx ON solstice_boat_reservations (invite_code);

-- ─── solstice_boat_passengers ──────────────────────────────────────────────
-- Cada persona (líder + invitados) que va en una lancha específica.

CREATE TABLE IF NOT EXISTS solstice_boat_passengers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_reservation_id     uuid NOT NULL REFERENCES solstice_boat_reservations(id) ON DELETE CASCADE,
  registration_id         uuid REFERENCES solstice_registrations(id) ON DELETE CASCADE,
  passenger_name          text NOT NULL,
  passenger_email         text,
  passenger_phone         text,
  is_leader               boolean NOT NULL DEFAULT false,
  amount_paid             numeric NOT NULL DEFAULT 0,
  joined_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (boat_reservation_id, registration_id)
);

CREATE INDEX IF NOT EXISTS sbp_reservation_idx ON solstice_boat_passengers (boat_reservation_id);

-- ─── solstice_lodgings ────────────────────────────────────────────────────
-- Inventario de hospedajes (hoteles, hostels, casas) que se ofrecen como
-- upsell post-compra del combo.

CREATE TABLE IF NOT EXISTS solstice_lodgings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id         uuid REFERENCES solstice_seasons(id) ON DELETE CASCADE,
  name              text NOT NULL,
  image_url         text,
  gallery           jsonb DEFAULT '[]'::jsonb,
  description       text,
  price_per_night   numeric NOT NULL DEFAULT 0,
  price_per_person  numeric NOT NULL DEFAULT 0,
  total_units       integer NOT NULL DEFAULT 0,
  units_available   integer NOT NULL DEFAULT 0,
  amenities         jsonb DEFAULT '[]'::jsonb,
  address           text,
  google_maps_url   text,
  category          text DEFAULT 'standard'
                    CHECK (category IN ('budget','standard','premium','vip')),
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','sold_out','hidden','archived')),
  sort_order        integer DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solstice_lodgings_season_idx ON solstice_lodgings (season_id);

-- ─── solstice_lodging_reservations ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_lodging_reservations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodging_id          uuid NOT NULL REFERENCES solstice_lodgings(id) ON DELETE RESTRICT,
  registration_id     uuid REFERENCES solstice_registrations(id) ON DELETE CASCADE,
  customer_name       text,
  customer_email      text,
  nights              integer NOT NULL CHECK (nights > 0),
  guests              integer NOT NULL DEFAULT 1 CHECK (guests > 0),
  total_amount        numeric NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','paid','cancelled')),
  payment_method      text,
  bold_order_id       text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slr_lodging_idx ON solstice_lodging_reservations (lodging_id);
CREATE INDEX IF NOT EXISTS slr_registration_idx ON solstice_lodging_reservations (registration_id);

-- ─── solstice_penalties (singleton config) ────────────────────────────────

CREATE TABLE IF NOT EXISTS solstice_penalties (
  id                            smallint PRIMARY KEY DEFAULT 1,
  late_payment_pct              numeric NOT NULL DEFAULT 5,
  grace_period_days             integer NOT NULL DEFAULT 7,
  lock_combo_after_overdue      integer NOT NULL DEFAULT 2,
  no_show_penalty_pct           numeric NOT NULL DEFAULT 100,
  cancellation_refund_pct       numeric NOT NULL DEFAULT 100,
  cancellation_deadline_days    integer NOT NULL DEFAULT 14,
  whatsapp_reminder_days_before integer NOT NULL DEFAULT 3,
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  updated_by                    uuid,
  CONSTRAINT only_one_penalties_row CHECK (id = 1)
);

INSERT INTO solstice_penalties (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────
-- Lectura pública del catálogo (boats + lodgings) para mostrar en checkout.
-- Mutaciones por authenticated (frontend valida role admin antes).

ALTER TABLE solstice_boats               ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_boat_reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_boat_passengers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_lodgings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_lodging_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE solstice_penalties           ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boats_public_read"        ON solstice_boats;
DROP POLICY IF EXISTS "boats_mutate"             ON solstice_boats;
DROP POLICY IF EXISTS "bres_all"                 ON solstice_boat_reservations;
DROP POLICY IF EXISTS "bpass_all"                ON solstice_boat_passengers;
DROP POLICY IF EXISTS "lodge_public_read"        ON solstice_lodgings;
DROP POLICY IF EXISTS "lodge_mutate"             ON solstice_lodgings;
DROP POLICY IF EXISTS "lres_all"                 ON solstice_lodging_reservations;
DROP POLICY IF EXISTS "penalties_public_read"    ON solstice_penalties;
DROP POLICY IF EXISTS "penalties_mutate"         ON solstice_penalties;

CREATE POLICY "boats_public_read"   ON solstice_boats   FOR SELECT TO anon, authenticated USING (status IN ('active','sold_out'));
CREATE POLICY "boats_mutate"        ON solstice_boats   FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bres_all"            ON solstice_boat_reservations   FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bpass_all"           ON solstice_boat_passengers     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lodge_public_read"   ON solstice_lodgings FOR SELECT TO anon, authenticated USING (status IN ('active','sold_out'));
CREATE POLICY "lodge_mutate"        ON solstice_lodgings FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lres_all"            ON solstice_lodging_reservations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "penalties_public_read" ON solstice_penalties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "penalties_mutate"    ON solstice_penalties FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- ─── Trigger: auto-set slots_claimed cuando se agrega/quita passenger ──────

CREATE OR REPLACE FUNCTION fn_recalc_boat_slots()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solstice_boat_reservations
  SET
    slots_claimed = (SELECT COUNT(*) FROM solstice_boat_passengers WHERE boat_reservation_id = COALESCE(NEW.boat_reservation_id, OLD.boat_reservation_id)),
    status = CASE
      WHEN (SELECT COUNT(*) FROM solstice_boat_passengers WHERE boat_reservation_id = COALESCE(NEW.boat_reservation_id, OLD.boat_reservation_id)) >= total_capacity
        THEN 'full'
      ELSE 'open'
    END,
    closed_at = CASE
      WHEN (SELECT COUNT(*) FROM solstice_boat_passengers WHERE boat_reservation_id = COALESCE(NEW.boat_reservation_id, OLD.boat_reservation_id)) >= total_capacity
        THEN now()
      ELSE NULL
    END
  WHERE id = COALESCE(NEW.boat_reservation_id, OLD.boat_reservation_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_boat_slots ON solstice_boat_passengers;
CREATE TRIGGER trg_recalc_boat_slots
  AFTER INSERT OR DELETE ON solstice_boat_passengers
  FOR EACH ROW EXECUTE FUNCTION fn_recalc_boat_slots();
