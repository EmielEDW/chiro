# Dynamic Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `drink_category` enum with a user-managed `categories` table (name, color, sort order) and remove the unused `mixed_drinks` feature entirely.

**Architecture:** New `public.categories` table (slug PK, name, color, sort_order, is_protected). `items.category` becomes a text FK referencing `categories(slug)` with `ON UPDATE CASCADE` / `ON DELETE RESTRICT`. The `drink_category` enum and the `mixed_drink_components` table + RPCs + trigger branches are dropped. A new `useCategories()` hook provides the single source of truth in the frontend; all hardcoded `getCategoryName/Color/Order` helpers and the `mixed_drinks` UI are removed. Admin gets a "Categorieën" tab with table + create/edit dialog.

**Tech Stack:** React 18 + TypeScript, TanStack Query v5, Supabase (PostgreSQL + RLS), shadcn/ui (Radix), Tailwind v3.

**Spec:** [docs/superpowers/specs/2026-04-27-dynamic-categories-design.md](../specs/2026-04-27-dynamic-categories-design.md)

**Project notes:**
- Repo has **no test framework** — verification is manual via `npm run dev` and `npm run build`.
- Repo is **not a git repository** — replace any "commit" steps with manual checkpoints (open dev server, verify behavior).
- `src/integrations/supabase/types.ts` is normally auto-generated. Without Supabase CLI access, it must be edited manually as part of the relevant tasks. The plan calls out exact edits.
- Migrations are applied by running them in the Supabase Dashboard SQL editor or via `supabase db push` if the CLI is configured.

---

## File Structure

**New files:**
- `chiro/supabase/migrations/20260427090000_create_categories_table.sql` — categories table + seed + RLS
- `chiro/supabase/migrations/20260427090100_drop_mixed_drinks.sql` — pre-flight check + trigger rewrite + drop table + drop RPCs
- `chiro/supabase/migrations/20260427090200_items_category_fk.sql` — convert enum to FK
- `chiro/src/lib/categoryColors.ts` — palette key → Tailwind classes map
- `chiro/src/hooks/useCategories.ts` — TanStack Query hook
- `chiro/src/components/admin/CategoryManagement.tsx` — admin UI

**Modified files:**
- `chiro/tailwind.config.ts` — add safelist for palette classes
- `chiro/src/integrations/supabase/types.ts` — manual: add `categories` table type, update `items.category` to `string | null`, remove `mixed_drink_components`, remove enum
- `chiro/src/pages/AdminDashboard.tsx` — add 6th tab
- `chiro/src/components/admin/ProductManagement.tsx` — remove mixed_drinks UI, use `useCategories`
- `chiro/src/components/DrinkGrid.tsx` — remove mixed_drinks branches and RPC call, use `useCategories`
- `chiro/src/components/MobileCategoryFilter.tsx` — use `useCategories`

**Deleted files:** none (existing migrations are immutable history).

---

### Task 1: Create `categories` table + seed (Migration 1)

