-- ─────────────────────────────────────────────────────────────────────────────
-- events — agregar campos editables (dress code, edad mínima, FAQ)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Hoy el Hero y la página /event/[id] muestran estos valores hardcodeados:
--   - "Strict Nightlife" (dress code)
--   - "18+" (edad mínima)
--   - 4 FAQs genéricas
--
-- Pasarlos a la BD permite que cada evento tenga su propio valor editable
-- desde el Backoffice.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS dress_code text       DEFAULT 'Strict Nightlife',
  ADD COLUMN IF NOT EXISTS min_age    smallint   DEFAULT 18,
  ADD COLUMN IF NOT EXISTS faq        jsonb      DEFAULT '[]'::jsonb;

-- Comentarios para documentar el shape esperado
COMMENT ON COLUMN events.dress_code IS 'Dress code visible en página del evento';
COMMENT ON COLUMN events.min_age    IS 'Edad mínima para entrar (default 18)';
COMMENT ON COLUMN events.faq        IS 'Array de {q,a} para FAQ del evento. Si vacío, se muestra el FAQ genérico de la plataforma.';
