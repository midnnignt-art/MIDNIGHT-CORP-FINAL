-- ─── Solstice boats: galería multi-foto ─────────────────────────────────
-- El owner pidió que las lanchas se vean con varias fotos antes de elegirlas
-- en el checkout. Agregamos un array JSON de URLs (ordenable). La primera
-- foto del array sigue siendo la "principal" (cae a image_url legacy si el
-- array está vacío). Subidas se manejan vía Supabase Storage bucket 'assets'
-- en el path 'solstice/boats/<boat_id>/<filename>'.

ALTER TABLE solstice_boats
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: si el boat ya tiene image_url, lo metemos como primer elemento
-- de la galería para que el campo nuevo no quede vacío.
UPDATE solstice_boats
  SET gallery = jsonb_build_array(image_url)
  WHERE image_url IS NOT NULL
    AND image_url <> ''
    AND (gallery IS NULL OR jsonb_array_length(gallery) = 0);

-- Index leve para queries que filtren por presencia de fotos
CREATE INDEX IF NOT EXISTS idx_sol_boats_gallery_count
  ON solstice_boats ((jsonb_array_length(gallery)));
