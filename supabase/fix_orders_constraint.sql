-- CORRECCIÓN DE ERROR DE BORRADO (Foreign Key Constraint)
-- Ejecuta este script en el Editor SQL de Supabase para permitir 
-- que al borrar un evento se borren automáticamente sus ordenes.

-- 1. Eliminar la restricción actual que bloquea el borrado
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_event_id_fkey;

-- 2. Crear la nueva restricción con REACCIÓN EN CADENA (Cascade)
ALTER TABLE orders
ADD CONSTRAINT orders_event_id_fkey
FOREIGN KEY (event_id)
REFERENCES events(id)
ON DELETE CASCADE;

-- 3. Asegurar que los items de la orden también se borren (por si acaso)
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE order_items
ADD CONSTRAINT order_items_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES orders(id)
ON DELETE CASCADE;
