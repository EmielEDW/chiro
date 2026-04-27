BEGIN;

-- Convert items.category van enum naar text. Bestaande waarden ("frisdranken", etc.)
-- matchen al de slugs die in Migration 1 zijn geseed.
ALTER TABLE public.items
  ALTER COLUMN category TYPE text
  USING category::text;

-- Drop de enum (niets gebruikt het nog na de TYPE-conversie)
DROP TYPE public.drink_category;

-- Voeg FK toe naar categories(slug)
ALTER TABLE public.items
  ADD CONSTRAINT items_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(slug)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

COMMIT;
