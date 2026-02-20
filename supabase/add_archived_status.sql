-- AGREGAR ESTADO 'archived' AL ENUM event_status
-- Ejecuta este script en el Editor SQL de Supabase para permitir el archivado de eventos.

ALTER TYPE event_status ADD VALUE 'archived';
