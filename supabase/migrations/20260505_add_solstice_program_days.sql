-- Tabla de configuración de días del programa por temporada
-- Permite al admin cambiar nombre, subtítulo, imagen y precio de cada día sin tocar código

CREATE TABLE IF NOT EXISTS solstice_program_days (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid REFERENCES solstice_seasons(id) ON DELETE CASCADE,
  day_number    integer NOT NULL CHECK (day_number BETWEEN 1 AND 5),
  title         text NOT NULL DEFAULT '',
  subtitle      text DEFAULT '',
  price         integer NOT NULL DEFAULT 70000,
  image_url     text,
  highlight     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (season_id, day_number)
);

-- Agregar jerarquía de equipos a solstice_sellers
-- Reutiliza las mismas tablas sales_teams y super_squads de Midnight
ALTER TABLE solstice_sellers
  ADD COLUMN IF NOT EXISTS sales_team_id uuid,
  ADD COLUMN IF NOT EXISTS super_squad_id uuid;

-- Seed de días por defecto para la temporada 2026
INSERT INTO solstice_program_days (season_id, day_number, title, subtitle, price, highlight)
SELECT id, 1, 'Llegada',       'Apertura nocturna',         70000,  false FROM solstice_seasons WHERE name = 'SOLSTICE 2026' ON CONFLICT DO NOTHING;
INSERT INTO solstice_program_days (season_id, day_number, title, subtitle, price, highlight)
SELECT id, 2, 'Día libre',     'Fiesta nocturna',           70000,  false FROM solstice_seasons WHERE name = 'SOLSTICE 2026' ON CONFLICT DO NOTHING;
INSERT INTO solstice_program_days (season_id, day_number, title, subtitle, price, highlight)
SELECT id, 3, 'Catamarán',     '50 p · DJ · AYCD · Bahía', 130000, true  FROM solstice_seasons WHERE name = 'SOLSTICE 2026' ON CONFLICT DO NOTHING;
INSERT INTO solstice_program_days (season_id, day_number, title, subtitle, price, highlight)
SELECT id, 4, 'Playa privada', 'All you can drink',         100000, false FROM solstice_seasons WHERE name = 'SOLSTICE 2026' ON CONFLICT DO NOTHING;
INSERT INTO solstice_program_days (season_id, day_number, title, subtitle, price, highlight)
SELECT id, 5, 'Cierre',        'Última noche',              70000,  false FROM solstice_seasons WHERE name = 'SOLSTICE 2026' ON CONFLICT DO NOTHING;
