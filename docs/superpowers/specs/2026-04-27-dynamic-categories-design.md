# Dynamic Categories — Design

**Datum:** 2026-04-27
**Status:** Approved (sections 1–4)

## Probleem

Productcategorieën zijn nu hardcoded als Postgres `enum drink_category` met vaste waarden (`frisdranken`, `bieren`, `sterke_dranken`, `mixed_drinks`, `chips`, `andere`). Naam, kleur en sorteervolgorde zitten verspreid over meerdere frontend-bestanden. De admin kan zelf geen categorieën toevoegen of bestaande aanpassen.

Daarnaast wordt de `mixed_drinks`-feature (samengestelde drankjes met componenten) niet meer gebruikt en mag volledig verdwijnen.

## Doelen

1. Admin kan via de UI nieuwe categorieën aanmaken, bestaande hernoemen, herkleuren en hersorteren.
2. Categorieën zijn één bron van waarheid (DB-tabel) — geen hardcoded mappings meer in frontend.
3. `mixed_drinks` en alle bijhorende infrastructuur (tabel, triggers-branches, UI-form, hardcoded references) wordt volledig verwijderd.
4. Bestaande producten en flows blijven werken zonder zichtbare verandering tot de admin actief iets aanpast.

## Niet-doelen

- Per-categorie toegangsbeheer of zichtbaarheid voor specifieke rollen.
- Iconen of emoji's per categorie.
- Vrije hex-kleuren — enkel een vast palet.
- Categorie-hiërarchie / subcategorieën.

## Design

### Data model

Nieuwe tabel `categories`:

| Kolom | Type | Beschrijving |
|---|---|---|
| `slug` | `text` PRIMARY KEY | Stabiele identifier (bv. `frisdranken`). Auto-gegenereerd uit naam. |
| `name` | `text` NOT NULL | Weergavenaam. Lengte 1–40. |
| `color` | `text` NOT NULL | Eén van de palet-keys (zie hieronder). |
| `sort_order` | `integer` NOT NULL DEFAULT 100 | Lager = eerder in lijst. |
| `is_protected` | `boolean` NOT NULL DEFAULT false | Indien `true`: niet verwijderbaar. Alleen `andere`. |
| `created_at` | `timestamptz` NOT NULL DEFAULT now() | |

Wijziging aan `items`:
- `items.category` blijft `text`-kolom maar wordt FK → `categories(slug)` met `ON UPDATE CASCADE` (rename werkt door op alle items) en `ON DELETE RESTRICT` (verwijderen geblokkeerd zolang er producten in zitten).
- De `drink_category`-enum wordt gedropt na de FK-omzetting.

**Waarom slug als primary key i.p.v. UUID:** alle bestaande code vergelijkt op string (`item.category === 'frisdranken'`). Slug-FK = minimale code-impact + leesbare data + behoud van referentiële integriteit via DB-constraint.

### Kleurenpalet

Acht vaste keys, gemapt naar Tailwind-classes:

| Key | Tailwind classes |
|---|---|
| `blue` | `bg-blue-100 text-blue-800` |
| `amber` | `bg-amber-100 text-amber-800` |
| `red` | `bg-red-100 text-red-800` |
| `yellow` | `bg-yellow-100 text-yellow-800` |
| `gray` | `bg-gray-100 text-gray-800` |
| `green` | `bg-green-100 text-green-800` |
| `purple` | `bg-purple-100 text-purple-800` |
| `pink` | `bg-pink-100 text-pink-800` |

Mapping in `src/lib/categoryColors.ts`. Tailwind safelist toegevoegd in `tailwind.config.ts` zodat de classes niet weggepurged worden.

### RLS

- `SELECT`: iedereen (authenticated + anon, omdat gasten ook de drank-pagina zien).
- `INSERT/UPDATE/DELETE`: enkel admins (zelfde policy-pattern als `restock_sessions`).

### Validatie

In de form (CategoryManagement):
- `name`: niet-leeg, ≤ 40 chars
- `slug`: lowercase, regex `^[a-z0-9_]+$`, uniek (auto-gegenereerd uit naam, maar duplicate detection)
- `color`: enkel uit palet-keys
- `sort_order`: integer ≥ 0

DB-zijde: `CHECK (color IN (...))`-constraint optioneel; PRIMARY KEY zorgt voor uniqueness van slug.

### Admin UI

**Locatie:** Nieuwe tab "Categorieën" in `AdminDashboard.tsx`.

**Component:** `src/components/admin/CategoryManagement.tsx`.

**Layout:** Tabel zoals `ProductManagement` met kolommen Volgorde / Naam / Kleur (badge) / # Producten / Acties (bewerk + verwijder).

**Modale dialog (nieuw + bewerken):**
- Naam (text input, max 40)
- Slug (alleen tonen bij bewerken, read-only — voorkomt accidentele breuken)
- Kleur (palet van 8 kleuren als klikbare bolletjes met checkmark op de actieve)
- Sorteervolgorde (number input met hint "lager = eerder in de lijst")

**Verwijderen:**
- Knop disabled als `is_protected = true` (alleen `andere`)
- Klik → confirm dialog
- App checkt vooraf product-count zodat de toast specifiek kan zijn: *"Kan niet verwijderen: er zijn nog X producten in deze categorie. Verplaats die eerst."*
- DB-zijde gooit `ON DELETE RESTRICT`-error als guard

### `mixed_drinks` verwijderen

