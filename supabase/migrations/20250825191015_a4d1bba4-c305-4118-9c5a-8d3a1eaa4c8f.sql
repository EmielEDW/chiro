-- First, we need to drop the existing enum and recreate it with the new values
-- Since we can't directly alter enum values that are already in use, we'll create a new enum
-- and migrate the data

-- Create new enum with the desired values
CREATE TYPE drink_category_new AS ENUM ('chips', 'frisdranken', 'bieren', 'mixed_drinks', 'andere');

-- Update the items table to use the new enum
-- First, add a temporary column with the new enum type
ALTER TABLE items ADD COLUMN category_new drink_category_new;

-- Migrate existing data to new categories
UPDATE items SET category_new = CASE 
  WHEN category::text = 'frisdrank_pils_chips' THEN 'frisdranken'::drink_category_new
  WHEN category::text = 'energy_kriek' THEN 'bieren'::drink_category_new
  WHEN category::text = 'mixed_drink' THEN 'mixed_drinks'::drink_category_new
  ELSE 'andere'::drink_category_new
END;

-- Drop the old column and rename the new one
ALTER TABLE items DROP COLUMN category;
ALTER TABLE items RENAME COLUMN category_new TO category;

-- Drop the old enum type
DROP TYPE drink_category;

-- Rename the new enum type to the original name
ALTER TYPE drink_category_new RENAME TO drink_category;