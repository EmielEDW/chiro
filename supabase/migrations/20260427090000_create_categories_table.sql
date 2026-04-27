BEGIN;

CREATE TABLE public.categories (
  slug text PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  color text NOT NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categories (slug, name, color, sort_order, is_protected) VALUES
  ('frisdranken',    'Frisdranken',    'blue',   1,   false),
  ('bieren',         'Bieren',         'amber',  2,   false),
  ('sterke_dranken', 'Sterke dranken', 'red',    3,   false),
  ('chips',          'Chips',          'yellow', 4,   false),
  ('andere',         'Andere',         'gray',   100, true);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
ON public.categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

COMMIT;
