-- Días flexibles por combo
ALTER TABLE solstice_seasons
  ADD COLUMN IF NOT EXISTS combo1_days integer[] DEFAULT '{1,2,4,5}',
  ADD COLUMN IF NOT EXISTS combo_days  integer[] DEFAULT '{1,2,3,4,5}';
