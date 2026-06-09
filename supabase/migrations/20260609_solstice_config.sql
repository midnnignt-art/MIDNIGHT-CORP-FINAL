-- Config global de Solstice (key-value). El flag de visibilidad del planeta
-- estaba en Storage (poco confiable, no sincronizaba entre dispositivos).
-- Lo movemos a una tabla con LECTURA PÚBLICA para que el portal sepa, para
-- cualquier visitante, si Solstice está activo.
CREATE TABLE IF NOT EXISTS solstice_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE solstice_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS solstice_config_read ON solstice_config;
CREATE POLICY solstice_config_read  ON solstice_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS solstice_config_write ON solstice_config;
CREATE POLICY solstice_config_write ON solstice_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Activado (el owner ya quiere Solstice visible al público).
INSERT INTO solstice_config(key, value) VALUES ('public_visible', 'true'::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();
