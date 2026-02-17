
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
-- 2. ENUMS
-- ==========================================
CREATE TYPE user_role AS ENUM ('admin', 'head_of_sales', 'manager', 'promoter', 'guest');
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
  password TEXT DEFAULT '1234', -- Contraseña simple para login
  role user_role DEFAULT 'promoter',
  sales_team_id UUID, 
  manager_id UUID REFERENCES profiles(id),
  total_sales NUMERIC DEFAULT 0,
  total_commission_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- B. EQUIPOS
CREATE TABLE sales_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- C. RELACIÓN
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

-- E. TIERS
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

-- F. ORDENES
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'completed',
  payment_method TEXT DEFAULT 'digital',
  staff_id UUID REFERENCES profiles(id),
  commission_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- G. ITEMS
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  tier_id UUID REFERENCES ticket_tiers(id),
  tier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL
);

-- H. COSTOS
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
-- 4. POLÍTICAS
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public teams" ON sales_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public tiers" ON ticket_tiers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public costs" ON event_costs FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. ADMIN
-- ==========================================
INSERT INTO profiles (id, email, full_name, code, password, role)
VALUES 
(gen_random_uuid(), 'admin@midnight.com', 'Super Admin', 'ADMIN123', 'admin', 'admin');
