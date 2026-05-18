-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: tracking de pago Bold por cuota individual
-- Permite pagar una cuota específica online (no solo cobro automático).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE solstice_payment_schedules
  ADD COLUMN IF NOT EXISTS bold_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_at         timestamptz,
  ADD COLUMN IF NOT EXISTS bold_order_ref  text;

CREATE INDEX IF NOT EXISTS sps_bold_order_idx ON solstice_payment_schedules (bold_order_ref)
  WHERE bold_order_ref IS NOT NULL;

-- ─── Función: marca cuota como pagada y actualiza el registration ────────
-- Idempotente: si ya está paid, no hace nada.
-- Devuelve la cuota actualizada (para que el webhook sepa qué pasó).

CREATE OR REPLACE FUNCTION fn_solstice_mark_cuota_paid(
  p_schedule_id    uuid,
  p_bold_payment_id text DEFAULT NULL
)
RETURNS TABLE (
  schedule_id     uuid,
  registration_id uuid,
  amount          numeric,
  was_pending     boolean
) AS $$
DECLARE
  v_reg_id    uuid;
  v_amount    numeric;
  v_was       boolean;
BEGIN
  UPDATE solstice_payment_schedules
  SET status         = 'paid',
      paid_at        = COALESCE(paid_at, now()),
      bold_payment_id = COALESCE(p_bold_payment_id, bold_payment_id)
  WHERE id = p_schedule_id
    AND status <> 'paid'
  RETURNING registration_id, amount, true
  INTO v_reg_id, v_amount, v_was;

  IF v_reg_id IS NULL THEN
    -- Ya estaba paid → no-op pero devolvemos datos para idempotencia
    SELECT registration_id, amount, false INTO v_reg_id, v_amount, v_was
    FROM solstice_payment_schedules WHERE id = p_schedule_id;
  ELSE
    -- Subir amount_paid + bajar installments_remaining
    UPDATE solstice_registrations
    SET amount_paid            = amount_paid + v_amount,
        installments_remaining = GREATEST(0, installments_remaining - 1)
    WHERE id = v_reg_id;
  END IF;

  RETURN QUERY SELECT p_schedule_id, v_reg_id, v_amount, COALESCE(v_was, false);
END;
$$ LANGUAGE plpgsql;
