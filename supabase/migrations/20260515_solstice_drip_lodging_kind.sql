-- ─────────────────────────────────────────────────────────────────────────────
-- SOLSTICE: extender solstice_drip_log con el kind 'lodging_upsell'
-- Para el email D+1 post-confirmación que ofrece los hospedajes disponibles.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE solstice_drip_log
  DROP CONSTRAINT IF EXISTS solstice_drip_log_kind_check;

ALTER TABLE solstice_drip_log
  ADD CONSTRAINT solstice_drip_log_kind_check CHECK (kind IN (
    'week_d_minus_7',
    'week_d_minus_1',
    'week_d_zero',
    'week_d_plus_1',
    'lodging_upsell'
  ));
