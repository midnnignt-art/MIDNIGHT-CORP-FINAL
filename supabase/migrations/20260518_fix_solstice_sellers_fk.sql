-- Fix: solstice_sellers.user_id apuntaba a auth.users(id), pero los promotores
-- de Midnight se crean directo en `profiles` con crypto.randomUUID() y NO tienen
-- una row correspondiente en auth.users. Resultado: cualquier intento de activar
-- un promotor para Solstice (insert en solstice_sellers) fallaba por violación
-- de FK, sin error visible para el usuario salvo el toast "Error: ...".
--
-- Apuntamos el FK a profiles(id) que es la tabla real de promotores.

ALTER TABLE solstice_sellers
  DROP CONSTRAINT IF EXISTS solstice_sellers_user_id_fkey;

ALTER TABLE solstice_sellers
  ADD CONSTRAINT solstice_sellers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