**Database:**
1. Pre-flight check in migratie: tellen items met `category='mixed_drinks'` en rijen in `mixed_drink_components`. Bij ≥ 1 → `RAISE EXCEPTION` zodat migratie aborteert (geen stille data-verlies).
2. Triggers in [`fix_consumption_trigger.sql`](../../supabase/migrations/20260323100000_fix_consumption_trigger.sql) en [`prevent_negative_stock.sql`](../../supabase/migrations/20260316210000_prevent_negative_stock.sql) herschrijven (`CREATE OR REPLACE FUNCTION`) zonder de `FROM mixed_drink_components` branches.
3. `DROP TABLE public.mixed_drink_components;`
4. Enum-waarde verdwijnt automatisch wanneer de hele `drink_category` enum gedropt wordt in de FK-migratie.

**Frontend:**
- `DrinkGrid.tsx`: branches voor `item.category === 'mixed_drinks'` weghalen (regels ~51, ~391, ~502); cases in `getCategoryColor/Name/Order` weghalen.
- `ProductManagement.tsx`: `selectedComponents`, `existingComponents` query, `.neq('category', 'mixed_drinks')` filter, mutaties op `mixed_drink_components`, conditionele rendering — allemaal weg.
- `MobileCategoryFilter.tsx`: hardcoded categorie-lijst wordt sowieso vervangen door DB-data via `useCategories()`-hook; `mixed_drinks`-entry valt vanzelf weg.
- Hardcoded `getCategoryName/Color/Order`-helpers worden vervangen door één centrale helper die via `useCategories()` werkt.

### Migratie & rollout

Drie aparte migratie-bestanden, in deze volgorde:

**Migratie 1 — `categories`-tabel + seed (puur additief):**
```sql
CREATE TABLE public.categories (
  slug text PRIMARY KEY,
  name text NOT NULL,
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
-- SELECT policy voor iedereen, ALL voor admins (zelfde pattern als restock_sessions)
```
App werkt 100% zoals voorheen — niets gebruikt deze tabel nog.

**Migratie 2 — `mixed_drinks` opruimen:**
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM items WHERE category = 'mixed_drinks') THEN
    RAISE EXCEPTION 'Items met category=mixed_drinks bestaan nog, migratie afgebroken';
  END IF;
  IF EXISTS (SELECT 1 FROM mixed_drink_components LIMIT 1) THEN
    RAISE EXCEPTION 'mixed_drink_components bevat nog rijen, migratie afgebroken';
  END IF;
END $$;

-- Triggers CREATE OR REPLACE zonder mixed_drink_components branches
-- (consumption trigger en prevent_negative_stock trigger)

DROP TABLE public.mixed_drink_components;
```

**Migratie 3 — enum vervangen door FK:**
```sql
ALTER TABLE items ALTER COLUMN category TYPE text USING category::text;
DROP TYPE drink_category;
ALTER TABLE items
  ADD CONSTRAINT items_category_fkey
  FOREIGN KEY (category) REFERENCES categories(slug)
  ON UPDATE CASCADE ON DELETE RESTRICT;
```

**Frontend rollout (samen met migraties):**
1. `src/lib/categoryColors.ts` — palet map
2. `tailwind.config.ts` — safelist
3. `src/hooks/useCategories.ts` — TanStack Query hook (`queryKey: ['categories']`)
4. `src/components/admin/CategoryManagement.tsx` (nieuw)
5. `AdminDashboard.tsx` — tab toevoegen
6. `DrinkGrid.tsx`, `ProductManagement.tsx`, `MobileCategoryFilter.tsx` — hardcoded helpers en `mixed_drinks`-branches vervangen
7. `LateFeeDialog.tsx` — gebruikt `'andere'` als string, blijft werken (slug bestaat in seed)
8. `src/integrations/supabase/types.ts` — regenereren via Supabase CLI (of manueel updaten als CLI niet beschikbaar)

## Verificatie

Na deployment:
- Bestaande producten verschijnen onveranderd op de drank-pagina (zelfde namen, kleuren, volgorde)
- Filter-bar toont de 5 seed-categorieën
- Admin → Categorieën: 5 rijen zichtbaar, allemaal bewerkbaar, `andere` heeft slot-icoon en disabled delete-knop
- Nieuwe categorie aanmaken: verschijnt in product-form dropdown én in de filter-bar én in de drank-grid (als er producten in zitten)
- Categorie hernoemen: items volgen automatisch (CASCADE)
- Categorie verwijderen met producten erin: geblokkeerd met toast
- Categorie verwijderen die leeg is: lukt
- Drankje consumeren: trigger werkt nog (stock_quantity gaat met 1 omlaag)

## Rollback

Elke migratie is een apart bestand; kan in omgekeerde volgorde teruggedraaid worden. DB-backup voor migratie-run sterk aangeraden. Frontend kan via git revert teruggerold worden — let op dat de oude code de `categories`-tabel niet kent maar dat is niet erg (hij gebruikt enum-strings die nog steeds als slug-waarden in `items.category` staan).

## Risico's

- **Tailwind purge:** als safelist niet correct werkt, blijven palet-classes weg uit de bundle. Mitigatie: handmatig testen met elke kleur na build.
- **Trigger-rewrites:** als de herschreven trigger een bug heeft, breken consumpties. Mitigatie: trigger-tests voor en na vergelijken (één drankje loggen op staging).
- **Duplicate slug bij creatie:** twee categorieën "Snacks" → beide krijgen slug `snacks`. App-validatie vangt dit op vóór de DB-call (via PK violation als backup).
