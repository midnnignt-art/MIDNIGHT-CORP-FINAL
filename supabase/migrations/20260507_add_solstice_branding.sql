-- Shared Solstice branding so desktop and mobile render the same logo/settings.
CREATE TABLE IF NOT EXISTS solstice_branding (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  logo_url text,
  logo_sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_layouts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO solstice_branding (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE solstice_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sol_branding_read_public" ON solstice_branding;
DROP POLICY IF EXISTS "sol_branding_manage_auth" ON solstice_branding;

CREATE POLICY "sol_branding_read_public"
  ON solstice_branding
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "sol_branding_manage_auth"
  ON solstice_branding
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
