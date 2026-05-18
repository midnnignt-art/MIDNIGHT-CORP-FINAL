-- Solstice bouncer scanner — links de acceso públicos para staff de control
-- en puerta / lancha / beach club.
--
-- El sistema espeja al de Midnight (`bouncer_links`) pero agrega:
--   1. `day_number`: el link es válido SOLO para ese día. Si la lancha del
--      miércoles intenta escanear un QR de un cliente que solo pagó el lunes,
--      el scanner rechaza.
--   2. `location` opcional: para identificar puerta 1, puerta 2, beach club,
--      lancha "Estrella", etc.
--   3. `boat_id` opcional: si está seteado, solo deja pasar pasajeros de esa
--      lancha específica. Útil para el Día 3 cuando hay varias lanchas en
--      paralelo y cada bouncer controla su grupo.

CREATE TABLE IF NOT EXISTS solstice_bouncer_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  day_number  integer NOT NULL CHECK (day_number BETWEEN 1 AND 5),
  boat_id     uuid REFERENCES solstice_boats(id) ON DELETE SET NULL,
  location    text,                    -- 'Puerta 1' | 'Beach Club' | etc
  label       text NOT NULL,           -- display para el bouncer + admin
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sol_bouncer_links_token ON solstice_bouncer_links(token);
CREATE INDEX IF NOT EXISTS idx_sol_bouncer_links_day   ON solstice_bouncer_links(day_number);

ALTER TABLE solstice_bouncer_links ENABLE ROW LEVEL SECURITY;

-- Lectura pública: cualquiera con el token puede consultar el link.
-- (El token actúa como secret — entropía suficiente para que no se pueda
-- adivinar; quien lo tenga es legítimo).
DROP POLICY IF EXISTS "sol_bouncer_links_read_public" ON solstice_bouncer_links;
CREATE POLICY "sol_bouncer_links_read_public"
  ON solstice_bouncer_links
  FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- Solo authenticated puede crear/editar/borrar links.
DROP POLICY IF EXISTS "sol_bouncer_links_write_auth" ON solstice_bouncer_links;
CREATE POLICY "sol_bouncer_links_write_auth"
  ON solstice_bouncer_links
  FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC público: el scanner llama esto para checkear un QR sin estar logueado.
--
-- Valida en orden: (1) link existe + activo, (2) registration existe + pagada,
-- (3) el cliente realmente compró ese día (combo total, combo1, o días sueltos
-- con días_purchased que incluyan el día del link), (4) si el link tiene
-- boat_id, validar que el pasajero esté asignado a esa lancha, (5) que no esté
-- ya checkeado en ese día.
--
-- Devuelve jsonb { status, message, customer_name?, university? }
-- status ∈ 'success' | 'used' | 'invalid'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION solstice_bouncer_validate_qr(
  p_token        text,
  p_order_number text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        record;
  v_reg         record;
  v_already     boolean;
  v_boat_match  boolean;
  v_has_day     boolean;
  v_days_jsonb  jsonb;
BEGIN
  -- 1. Validar link
  SELECT * INTO v_link
  FROM solstice_bouncer_links
  WHERE token = p_token AND active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'message', 'Link inválido o desactivado');
  END IF;

  -- 2. Buscar registration por order_number
  SELECT * INTO v_reg
  FROM solstice_registrations
  WHERE order_number = p_order_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'message', '⚠️ QR no encontrado');
  END IF;

  -- 3. Validar que el pago esté en estado válido
  IF v_reg.status NOT IN ('active','completed') THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', CASE v_reg.status
        WHEN 'reserved'  THEN '⚠️ Pago pendiente'
        WHEN 'cancelled' THEN '⚠️ Reserva cancelada'
        WHEN 'suspended' THEN '⚠️ Reserva suspendida'
        ELSE '⚠️ Estado inválido'
      END,
      'customer_name', v_reg.customer_name
    );
  END IF;

  -- 4. Validar que compró ese día.
  --    payment_mode in ('full_combo','auto_subscription','manual_monthly') = todos los días
  --    payment_mode = 'cash_to_seller' = generalmente combo completo
  --    payment_mode = 'individual_days' = chequear days_purchased
  IF v_reg.payment_mode IN ('full_combo','auto_subscription','manual_monthly','cash_to_seller') THEN
    v_has_day := true;
  ELSIF v_reg.payment_mode = 'individual_days' THEN
    v_days_jsonb := COALESCE(v_reg.days_purchased, '[]'::jsonb);
    -- days_purchased es array de números [1,2,4,5]
    v_has_day := (v_days_jsonb ? v_link.day_number::text)
              OR EXISTS(
                SELECT 1 FROM jsonb_array_elements_text(v_days_jsonb) elem
                WHERE elem::int = v_link.day_number
              );
  ELSE
    v_has_day := false;
  END IF;

  IF NOT v_has_day THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', '⚠️ Sin acceso al Día ' || v_link.day_number,
      'customer_name', v_reg.customer_name
    );
  END IF;

  -- 5. Si el link tiene boat_id, validar que el reg esté en esa lancha
  IF v_link.boat_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM solstice_boat_passengers p
      JOIN solstice_boat_reservations r ON r.id = p.boat_reservation_id
      WHERE p.registration_id = v_reg.id
        AND r.boat_id = v_link.boat_id
    ) INTO v_boat_match;

    IF NOT v_boat_match THEN
      RETURN jsonb_build_object(
        'status', 'invalid',
        'message', '⚠️ No asignado a esta lancha',
        'customer_name', v_reg.customer_name
      );
    END IF;
  END IF;

  -- 6. ¿Ya checkeado en este día?
  SELECT EXISTS(
    SELECT 1 FROM solstice_checkins
    WHERE registration_id = v_reg.id AND day_number = v_link.day_number
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object(
      'status', 'used',
      'message', '✓ Ya entró',
      'customer_name', v_reg.customer_name,
      'university', v_reg.customer_university
    );
  END IF;

  -- 7. Insertar checkin
  INSERT INTO solstice_checkins(registration_id, day_number, notes)
  VALUES (v_reg.id, v_link.day_number, 'bouncer:' || v_link.label);

  RETURN jsonb_build_object(
    'status', 'success',
    'message', '✓ Entrada validada',
    'customer_name', v_reg.customer_name,
    'university', v_reg.customer_university
  );
END;
$$;

GRANT EXECUTE ON FUNCTION solstice_bouncer_validate_qr(text, text) TO anon, authenticated;