**Files:**
- Create: `chiro/supabase/migrations/20260427090000_create_categories_table.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run via Supabase Dashboard SQL editor (paste the file content), or `supabase db push` if the CLI is configured.

- [ ] **Step 3: Verify in DB**

In the Supabase SQL editor:
```sql
SELECT slug, name, color, sort_order, is_protected FROM public.categories ORDER BY sort_order;
```
Expected: 5 rows (frisdranken, bieren, sterke_dranken, chips, andere) with `andere.is_protected = true`.

- [ ] **Step 4: Verify the app still works**

Run `npm run dev` (port 8080). Open the app → drank-pagina should look exactly like before (this migration is purely additive, no code uses the new table yet).

**Checkpoint:** categories table exists and is seeded; app unchanged.

---

### Task 2: Add Tailwind safelist for palette classes

**Files:**
- Modify: `chiro/tailwind.config.ts`

The new `useCategories()` flow constructs class names like `bg-${color}-100` dynamically. Tailwind's purger doesn't see them in source and would strip them. Safelist the eight palette classes.

- [ ] **Step 1: Add safelist to tailwind.config.ts**

Edit `tailwind.config.ts`. Insert this after `prefix: "",` (around line 12), before `theme: {`:

```ts
	safelist: [
		"bg-blue-100", "text-blue-800",
		"bg-amber-100", "text-amber-800",
		"bg-red-100", "text-red-800",
		"bg-yellow-100", "text-yellow-800",
		"bg-gray-100", "text-gray-800",
		"bg-green-100", "text-green-800",
		"bg-purple-100", "text-purple-800",
		"bg-pink-100", "text-pink-800",
	],
```

- [ ] **Step 2: Verify build still succeeds**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 3: Verify safelist works**

Open `dist/assets/*.css` (or use grep). Confirm all eight pairs are present in the bundled CSS.

```bash
grep -c "bg-pink-100" dist/assets/*.css
```
Expected: ≥ 1.

**Checkpoint:** Tailwind ships all eight palette pairs in the bundle.

---

### Task 3: Create `categoryColors` helper

**Files:**
- Create: `chiro/src/lib/categoryColors.ts`

Single source of truth for palette key → Tailwind classes mapping. Used by both the admin form and the consumer-facing badges.

- [ ] **Step 1: Write the file**

```ts
export const CATEGORY_COLOR_KEYS = [
  "blue",
  "amber",
  "red",
  "yellow",
  "gray",
  "green",
  "purple",
  "pink",
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLOR_KEYS)[number];

const COLOR_CLASSES: Record<CategoryColorKey, string> = {
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-yellow-100 text-yellow-800",
  gray: "bg-gray-100 text-gray-800",
  green: "bg-green-100 text-green-800",
  purple: "bg-purple-100 text-purple-800",
  pink: "bg-pink-100 text-pink-800",
};

const SWATCH_CLASSES: Record<CategoryColorKey, string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  gray: "bg-gray-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
};

export function categoryBadgeClass(color: string | null | undefined): string {
  if (color && color in COLOR_CLASSES) {
    return COLOR_CLASSES[color as CategoryColorKey];
  }
  return COLOR_CLASSES.gray;
}

export function categorySwatchClass(color: CategoryColorKey): string {
  return SWATCH_CLASSES[color];
}

export function isValidColorKey(value: string): value is CategoryColorKey {
  return (CATEGORY_COLOR_KEYS as readonly string[]).includes(value);
}
```

Add the swatch classes to the safelist too — go back to `tailwind.config.ts` and add:

```ts
		"bg-blue-500", "bg-amber-500", "bg-red-500", "bg-yellow-500",
		"bg-gray-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
```

(Add these alongside the previous safelist entries from Task 2.)

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

**Checkpoint:** helper file compiles, swatches in safelist.

---

### Task 4: Manually update `types.ts` for new `categories` table

**Files:**
- Modify: `chiro/src/integrations/supabase/types.ts`

Without Supabase CLI we edit the auto-generated file by hand. We add the `categories` table type now; later tasks will further modify the file when we drop `mixed_drink_components` and the enum.

- [ ] **Step 1: Locate the `Tables:` block in `public` schema**

Open `src/integrations/supabase/types.ts` and find `public: { Tables: { ...`. Find an alphabetically appropriate spot (e.g., right before `consumptions`).

- [ ] **Step 2: Insert the `categories` table definition**

Paste this block as a new entry inside `public.Tables`:

```ts
      categories: {
        Row: {
          slug: string
          name: string
          color: string
          sort_order: number
          is_protected: boolean
          created_at: string
        }
        Insert: {
          slug: string
          name: string
          color: string
          sort_order?: number
          is_protected?: boolean
          created_at?: string
        }
        Update: {
          slug?: string
          name?: string
          color?: string
          sort_order?: number
          is_protected?: boolean
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: success, no TypeScript errors.

**Checkpoint:** TypeScript knows about the `categories` table.

---

### Task 5: Create `useCategories` hook

**Files:**
- Create: `chiro/src/hooks/useCategories.ts`

Single React Query hook that fetches all categories sorted by `sort_order`. Used by `DrinkGrid`, `MobileCategoryFilter`, `ProductManagement`, and `CategoryManagement`. Cached under `['categories']`.

- [ ] **Step 1: Write the hook**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
  slug: string;
  name: string;
  color: string;
  sort_order: number;
  is_protected: boolean;
}

export function useCategories() {
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("slug, name, color, sort_order, is_protected")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const bySlug = new Map<string, Category>();
  for (const cat of query.data ?? []) bySlug.set(cat.slug, cat);

  return {
    categories: query.data ?? [],
    bySlug,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

**Checkpoint:** hook compiles; not yet used.

---

### Task 6: Create `CategoryManagement` admin component

**Files:**
- Create: `chiro/src/components/admin/CategoryManagement.tsx`

Tabel + create/edit dialog. Verwijderen blokkeert via DB-constraint en pre-check op product-count.

- [ ] **Step 1: Write the component**

```tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, Category } from "@/hooks/useCategories";
import {
  CATEGORY_COLOR_KEYS,
  CategoryColorKey,
  categoryBadgeClass,
  categorySwatchClass,
  isValidColorKey,
} from "@/lib/categoryColors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, Lock, Plus, Trash2 } from "lucide-react";

interface FormState {
  name: string;
  color: CategoryColorKey;
  sort_order: string;
}

const EMPTY_FORM: FormState = { name: "", color: "blue", sort_order: "100" };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const CategoryManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { categories, isLoading } = useCategories();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: counts = {} } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("items")
        .select("category");
      if (error) throw error;
      const result: Record<string, number> = {};
      for (const row of data ?? []) {
        const slug = row.category ?? "__null__";
        result[slug] = (result[slug] ?? 0) + 1;
      }
      return result;
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      color: isValidColorKey(cat.color) ? cat.color : "gray",
      sort_order: String(cat.sort_order),
    });
    setIsOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const slug = slugify(form.name);
      if (!slug) throw new Error("Geef een geldige naam op.");
      const { error } = await supabase.from("categories").insert({
        slug,
        name: form.name.trim(),
        color: form.color,
        sort_order: parseInt(form.sort_order, 10) || 100,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Een categorie met deze naam bestaat al.");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      toast({ title: "Categorie aangemaakt" });
      setIsOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase
        .from("categories")
        .update({
          name: form.name.trim(),
          color: form.color,
          sort_order: parseInt(form.sort_order, 10) || 100,
        })
        .eq("slug", editing.slug);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categorie bijgewerkt" });
      setIsOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase.from("categories").delete().eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      toast({ title: "Categorie verwijderd" });
    },
    onError: (e: Error) => {
      toast({ title: "Fout", description: e.message, variant: "destructive" });
    },
  });

  const onDelete = (cat: Category) => {
    const count = counts[cat.slug] ?? 0;
    if (count > 0) {
      toast({
        title: "Kan niet verwijderen",
        description: `Er zijn nog ${count} producten in deze categorie. Verplaats die eerst.`,
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm(`Categorie "${cat.name}" verwijderen?`)) return;
    remove.mutate(cat.slug);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editing) update.mutate();
    else create.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Categorieën</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Laden...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Categorieën
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe categorie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Categorie bewerken" : "Nieuwe categorie"}
                </DialogTitle>
                <DialogDescription>
                  {editing
                    ? "Pas naam, kleur of volgorde aan."
                    : "Geef een naam, kleur en sorteervolgorde."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="cat-name">Naam *</Label>
                  <Input
                    id="cat-name"
                    maxLength={40}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                {editing && (
                  <div>
                    <Label>Slug</Label>
                    <Input value={editing.slug} readOnly disabled />
                  </div>
                )}
                <div>
                  <Label>Kleur</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CATEGORY_COLOR_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-label={key}
                        onClick={() => setForm({ ...form, color: key })}
                        className={`h-8 w-8 rounded-full ${categorySwatchClass(key)} ${
                          form.color === key
                            ? "ring-2 ring-offset-2 ring-foreground"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="cat-order">Sorteervolgorde</Label>
                  <Input
                    id="cat-order"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) =>
                      setForm({ ...form, sort_order: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lager = eerder in de lijst.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="submit"
                    disabled={create.isPending || update.isPending || !form.name.trim()}
                  >
                    {editing ? "Bijwerken" : "Aanmaken"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Volgorde</TableHead>
                <TableHead>Naam</TableHead>
                <TableHead>Kleur</TableHead>
                <TableHead>Producten</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.slug}>
                  <TableCell>{cat.sort_order}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {cat.name}
                    {cat.is_protected && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryBadgeClass(cat.color)}>
                      {cat.color}
                    </Badge>
                  </TableCell>
                  <TableCell>{counts[cat.slug] ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(cat)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={cat.is_protected}
                        onClick={() => onDelete(cat)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryManagement;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: success.

**Checkpoint:** component compiles; not yet wired into the dashboard.

---

### Task 7: Add "Categorieën" tab to AdminDashboard

**Files:**
- Modify: `chiro/src/pages/AdminDashboard.tsx`

- [ ] **Step 1: Import the component**

In the imports block (after line 28 where `NotificationManager` is imported), add:

```ts
import CategoryManagement from '@/components/admin/CategoryManagement';
```

Also add `Tag` to the lucide-react imports (line 8-18). Replace that block with:

```ts
import { 
  BarChart3,
  Users,
  Package,
  Euro,
  TrendingUp,
  AlertTriangle,
  Eye,
  Settings,
  Bell,
  Tag
} from 'lucide-react';
```

- [ ] **Step 2: Update the tabs grid count and add the trigger**

Find this line (around line 106):
```tsx
          <TabsList className="grid w-full grid-cols-5 h-12 bg-background border-2 border-muted">
```
Change `grid-cols-5` to `grid-cols-6`.

Then add a new `<TabsTrigger>` between the "stock" trigger (around lines 121-127) and the "analytics" trigger (around lines 128-134):

```tsx
            <TabsTrigger 
              value="categories" 
              className="flex items-center justify-center gap-1 sm:gap-2 h-10 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:border-destructive data-[state=active]:shadow-sm hover:bg-muted/50 px-1 sm:px-3"
            >
              <Tag className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Categorieën</span>
            </TabsTrigger>
```

- [ ] **Step 3: Add the TabsContent**

Add this `<TabsContent>` block between the existing `stock` content (line 152-157) and the `analytics` content (line 159):

```tsx
          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>
```

- [ ] **Step 4: Verify build and run dev**

Run: `npm run build`
Then: `npm run dev`

Open http://localhost:8080, log in als admin, ga naar `/admin`. Klik op de "Categorieën" tab. Expected: tabel met 5 categorieën verschijnt; `andere` heeft slot-icoon en grijze prullenbak; "Nieuwe categorie" knop opent dialog.

- [ ] **Step 5: Smoke test in dev server**

In the dev server:
1. Open de Categorieën tab.
2. Klik "Nieuwe categorie" → vul "Snacks" in, kies kleur green, sort_order 5 → klik Aanmaken. Expected: rij verschijnt in tabel met 0 producten.
3. Klik bewerk-icoon op "Snacks" → wijzig kleur → klik Bijwerken. Expected: badge-kleur verandert.
4. Klik prullenbak op "Snacks" → bevestig. Expected: rij verdwijnt.
5. Klik prullenbak op "Frisdranken" → bevestig. Expected: toast "Kan niet verwijderen: er zijn nog X producten in deze categorie".
6. Klik prullenbak op "Andere": knop is disabled (geen klik mogelijk).

**Checkpoint:** admin kan CRUD doen op categorieën; protections werken.

---

### Task 8: Refactor `MobileCategoryFilter` to use `useCategories`

**Files:**
- Modify: `chiro/src/components/MobileCategoryFilter.tsx`

Removes the hardcoded `categories` array (including the `mixed_drinks` entry).

- [ ] **Step 1: Replace the hardcoded array with the hook**

Open `src/components/MobileCategoryFilter.tsx`. Delete lines 6-13 (the `const categories = [...]` array). At the top of the file, add the imports and helper:

```tsx
import { useCategories } from '@/hooks/useCategories';
import { categoryBadgeClass } from '@/lib/categoryColors';
```

Inside the component (after `const isMobile = useIsMobile();` on line 25), add:

```tsx
  const { categories } = useCategories();
```

- [ ] **Step 2: Update the badge rendering**

In the JSX `categories.map(...)` block (around lines 116-129), change the className for the badge from `category.color` to use the helper. Replace:

```tsx
                ${selectedCategory === category.key ? '' : category.color}
```
with:
```tsx
                ${selectedCategory === category.key ? '' : categoryBadgeClass(category.color)}
```

Also change `category.key` → `category.slug` and `category.name` stays. Final mapped JSX:

```tsx
          {categories.map((category) => (
            <Badge
              key={category.slug}
              variant={selectedCategory === category.slug ? "default" : "outline"}
              className={`
                cursor-pointer whitespace-nowrap flex-shrink-0 text-xs h-8 px-3 min-w-fit
                transition-colors duration-200 hover:opacity-80
                ${selectedCategory === category.slug ? '' : categoryBadgeClass(category.color)}
              `}
              onClick={() => scrollToCategory(category.slug)}
            >
              {category.name}
            </Badge>
          ))}
```

- [ ] **Step 3: Verify build and behavior**

Run: `npm run build` → success.

Run dev server → open de drank-pagina op een mobiel viewport (DevTools toggle device toolbar). Expected: filter-bar toont 5 categorieën in volgorde frisdranken / bieren / sterke_dranken / chips / andere. Géén "Mixed Drinks" entry.

**Checkpoint:** mobiel filter gebruikt nu DB-data; mixed_drinks weg uit de bar.

---

### Task 9: Refactor `DrinkGrid` — gebruik `useCategories`, verwijder mixed_drinks

**Files:**
- Modify: `chiro/src/components/DrinkGrid.tsx`

Verwijdert: `getCategoryColor`, `getCategoryName`, `getCategoryOrder` (worden vervangen door hook lookup), de mixed-drink RPC call, en de `item.category === 'mixed_drinks'` branches.

- [ ] **Step 1: Add imports and hook**

Add these imports near the top:

```ts
import { useCategories } from '@/hooks/useCategories';
import { categoryBadgeClass } from '@/lib/categoryColors';
```

Inside the `DrinkGrid` component (after `const [isLogging, setIsLogging] = useState(false);` on line 34), add:

```ts
  const { bySlug } = useCategories();
```

- [ ] **Step 2: Strip mixed_drinks RPC from items query**

In `useQuery({ queryKey: ['items'] ... })` (lines 36-73), replace the entire `queryFn` body with:

```ts
    queryFn: async () => {
      const { data: itemsData, error } = await supabase
        .from('items')
        .select('*')
        .eq('active', true)
        .eq('is_default', true)
        .order('price_cents');
      
      if (error) throw error;

      return (itemsData ?? []).map((item) => ({
        ...item,
        calculated_stock: item.stock_quantity ?? 0,
      })) as Item[];
    },
```

This removes the `Promise.all` over `calculate_mixed_drink_stock` RPC entirely.

- [ ] **Step 3: Replace the three hardcoded helpers**

Delete `getCategoryColor` (lines 123-140), `getCategoryName` (lines 142-159), and `getCategoryOrder` (lines 161-178). Replace with these wrappers (place them where the deleted functions were):

```ts
  const getCategoryName = (slug?: string) =>
    (slug && bySlug.get(slug)?.name) || 'Andere';

  const getCategoryColorClass = (slug?: string) =>
    categoryBadgeClass(slug ? bySlug.get(slug)?.color : null);

  const getCategoryOrder = (slug?: string) =>
    (slug && bySlug.get(slug)?.sort_order) ?? 9999;
```

- [ ] **Step 4: Update the badge usage**

Search for the call site `getCategoryColor(category)` (line 428). Replace with `getCategoryColorClass(category)`.

- [ ] **Step 5: Remove the `item.category === 'mixed_drinks'` branches**

There are two ternary branches that render a `"Beschikbaar"` badge. They are at:
- around lines 391-395 (favorites grid)
- around lines 502-506 (regular grid)

In each, find:
```tsx
                          ) : item.category === 'mixed_drinks' ? (
                            <Badge variant="default" className="text-xs">
                              Beschikbaar
                            </Badge>
                          ) : null}
```
Replace with:
```tsx
                          ) : null}
```

- [ ] **Step 6: Remove `calculated_stock` from `Item` interface**

In the `Item` interface (line 10-20), remove the `calculated_stock?: number;` line. The `useQuery` still adds it for backwards-compat with downstream usage in this file (`item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity`). 

Wait — that pattern is still used multiple times in this file (lines 185, 331-332, 438-439). Simpler: keep the `calculated_stock` field for now since it equals `stock_quantity` after our change, and the existing fallback chain `item.calculated_stock !== undefined ? item.calculated_stock : item.stock_quantity` still resolves to the same value. **Skip removing the field.**

Cancel this step. Leave `calculated_stock` in the interface and the fallback expressions as-is. They're harmless and removing them is unrelated cleanup.

- [ ] **Step 7: Verify build and behavior**

Run: `npm run build` → success.

Run dev server → open drank-pagina als ingelogde user. Expected:
- Categorieën worden getoond in dezelfde volgorde als voorheen (frisdranken eerst, dan bieren, etc.)
- Badge-kleuren zien er identiek uit als voorheen
- Géén "Mixed Drinks" sectie meer
- Een drankje loggen werkt nog steeds (saldo gaat omlaag, stock vermindert)

**Checkpoint:** drank-grid leest categorieën uit DB; mixed_drinks RPC en badges weg uit code.

---

### Task 10: Refactor `ProductManagement` — gebruik `useCategories`, verwijder mixed_drinks UI

**Files:**
- Modify: `chiro/src/components/admin/ProductManagement.tsx`

Grootste refactor. Verwijdert: `MixedDrinkComponent` interface, `selectedComponents` state, `availableComponents` query, `existingComponents` query, `saveMixedDrinkComponents` mutation, `addComponent`/`removeComponent`/`updateComponent` helpers, het hele `useEffect` voor componenten, alle validatie-blokken voor mixed drinks in `handleSubmit`, het `formData.category === 'mixed_drinks'` formulier-blok, en `getCategoryOrder`/`getCategoryColor`/`getCategoryName` helpers (vervangen door hook).

Aanpak: ik doe dit als één grondige edit zodat het bestand consistent blijft.

- [ ] **Step 1: Add imports and hook**

Replace the import block at the top with:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/hooks/useCategories';
import { categoryBadgeClass } from '@/lib/categoryColors';
```

(Removed: `useEffect`, `Upload`, `X`, `Checkbox`.)

- [ ] **Step 2: Remove `MixedDrinkComponent` interface and `getCategoryOrder` function**

Delete the `MixedDrinkComponent` interface (lines 31-36) and the `getCategoryOrder` function (lines 38-48).

- [ ] **Step 3: Remove mixed_drinks state and queries**

Inside `ProductManagement`:
- Remove the `selectedComponents` state (line 56).
- Remove the entire `availableComponents` useQuery block (lines 83-96).
- Remove the entire `existingComponents` useQuery block (lines 99-129).
- Remove the entire `saveMixedDrinkComponents` mutation (lines 251-281).
- Remove the entire `useEffect` for components (lines 313-319).
- Remove the helpers `addComponent`, `removeComponent`, `updateComponent` (lines 322-347).

- [ ] **Step 4: Add `useCategories` hook call**

After `const queryClient = useQueryClient();` (line 52), add:

```tsx
  const { categories, bySlug } = useCategories();
```

- [ ] **Step 5: Strip mixed_drinks logic from `resetForm` and `handleSubmit`**

In `resetForm` (lines 283-296), remove the `setSelectedComponents([]);` line.

In `handleSubmit` (lines 349-429), remove:
- The mixed_drinks validation blocks (lines 352-376).
- The `saveMixedDrinkComponents.mutateAsync` block (lines 401-411 originally, the `if (formData.category === 'mixed_drinks' && selectedComponents.length > 0) { ... }` block).
- The conditional toast description (lines 415-417): replace `description: formData.category === 'mixed_drinks' ? '...' : '...'` with simply `description: 'Het product is succesvol opgeslagen.'`.
- The `queryClient.invalidateQueries({ queryKey: ['available-components'] })` and `['mixed-drink-components']` calls (lines 410-411).

The cleaned-up `handleSubmit` should look like:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemData = {
      name: formData.name,
      price_cents: parseInt(formData.price_cents),
      purchase_price_cents: parseInt(formData.purchase_price_cents),
      description: formData.description || null,
      category: formData.category || null,
      stock_quantity: parseInt(formData.stock_quantity) || 0,
      notify_on_low_stock: formData.notify_on_low_stock,
      active: true,
    };

    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...itemData });
      } else {
        await createItem.mutateAsync(itemData);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-products'] });

      toast({
        title: editingItem ? 'Product bijgewerkt' : 'Product toegevoegd',
        description: 'Het product is succesvol opgeslagen.',
      });

      resetForm();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Fout',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
```

- [ ] **Step 6: Replace `getCategoryColor`, `getCategoryName`, `getCategoryBadge`**

Replace lines 433-477 (the three helpers) with:

```tsx
  const getCategoryName = (slug?: string | null) =>
    (slug && bySlug.get(slug)?.name) || 'Overig';

  const getCategoryBadge = (slug: string | null) => {
    if (!slug) return <Badge variant="outline">Geen categorie</Badge>;
    const cat = bySlug.get(slug);
    return (
      <Badge variant="secondary" className={categoryBadgeClass(cat?.color)}>
        {cat?.name ?? 'Overig'}
      </Badge>
    );
  };
```

(`formatCurrency` stays.)

- [ ] **Step 7: Replace the hardcoded `<Select>` items with DB categories**

Find the category `<Select>` block (lines 522-540). Replace `<SelectContent>` content:

```tsx
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger className="bg-background border z-50">
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg">
                        {categories.map((cat) => (
                          <SelectItem key={cat.slug} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
```

- [ ] **Step 8: Remove the entire mixed_drinks form section**

Find the `{/* Mixed Drinks Componenten Sectie */}` block (lines 601-692, the conditional `formData.category === 'mixed_drinks' &&`) and **delete the whole block** (the comment and the `{...}` JSX expression).

- [ ] **Step 9: Update the products table sort**

In the `<TableBody>` (around line 733), the current sort uses the deleted `getCategoryOrder`. Replace:

```tsx
              {[...items]
                .sort((a, b) => getCategoryOrder(a.category) - getCategoryOrder(b.category))
                .map((item) => (
```

with:

```tsx
              {[...items]
                .sort((a, b) => {
                  const orderA = (a.category && bySlug.get(a.category)?.sort_order) ?? 9999;
                  const orderB = (b.category && bySlug.get(b.category)?.sort_order) ?? 9999;
                  return orderA - orderB;
                })
                .map((item) => (
```

- [ ] **Step 10: Verify build and behavior**

Run: `npm run build` → success.

Run dev server → ga naar admin → Voorraad tab → Product beheer:
- Producten lijst toont, gesorteerd op categorie volgorde.
- Klik "Product toevoegen" → categorie-dropdown toont 5 opties (geen "Mixed Drinks").
- Voeg een test-product toe met categorie "Frisdranken". Expected: succesvolle toast, product verschijnt in lijst.
- Bewerk dat product → wijzig categorie naar "Andere" → save. Expected: badge wordt grijs, product schuift onderaan.
- Verwijder het test-product. Expected: weg.

**Checkpoint:** ProductManagement bevat geen mixed_drinks code meer; dropdown gevoed vanuit DB.

---

### Task 11: Drop mixed_drinks DB infrastructure (Migration 2)

**Files:**
- Create: `chiro/supabase/migrations/20260427090100_drop_mixed_drinks.sql`

Pre-flight check + trigger rewrite + drop tabel + drop RPCs. Niets wordt stilzwijgend kapot gemaakt.

- [ ] **Step 1: Write the migration**

```sql
BEGIN;

-- Pre-flight: weiger te draaien als er nog mixed_drinks-data is
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.items WHERE category = 'mixed_drinks') THEN
    RAISE EXCEPTION 'Items met category=mixed_drinks bestaan nog, migratie afgebroken';
  END IF;
  IF EXISTS (SELECT 1 FROM public.mixed_drink_components LIMIT 1) THEN
    RAISE EXCEPTION 'mixed_drink_components bevat nog rijen, migratie afgebroken';
  END IF;
END $$;

-- Herschrijf handle_consumption_stock zonder mixed_drinks-branch
CREATE OR REPLACE FUNCTION public.handle_consumption_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_stock integer;
  transaction_created_by uuid;
  user_balance integer;
  user_is_guest boolean;
  user_allow_credit boolean;
BEGIN
  SELECT
    COALESCE(guest_account, false),
    COALESCE(allow_credit, false)
  INTO user_is_guest, user_allow_credit
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF NOT user_is_guest AND NOT user_allow_credit THEN
    SELECT public.calculate_user_balance(NEW.user_id) INTO user_balance;
    IF user_balance < NEW.price_cents THEN
      RAISE EXCEPTION 'Onvoldoende saldo';
    END IF;
  END IF;

  SELECT COALESCE(stock_quantity, 0)
  INTO current_stock
  FROM public.items WHERE id = NEW.item_id;

  IF user_is_guest THEN
    transaction_created_by := NULL;
  ELSE
    transaction_created_by := NEW.user_id;
  END IF;

  IF current_stock <= 0 THEN
    RAISE EXCEPTION 'Onvoldoende voorraad';
  END IF;

  UPDATE public.items
  SET stock_quantity = COALESCE(stock_quantity, 0) - 1
  WHERE id = NEW.item_id;

  INSERT INTO public.stock_transactions (item_id, quantity_change, transaction_type, notes, created_by)
  VALUES (NEW.item_id, -1, 'sale', 'Automatic stock decrease from consumption', transaction_created_by);

  RETURN NEW;
END;
$$;

-- Drop RPC functies die niet meer gebruikt worden
DROP FUNCTION IF EXISTS public.calculate_mixed_drink_stock(uuid);
DROP FUNCTION IF EXISTS public.calculate_mixed_drink_prices(uuid);

-- Drop de tabel (FK's met ON DELETE CASCADE op items, dus geen orphans)
DROP TABLE public.mixed_drink_components;

COMMIT;
```

- [ ] **Step 2: Apply the migration**

Run via Supabase Dashboard SQL editor.

Expected: success. If de pre-flight RAISE-EXCEPTION afgaat, betekent dat er nog mixed_drinks-data in de DB staat — STOP, los dat eerst op (verwijder die rijen handmatig of verplaats ze) en run dan opnieuw.

- [ ] **Step 3: Verify in DB**

```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mixed_drink_components');
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calculate_mixed_drink_stock');
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calculate_mixed_drink_prices');
```
Expected: alle drie `false`.

- [ ] **Step 4: Update types.ts**

Open `src/integrations/supabase/types.ts`. Find the `mixed_drink_components` block (around lines 247-289 in the current file, the entry under `public.Tables`) and **delete the whole entry** (Row, Insert, Update, Relationships, closing `}`).

Find the `Functions:` block (search for `Functions:` in the file). Inside, delete the `calculate_mixed_drink_stock` and `calculate_mixed_drink_prices` entries.

- [ ] **Step 5: Verify build and behavior**

Run: `npm run build` → success (no TypeScript errors referencing removed types).

Run dev server. Open drank-pagina als gewone user → log één drankje. Expected: saldo gaat omlaag, stock van het product gaat met 1 omlaag, geen errors in console of toast.

**Checkpoint:** mixed_drinks DB-infrastructuur volledig weg; consumptie-trigger werkt nog correct voor losse drankjes.

---

### Task 12: Convert `items.category` to FK and drop the enum (Migration 3)

**Files:**
- Create: `chiro/supabase/migrations/20260427090200_items_category_fk.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply the migration**

Run via Supabase Dashboard SQL editor.

If de FK-creatie faalt met "violates foreign key constraint" → er is een item met een `category`-waarde die niet in `categories.slug` voorkomt (bv. een typo of een oude waarde). Query om te onderzoeken:
```sql
SELECT DISTINCT category FROM items WHERE category IS NOT NULL
EXCEPT
SELECT slug FROM categories;
```
Voor elke onbekende waarde: óf de categorie in de `categories`-tabel toevoegen, óf het item updaten naar een bestaande slug.

- [ ] **Step 3: Verify in DB**

```sql
-- FK bestaat
SELECT conname FROM pg_constraint WHERE conname = 'items_category_fkey';
-- Type van de kolom is text
SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='category';
-- Enum is gedropt
SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname='drink_category');
```
Expected: FK bestaat, type is `text`, enum-bestaat is `false`.

- [ ] **Step 4: Update types.ts**

Open `src/integrations/supabase/types.ts`:

1. In het `items` Row/Insert/Update blok (rond regels 185-235), vervang alle drie de `category: Database["public"]["Enums"]["drink_category"] | null` met `category: string | null` (en `category?:` waar relevant).

2. In de `Relationships` array van `items` (rond regel 237-245), voeg een entry toe voor de nieuwe FK:
```ts
          {
            foreignKeyName: "items_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
```

3. Find the `Enums:` block (search `Enums:`) and delete the `drink_category` entry (both the type alias and the runtime array if present, around lines 783-789 and 921-928).

- [ ] **Step 5: Verify build and full smoke test**

Run: `npm run build` → success.

Run dev server. Volledige rondrit:
1. **Drank-pagina (logged in user):** alle producten verschijnen, in dezelfde volgorde, dezelfde badge-kleuren.
2. **Mobiel filter-bar:** 5 categorieën zichtbaar, géén "Mixed Drinks".
3. **Drankje loggen:** saldo gaat omlaag, stock vermindert.
4. **Admin → Categorieën tab:** 5 rijen, `andere` heeft slot.
5. **Hernoem "Frisdranken" → "Soft drinks":** drank-pagina verandert direct (na refresh). Items zitten nog onder dezelfde groep.
6. **Maak nieuwe categorie "Snacks" met sort_order 50:** verschijnt in admin tabel én in product-form dropdown.
7. **Voeg een product toe met categorie "Snacks":** verschijnt onder "Snacks" sectie op drank-pagina (tussen chips=4 en andere=100).
8. **Probeer "Snacks" te verwijderen:** geblokkeerd met toast (1 product erin).
9. **Verplaats het Snacks-product naar "Andere":** product zit nu onder Andere. "Snacks" heeft 0 producten.
10. **Verwijder "Snacks":** lukt; verdwijnt uit alle lijsten.

**Checkpoint:** volledige feature werkt; data-integriteit afgedwongen door DB FK.

---

### Task 13: LateFeeDialog en eventuele restjes

**Files:**
- Verify: `chiro/src/components/LateFeeDialog.tsx`

LateFeeDialog gebruikt hardcoded `category: 'andere'` (line 89). Dat is een geldige slug (in de seed) dus het blijft werken — maar laten we dat verifiëren, en zorgen dat het niet kapot gaat als ooit iemand "andere" hernoemt. Geen wijziging nodig: rename CASCADE't via FK, slug blijft `andere`.

- [ ] **Step 1: Open LateFeeDialog.tsx en verifieer**

Open `src/components/LateFeeDialog.tsx`. Zoek `category: 'andere'`. Bevestig: dit slaat een `items`-rij op met `category='andere'`. Werkt prima omdat de FK nog steeds verwijst naar de slug `andere` (die `is_protected=true` is en dus niet verwijderd kan worden).

Geen edits.

- [ ] **Step 2: Search for any remaining `mixed_drinks` references**

Grep across `src/`:
```bash
grep -r "mixed_drinks\|mixed_drink_components\|MixedDrink\|drink_category" chiro/src/
```
Expected: geen matches. Indien er toch nog iets staat (bv. een type-import) → verwijder/aanpassen.

Ook in supabase functions:
```bash
grep -r "mixed_drinks\|mixed_drink_components" chiro/supabase/functions/
```
Expected: geen matches.

- [ ] **Step 3: Final lint and build**

Run: `npm run lint`
Expected: geen errors gerelateerd aan deze feature (bestaande warnings mogen blijven).

Run: `npm run build`
Expected: success.

**Checkpoint:** geen achterblijvende `mixed_drinks`-referenties; project compileert en lint passed.

---

## Self-Review

Spec-coverage check:
- ✅ Categorieën-tabel met slug/name/color/sort_order/is_protected → Task 1
- ✅ Seed van 5 bestaande categorieën → Task 1
- ✅ RLS (lezen door iedereen, schrijven door admins) → Task 1
- ✅ Tailwind safelist → Task 2
- ✅ categoryColors helper → Task 3
- ✅ types.ts updates → Tasks 4, 11, 12
- ✅ useCategories hook → Task 5
- ✅ CategoryManagement component (CRUD + protected delete + form) → Task 6
- ✅ Categorieën-tab in AdminDashboard → Task 7
- ✅ MobileCategoryFilter refactor → Task 8
- ✅ DrinkGrid refactor + RPC verwijderen → Task 9
- ✅ ProductManagement refactor + mixed_drinks UI weg → Task 10
- ✅ Pre-flight, trigger rewrite, drop table, drop RPCs → Task 11
- ✅ Items.category als FK + enum drop → Task 12
- ✅ Verification stappen na elke task
- ✅ LateFeeDialog blijft werken → Task 13

Geen placeholders, geen TBD's, alle code-blokken bevatten de daadwerkelijke code. Type-namen consistent (`Category`, `CategoryColorKey`, `useCategories`, `bySlug`, `categoryBadgeClass`, etc.).
