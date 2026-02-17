
-- ==========================================
-- 1. LIMPIEZA TOTAL (RESET)
-- ==========================================
DROP TABLE IF EXISTS event_costs CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS ticket_tiers CASCADE;
DROP TABLE IF EXISTS sales_teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS events CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS event_status CASCADE;
DROP TYPE IF EXISTS event_stage CASCADE;

-- ==========================================
-- 2. TIPOS DE DATOS (ENUMS - MAYÚSCULAS)
-- ==========================================
CREATE TYPE user_role AS ENUM ('ADMIN', 'HEAD_OF_SALES', 'MANAGER', 'PROMOTER', 'GUEST');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'sold_out', 'cancelled', 'completed');
CREATE TYPE event_stage AS ENUM ('early_bird', 'presale', 'general', 'door');

-- ==========================================
-- 3. TABLAS MAESTRAS
-- ==========================================

-- A. PERFILES (STAFF)
CREATE TABLE profiles (
  id UUID PRIMARY KEY, 
  email TEXT NOT NULL,
  full_name TEXT,
  code TEXT UNIQUE,
  password TEXT DEFAULT '1234',
  role user_role DEFAULT 'PROMOTER',
  sales_team_id UUID,
  manager_id UUID REFERENCES profiles(id),
  total_sales NUMERIC DEFAULT 0,
  total_commission_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- B. EQUIPOS DE VENTA (SQUADS)
CREATE TABLE sales_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- C. VINCULACIÓN CIRCULAR
ALTER TABLE profiles 
ADD CONSTRAINT fk_sales_team 
FOREIGN KEY (sales_team_id) REFERENCES sales_teams(id);

-- D. EVENTOS
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  venue TEXT,
  venue_address TEXT,
  city TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  doors_open TEXT,
  status event_status DEFAULT 'draft',
  current_stage event_stage DEFAULT 'early_bird',
  total_capacity INTEGER DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  artists TEXT[],
  tags TEXT[], 
  gallery TEXT[], 
  nft_benefits TEXT[], 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- E. TIERS (Etapas/Localidades)
CREATE TABLE ticket_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage event_stage DEFAULT 'general',
  price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  sold INTEGER DEFAULT 0,
  commission_fixed NUMERIC DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- F. ORDENES (Ventas)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  event_id UUID REFERENCES events(id) NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'completed', -- POR DEFECTO COMPLETADA (BETA)
  payment_method TEXT DEFAULT 'cash',
  staff_id UUID REFERENCES profiles(id),
  commission_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- G. ITEMS DE ORDEN (Detalle)
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  tier_id UUID REFERENCES ticket_tiers(id),
  tier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL
);

-- H. COSTOS DEL EVENTO
CREATE TABLE event_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  concept TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 4. SEGURIDAD (RLS - ABIERTO PARA BETA)
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access sales_teams" ON sales_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access ticket_tiers" ON ticket_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Access event_costs" ON event_costs FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. DATOS SEMILLA (SEED DATA)
-- ==========================================

-- A. Crear Super Admin (CON ID FIJO PARA EVITAR ERRORES DE LOGIN)
INSERT INTO profiles (id, email, full_name, code, password, role)
VALUES 
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@midnight.com', 'Super Admin', 'ADMIN123', 'admin', 'ADMIN');

-- B. Crear un Evento de Prueba
INSERT INTO events (title, slug, description, event_date, doors_open, cover_image, status, total_capacity, city, venue)
VALUES (
  'Midnight Launch Party', 
  'midnight-launch', 
  'El inicio de una nueva era.', 
  NOW() + INTERVAL '30 days',
  '22:00',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80',
  'published',
  250,
  'Bogotá',
  'Espacio 10-60'
);

-- C. Crear Tickets
DO $$
DECLARE last_event_id UUID;
BEGIN
  SELECT id INTO last_event_id FROM events LIMIT 1;
  
  INSERT INTO ticket_tiers (event_id, name, price, quantity, commission_fixed, stage)
  VALUES 
  (last_event_id, 'General Early Bird', 50, 200, 5, 'early_bird'),
  (last_event_id, 'VIP Access', 150, 50, 15, 'presale');
END $$;
