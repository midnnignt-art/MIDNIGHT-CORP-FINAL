-- Columna para guardar el payment_id que Bold asigna a cada transacción
-- Se llena cuando el webhook llega correctamente; sirve para consultar el estado vía API
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bold_payment_id TEXT;
