-- Activa la extensión pg_cron (ya viene incluida en Supabase)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Cada 15 minutos llama a la Edge Function bold-reconcile
-- Reemplaza <TU_PROJECT_REF> con el ID de tu proyecto Supabase (ej: abcdefghijklmnop)
-- y <TU_ANON_KEY> con la anon key de tu proyecto
select cron.schedule(
  'bold-reconcile-every-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url    := 'https://<TU_PROJECT_REF>.supabase.co/functions/v1/bold-reconcile',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <TU_ANON_KEY>"}'::jsonb,
    body   := '{}'::jsonb
  );
  $$
);
