# SaaS Block 1 — Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork the Chirobar PWA to a new `baraccount/` repo, transform it into a multi-tenant SaaS that serves multiple organizations via subdomain routing (`<slug>.baraccount.com`), with self-serve signup and member-invites.

**Architecture:** Single Supabase project, schema-based multi-tenancy via `organization_id` columns + RLS isolation. Org-resolution via custom JWT claim (`app_metadata.organization_id`). One React SPA on Cloudflare Pages serving both root domain (marketing) and wildcard subdomains (app). Atomic signup/invite flows via Supabase Edge Functions. Strict 1 user = 1 org for Block 1.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query v5, shadcn/ui (Radix), Tailwind v3, Supabase (PostgreSQL + RLS + Auth + Edge Functions Deno), Cloudflare Pages + DNS.

**Spec:** [chiro/docs/superpowers/specs/2026-04-27-saas-block-1-multi-tenancy-design.md](../specs/2026-04-27-saas-block-1-multi-tenancy-design.md)

---

## Pre-execution checklist (USER must do these before Task A1)

- [ ] **Pick product name + register domain.** This plan uses `baraccount` and `baraccount.com` as placeholders. If you choose a different name, do a global find-replace on this plan AND on the spec document before starting. Buy your domain via any registrar (Namecheap, Cloudflare Registrar, etc.) — Cloudflare Registrar is recommended since you'll use Cloudflare DNS anyway.
- [ ] **Sign up for Cloudflare account** (free) and **add your domain to Cloudflare DNS**.
- [ ] **Sign up for new Supabase account or new Supabase project** (free tier) — region: `eu-west-1` (Ireland) for GDPR future-proofing.
- [ ] Confirm working directory exists: `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\` will be created in Task A1; its parent `rep-baraccount\` doesn't need to exist yet.

---

## Project notes

- **Source repo (read-only reference):** `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-chirobar\chiro\` — this is the live Chirobar PWA. **Do NOT modify it during this plan.** It's only referenced for understanding the codebase being forked.
- **Destination repo (you create + work in):** `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\` — the new multi-tenant SaaS.
- **Repo will be initialized as git in Task A1.5.** Use git for version control going forward (commits per task).
- **No test framework** — this is unchanged from the source repo. Verification is `npm run build` + manual browser testing via the dev server.
- **Working name:** `baraccount` (lowercase, used in package.json, branding placeholders, etc.). `baraccount` (capitalized) for display. Domain: `baraccount.com`. Replace globally if you renamed.
- **Subagent execution:** Each task in the Edge Function and Frontend phases should be done by a separate subagent dispatch. Database tasks (B1-B5) require user action between them (apply migration in Supabase Dashboard). Setup tasks (A1-A5) are mostly user actions with implementer support.

---

## File Structure (after Block 1)

**New top-level directory:** `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\`

**Major new/changed files relative to fork-source:**

```
baraccount/
├── .env.local                                     # NEW: Supabase URL + anon key for new project
├── package.json                                   # MODIFIED: name "vite_react_shadcn_ts" → "baraccount"
├── README.md                                      # MODIFIED: SaaS description
├── vite.config.ts                                 # MODIFIED: remove lovable-tagger, allow *.localhost
├── tailwind.config.ts                             # MODIFIED: primary color → blue-600 default
├── src/
│   ├── index.css                                  # MODIFIED: HSL primary var → blue
│   ├── App.tsx                                    # MODIFIED: hostname-based routing
│   ├── main.tsx                                   # MODIFIED: wrap in OrgProvider
│   ├── contexts/
│   │   └── OrgContext.tsx                         # NEW: org state + useOrg hook
│   ├── hooks/
│   │   ├── useOrg.ts                              # NEW: convenience re-export
│   │   └── useAuth.ts                             # MODIFIED: post-login org-validation
│   ├── lib/
│   │   ├── hostname.ts                            # NEW: parseSubdomain helper
│   │   └── reservedSlugs.ts                       # NEW: shared with Edge Function
│   ├── pages/
│   │   ├── marketing/
│   │   │   ├── Landing.tsx                        # NEW: marketing root page
│   │   │   ├── Signup.tsx                         # NEW: signup form
│   │   │   ├── FindOrg.tsx                        # NEW: "find your organization" widget
│   │   │   └── OrgNotFound.tsx                    # NEW: shown for invalid subdomain
│   │   ├── AcceptInvite.tsx                       # NEW
│   │   └── Auth.tsx                               # MODIFIED: org-branded header + post-login validation
│   ├── components/
│   │   └── admin/
│   │       └── MemberManagement.tsx               # NEW: invite form + outstanding-invites table
│   └── integrations/
│       └── supabase/
│           ├── client.ts                          # MODIFIED: read env from .env.local
│           └── types.ts                           # REGENERATED: includes organizations + invitations + new categories shape
├── supabase/
│   ├── migrations/
│   │   ├── (existing chiro migrations, with seed-INSERTs removed)
│   │   ├── 20260428100000_organizations_and_invitations.sql      # NEW
│   │   ├── 20260428100100_organization_id_columns.sql            # NEW
│   │   ├── 20260428100200_categories_uuid_pk_refactor.sql        # NEW
│   │   ├── 20260428100300_rls_org_isolation.sql                  # NEW
│   │   └── 20260428100400_organization_id_not_null.sql           # NEW
│   └── functions/
│       ├── check-slug-availability/
│       │   ├── index.ts                           # NEW
│       │   └── deno.json                          # NEW
│       ├── signup-organization/
│       │   └── index.ts                           # NEW
│       └── accept-invite/
│           └── index.ts                           # NEW
└── public/
    └── (lovable-uploads/ removed; placeholder logo SVG added)
```

---

# Phase A — Setup

## Task A1: Fork chiro/ → baraccount/

**Files:**
- Create: directory `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\` (full copy of chiro/)

**This is mostly a shell/file-copy task. Skip node_modules and dist (they'll be regenerated).**

- [ ] **Step 1: Create destination directory and copy source**

Open a Bash shell. Run:

```bash
mkdir -p "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount"
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount"

# Copy the entire chiro/ directory excluding heavy/derived dirs
rsync -av --exclude='node_modules' --exclude='dist' --exclude='backups' --exclude='.git' \
  "/c/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-chirobar/chiro/" \
  "./baraccount/"
```

If `rsync` is not available on Windows, use PowerShell:

```powershell
$src = "c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-chirobar\chiro"
$dst = "c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Get-ChildItem -Path $src -Force | Where-Object { $_.Name -notin @('node_modules','dist','backups','.git') } | Copy-Item -Destination $dst -Recurse -Force
```

- [ ] **Step 2: Verify the copy**

```bash
ls -la "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount/"
```
Expected: see `package.json`, `src/`, `supabase/`, `public/`, `vite.config.ts`, etc. NO `node_modules/`, NO `dist/`.

- [ ] **Step 3: Install dependencies in the new repo**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm install
```
Expected: completes without errors. (You'll get the same dependencies as chiro/, including the now-soon-to-be-removed `lovable-tagger`.)

- [ ] **Step 4: Verify build works on a clean fork**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```
Expected: build succeeds. The forked app is identical to Chiro at this point (same Supabase env from `.env.local` if it exists — that's fine, we'll change it in Task A4).

**Checkpoint:** Forked repo exists, builds cleanly.

---

## Task A1.5: Initialize git in the new repo

**Files:**
- Create: `.gitignore` (already exists from fork — verify), `.git/` (init)

- [ ] **Step 1: Initialize git**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && git init && git branch -M main
```

- [ ] **Step 2: Verify .gitignore is appropriate**

Check that `.gitignore` (copied from chiro/) excludes `node_modules`, `dist`, `.env.local`, `.env`. If not, add them:

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
cat .gitignore
```

If `.env.local` is missing, add it:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 3: First commit**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git add -A
git commit -m "Initial commit: forked from chiro/ at $(date -I)"
```

**Checkpoint:** Git initialized, baseline commit exists.

---

## Task A2: Strip Chiro-specific branding from forked code

**Files:**
- Delete: `baraccount/public/lovable-uploads/` (entire directory)
- Modify: `baraccount/vite.config.ts` (remove lovable-tagger plugin)
- Modify: `baraccount/package.json` (remove lovable-tagger dep, rename project)
- Modify: `baraccount/src/index.css` (primary color → blue)
- Modify: `baraccount/tailwind.config.ts` (color tokens)
- Modify: `baraccount/README.md` (replace Chiro description)
- Create: `baraccount/public/logo-placeholder.svg` (generic "B" letter logo)

- [ ] **Step 1: Delete Chiro logo uploads**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
rm -rf public/lovable-uploads
```

- [ ] **Step 2: Create placeholder SVG logo**

Create file `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\public\logo-placeholder.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="#2563eb"/>
  <text x="50%" y="50%" font-family="system-ui, sans-serif" font-size="36" font-weight="700"
        fill="white" text-anchor="middle" dominant-baseline="central">B</text>
</svg>
```

- [ ] **Step 3: Remove lovable-tagger from vite.config.ts**

Read `baraccount/vite.config.ts`. Find the `lovable-tagger` import and any uses in `plugins: [...]`. Remove both.

The cleaned file should look like (adapt to the actual current content — the chiro version may have additional plugins):

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 8080,
    allowedHosts: ['.localhost'],
  },
});
```

(Note: `allowedHosts: ['.localhost']` is added now to support `*.localhost` subdomains in dev — needed for Phase D.)

- [ ] **Step 4: Remove lovable-tagger from package.json**

Edit `baraccount/package.json`:
- Change `"name"` from `"vite_react_shadcn_ts"` to `"baraccount"`
- Find `"lovable-tagger": "..."` in `devDependencies` and remove the entire line
- Save

Run:
```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm install
```
Expected: re-installs without lovable-tagger.

- [ ] **Step 5: Replace primary color in src/index.css**

Read `baraccount/src/index.css`. Find the `--primary` HSL CSS variable. The chiro value is something like `0 79% 65%` (which is the pinkish-red `#e94560`).

Replace with blue-600 in HSL: `217 91% 60%`

Example block (your actual file may differ slightly — preserve surrounding context):

```css
:root {
  /* ... other vars ... */
  --primary: 217 91% 60%;            /* was 0 79% 65% */
  --primary-foreground: 0 0% 100%;
  /* ... */
}

.dark {
  /* ... */
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
}
```

Apply the same change in BOTH `:root` and `.dark` blocks.

- [ ] **Step 6: Replace README.md**

Overwrite `baraccount/README.md` with:

```markdown
# baraccount

Multi-tenant SaaS for managing internal bar tabs, drink logging, and stock for organizations like youth movements, sports clubs, and small companies.

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui
- TanStack React Query v5
- Supabase (PostgreSQL + Auth + Edge Functions, EU region)
- Cloudflare Pages + DNS (wildcard subdomains)

## Development

```bash
npm install
npm run dev    # serves on http://localhost:8080 (and *.localhost:8080 for subdomain testing)
npm run build  # production build
npm run lint
```

For multi-tenant testing in dev, visit `http://test-org.localhost:8080` after creating an org via signup.

## Architecture

See `docs/superpowers/specs/` for design documents.

Key architectural decisions:
- Single Supabase project, RLS-based org isolation
- One React SPA serves both `baraccount.com` (marketing) and `*.baraccount.com` (per-org app)
- Org-context derived from JWT custom claim (`app_metadata.organization_id`)
- Strict 1 user = 1 org membership

## Deployment

Cloudflare Pages, single project with custom domains `baraccount.com` + `*.baraccount.com`.
```

- [ ] **Step 7: Verify build still works**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```
Expected: success. The app still references chiro logos in code (that's fine — Task D7 strips those references).

- [ ] **Step 8: Commit**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git add -A
git commit -m "Strip Chiro branding: remove logos, lovable-tagger, switch primary color to blue"
```

**Checkpoint:** Branding stripped at the build-config layer. Code-level references still need stripping (Task D7).

---

## Task A3: Strip seed-INSERTs from existing migrations

**Files:**
- Modify: `baraccount/supabase/migrations/20250825162029_0a338f0c-7343-4e1b-9fea-b4e8ac776069.sql` (remove seed INSERT)
- Modify: `baraccount/supabase/migrations/20260427090000_create_categories_table.sql` (remove categories seed)

These migrations contain hardcoded chiro-specific seed data. New orgs will get default products/categories via the `signup-organization` Edge Function instead.

- [ ] **Step 1: Strip items seed from migration 20250825162029**

Read `baraccount/supabase/migrations/20250825162029_0a338f0c-7343-4e1b-9fea-b4e8ac776069.sql`. Find this block (around lines 60-68):

```sql
-- Insert default drink categories with correct pricing
INSERT INTO public.items (name, price_cents, category, active, is_default, description) VALUES
('Frisdrank', 75, 'frisdrank_pils_chips', true, true, 'Cola, Fanta, Sprite, Water'),
('Pils', 75, 'frisdrank_pils_chips', true, true, 'Jupiler, Stella Artois'),
('Chips', 75, 'frisdrank_pils_chips', true, true, 'Diverse chips smaken'),
('Red Bull', 125, 'energy_kriek', true, true, 'Energy drink'),
('Kriek', 125, 'energy_kriek', true, true, 'Kriekenbier'),
('Mixed Drink', 300, 'mixed_drink', true, true, 'Cocktails en mixed drinks')
ON CONFLICT DO NOTHING;
```

Delete the entire block (the comment line + INSERT statement). Note: this migration also creates the `drink_category` enum that we'll later replace anyway, but for now leave the rest of the migration intact — it'll execute against a fresh DB and the dynamic-categories migration sequence will refactor it.

- [ ] **Step 2: Strip categories seed from migration 20260427090000**

Read `baraccount/supabase/migrations/20260427090000_create_categories_table.sql`. Find this block:

```sql
INSERT INTO public.categories (slug, name, color, sort_order, is_protected) VALUES
  ('frisdranken',    'Frisdranken',    'blue',   1,   false),
  ('bieren',         'Bieren',         'amber',  2,   false),
  ('sterke_dranken', 'Sterke dranken', 'red',    3,   false),
  ('chips',          'Chips',          'yellow', 4,   false),
  ('andere',         'Andere',         'gray',   100, true);
```

Delete the entire INSERT statement (5 lines + closing `;`). Keep everything else (table create + RLS policies).

- [ ] **Step 3: Verify the migrations still parse as valid SQL**

Open both files in a text editor or visually inspect via Read. Confirm there are no orphaned commas, no broken syntax around where INSERTs were removed.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git add -A
git commit -m "Remove chiro-specific seed data from migrations (will be per-org via Edge Function)"
```

**Checkpoint:** Migrations are now generic, no chiro-specific data baked in.

---

## Task A4: Configure new Supabase project + .env.local

**Files:**
- Create: `baraccount/.env.local`
- Modify: `baraccount/src/integrations/supabase/client.ts` (verify it reads from env)

This task requires user action: provision the Supabase project and copy credentials. The agent then configures the local files.

- [ ] **Step 1 (USER ACTION): Provision Supabase project**

In your browser:
1. Go to https://supabase.com/dashboard
2. Create new project → name "baraccount", region "West EU (Ireland)", strong DB password
3. Wait for provisioning (~2 min)
4. Project Settings → API → copy the **Project URL** and **anon public key**

- [ ] **Step 2: Create `.env.local` with new credentials**

Create file `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ... (paste anon public key here)
```

Replace placeholders with actual values from Step 1.

- [ ] **Step 3: Verify Supabase client reads from env**

Read `baraccount/src/integrations/supabase/client.ts`. The chiro version may have hardcoded URLs (the file says "auto-generated" in CLAUDE.md). If hardcoded, replace with:

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- [ ] **Step 4: Verify build still works**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```
Expected: success.

- [ ] **Step 5 (USER ACTION): Apply existing chiro migrations to new Supabase project**

Open Supabase Dashboard SQL editor for the new project. Run each migration in `baraccount/supabase/migrations/` in chronological order (sorted by filename timestamp).

Alternative if you have Supabase CLI installed: `cd baraccount && supabase db push --db-url "postgresql://..."`.

After all chiro migrations are applied, the database has the same schema as Chiro currently has, MINUS the seed data. Tables exist, RLS policies in their old single-tenant form, but everything is empty.

- [ ] **Step 6: Verify**

In Supabase SQL editor:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```
Expected: see `items`, `consumptions`, `profiles`, `categories`, `restock_sessions`, etc. NOT `mixed_drink_components` (was dropped by chiro's migration 2).

Also verify NO seed data:
```sql
SELECT count(*) FROM items;       -- expect 0
SELECT count(*) FROM categories;  -- expect 0
```

- [ ] **Step 7: Commit `.env.local` config (the file itself is gitignored, but the supabase/client.ts changes are not)**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git add src/integrations/supabase/client.ts
git commit -m "Configure Supabase client to read URL/key from env vars"
```

**Checkpoint:** New Supabase project is provisioned + has chiro schema (no data).

---

## Task A5 (USER ACTION): Setup Cloudflare Pages + DNS

This is purely infra setup the user does in browser dashboards. No code changes.

- [ ] **Step 1: Setup Cloudflare DNS for your domain**

In Cloudflare dashboard → your domain → DNS:
- Add `A` record for `@` (root) pointing to `192.0.2.1` (placeholder; will be replaced when Cloudflare Pages connects)
- Add `CNAME` record for `*` (wildcard) pointing to `baraccount.pages.dev` (or whatever Pages assigns later)

Or skip these and let Cloudflare Pages add them automatically when you add the custom domains in Step 3.

- [ ] **Step 2: Push your local repo to GitHub**

Cloudflare Pages connects to a git host. Create a private GitHub repo `baraccount` under your account, then:

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git remote add origin https://github.com/YOUR_USERNAME/baraccount.git
git push -u origin main
```

- [ ] **Step 3: Create Cloudflare Pages project**

In Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git:
- Select your `baraccount` GitHub repo
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables (add for both Production and Preview):
  - `VITE_SUPABASE_URL` = your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

Save & deploy. First deployment takes ~2 min.

- [ ] **Step 4: Add custom domains to the Pages project**

In Pages project → Custom domains → Add custom domain:
- Add `baraccount.com`
- Add `*.baraccount.com` (wildcard)

Cloudflare prompts you to add/verify DNS records. Follow its instructions (usually click "Add DNS records automatically").

Wildcard SSL provisioning takes a few minutes to a few hours. You'll get an email when it's ready.

- [ ] **Step 5: Verify production deployment is live**

In browser: visit `https://baraccount.com` → should load the still-Chiro-themed app (we strip the rest in Phase D).

Also try `https://test.baraccount.com` (any random subdomain) → should ALSO load the same app (since we have wildcard). The app will currently redirect to login or show empty state — that's fine, multi-tenancy isn't built yet.

**Checkpoint:** Production deployment works on both root and wildcard subdomains. Phase A is done.

---

# Phase B — Database Migrations

These migrations are written and applied one-by-one. After writing each, the user applies it via Supabase Dashboard SQL editor before moving to the next.

## Task B1: Migration — `organizations` + `invitations` tables

**Files:**
- Create: `baraccount/supabase/migrations/20260428100000_organizations_and_invitations.sql`

- [ ] **Step 1: Write the migration**

Create file with exact content:

```sql
BEGIN;

-- organizations: one row per tenant
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE
    CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$')
    CHECK (slug NOT IN (
      'www','app','api','admin','mail','support','docs','blog','status','static','assets',
      'auth','login','signup','dashboard','help'
    )),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug) WHERE active = true;

-- invitations: pending member invites
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.user_role NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','cancelled','expired')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_org_status ON public.invitations(organization_id, status);
CREATE INDEX idx_invitations_token ON public.invitations(token);

-- Enable RLS but DON'T add org-isolation policies yet (we don't have the
-- current_organization_id() helper or the organization_id columns on profiles
-- until later migrations). We'll add proper policies in 20260428100300.
-- For now: only service_role can access.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

COMMIT;
```

- [ ] **Step 2 (USER ACTION): Apply the migration**

Copy the file's content, paste in Supabase Dashboard SQL editor, run.

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('organizations','invitations');
```
Expected: 2 rows.

- [ ] **Step 4: Commit**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git add supabase/migrations/20260428100000_organizations_and_invitations.sql
git commit -m "Migration: organizations + invitations tables"
```

**Checkpoint:** Tenant + invite tables exist.

---

## Task B2: Migration — Add `organization_id` to all org-scoped tables (nullable)

**Files:**
- Create: `baraccount/supabase/migrations/20260428100100_organization_id_columns.sql`

We add the column nullable initially because we'll add NOT NULL in B5 after RLS is set up. On a fresh DB with no data this is a formality, but if Chiro ever migrates we want this pattern proven.

- [ ] **Step 1: Write the migration**

Create file with:

```sql
BEGIN;

-- Add organization_id to all org-scoped tables (nullable for now)
ALTER TABLE public.profiles            ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.items               ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.consumptions        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.top_ups             ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.adjustments         ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.categories          ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.restock_sessions    ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.restock_items       ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_transactions  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_audits        ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_audit_items   ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.user_favorites      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.audit_logs          ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.events              ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.guest_sessions      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Conditionally add to notifications IF that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT';
  END IF;
END $$;

-- Add lookup indexes on organization_id for query perf
CREATE INDEX idx_profiles_org           ON public.profiles(organization_id);
CREATE INDEX idx_items_org              ON public.items(organization_id);
CREATE INDEX idx_consumptions_org       ON public.consumptions(organization_id);
CREATE INDEX idx_top_ups_org            ON public.top_ups(organization_id);
CREATE INDEX idx_adjustments_org        ON public.adjustments(organization_id);
CREATE INDEX idx_categories_org         ON public.categories(organization_id);
CREATE INDEX idx_restock_sessions_org   ON public.restock_sessions(organization_id);
CREATE INDEX idx_restock_items_org      ON public.restock_items(organization_id);
CREATE INDEX idx_stock_transactions_org ON public.stock_transactions(organization_id);
CREATE INDEX idx_stock_audits_org       ON public.stock_audits(organization_id);
CREATE INDEX idx_stock_audit_items_org  ON public.stock_audit_items(organization_id);
CREATE INDEX idx_user_favorites_org     ON public.user_favorites(organization_id);
CREATE INDEX idx_events_org             ON public.events(organization_id);
CREATE INDEX idx_guest_sessions_org     ON public.guest_sessions(organization_id);

COMMIT;
```

- [ ] **Step 2 (USER ACTION): Apply migration in Supabase Dashboard**

If you get an error like `relation "public.events" does not exist`, that table wasn't created in any earlier migration. Comment out that line and re-run, then create a follow-up note. (It's possible some tables differ between chiro's evolved state and what's in the migrations folder.)

- [ ] **Step 3: Verify**

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='organization_id'
ORDER BY table_name;
```
Expected: list of 14-15 tables (depending on `notifications` existence).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100100_organization_id_columns.sql
git commit -m "Migration: add organization_id columns to all org-scoped tables"
```

**Checkpoint:** All org-scoped tables have nullable `organization_id`.

---

## Task B3: Migration — Categories UUID PK refactor + items.category → items.category_id

**Files:**
- Create: `baraccount/supabase/migrations/20260428100200_categories_uuid_pk_refactor.sql`

Refactor `categories` from slug-PK to UUID-PK. `items.category` becomes `items.category_id` (UUID FK to `categories.id`). Slug uniqueness is now per-org.

- [ ] **Step 1: Write the migration**

Create file with:

```sql
BEGIN;

-- 1. Drop the existing FK from items.category → categories.slug
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_category_fkey;

-- 2. Add new id UUID PK to categories
-- Existing categories table has slug as PK. We need to:
--   a) drop the PK constraint on slug
--   b) add new id column as PK
--   c) keep slug as a regular column (for org-scoped uniqueness later)

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE public.categories ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.categories ADD PRIMARY KEY (id);

-- 3. Drop the global UNIQUE on slug; add per-org unique constraint instead
-- (slug was implicitly UNIQUE because it was PK; now we need explicit per-org constraint)
ALTER TABLE public.categories
  ADD CONSTRAINT categories_org_slug_unique UNIQUE (organization_id, slug);

-- 4. Rename items.category to items.category_id and change type to uuid
-- Items.category was a text FK to categories.slug. We need to drop the column entirely
-- (since we just dropped the FK in step 1) and add the new uuid column.
-- On a fresh DB with no items, no data preservation needed.
ALTER TABLE public.items DROP COLUMN category;
ALTER TABLE public.items ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT;

CREATE INDEX idx_items_category ON public.items(category_id);

COMMIT;
```

**Important note:** This migration assumes items.category was a `text` column (post-categories-refactor) and `categories.slug` was a `text` PK. If your fresh DB went through the chiro migrations including the dynamic-categories ones (20260427090000 through 20260427090300), this is the case. If somehow the order is different, adjust accordingly.

- [ ] **Step 2 (USER ACTION): Apply migration**

If the migration fails with "column does not exist" errors, the chiro migration sequence may not have produced the expected state. Check current schema with:
```sql
\d public.categories
\d public.items
```
And adjust the migration to match reality before re-running.

- [ ] **Step 3: Verify**

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='items' AND column_name LIKE 'category%';
-- Expected: category_id | uuid

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='categories' AND column_name='id';
-- Expected: id | uuid

-- Check unique constraint exists
SELECT conname FROM pg_constraint WHERE conname='categories_org_slug_unique';
-- Expected: 1 row
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100200_categories_uuid_pk_refactor.sql
git commit -m "Migration: categories UUID PK + per-org slug uniqueness"
```

**Checkpoint:** Categories shape is multi-tenant ready.

---

## Task B4: Migration — RLS helper + policies for org isolation

**Files:**
- Create: `baraccount/supabase/migrations/20260428100300_rls_org_isolation.sql`

Adds the `current_organization_id()` Postgres function and rewrites all RLS policies on org-scoped tables to enforce isolation by JWT claim.

- [ ] **Step 1: Write the migration**

Create file with:

```sql
BEGIN;

-- 1. Helper function to read current org from JWT claim
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json #>> '{app_metadata,organization_id}',
    ''
  )::uuid;
$$;

-- 2. organizations RLS: anyone can SELECT (needed for org-resolution before login)
-- Admins of an org can UPDATE their org. No one can INSERT/DELETE via REST
-- (signup-organization and account-deletion go through service-role Edge Functions).

DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;
CREATE POLICY "Anyone can view organizations"
ON public.organizations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can update their org" ON public.organizations;
CREATE POLICY "Admins can update their org"
ON public.organizations FOR UPDATE
USING (
  id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND organization_id = public.current_organization_id()
  )
);

-- 3. invitations RLS: only admins of the org can read/insert/update/delete.
-- Token-based lookups (anonymous accept-invite) go via service-role Edge Function.

DROP POLICY IF EXISTS "Admins manage invitations" ON public.invitations;
CREATE POLICY "Admins manage invitations"
ON public.invitations FOR ALL
USING (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND organization_id = public.current_organization_id()
  )
);

-- 4. profiles: members can read all profiles in their org. Admins can update them.
-- Users can update their own profile.

-- Drop ALL existing profile policies first (chiro had several, varying)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Members view org profiles"
ON public.profiles FOR SELECT
USING (organization_id = public.current_organization_id());

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid() AND organization_id = public.current_organization_id());

CREATE POLICY "Admins update org profiles"
ON public.profiles FOR UPDATE
USING (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.organization_id = public.current_organization_id()
  )
);

-- 5. Generic org-isolation pattern for all data tables
-- For each table: SELECT/UPDATE/INSERT/DELETE limited to current org.
-- Within the org: respect existing role gates (admins for some operations).

-- We use a DO block to apply the pattern uniformly, dropping pre-existing policies first.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'items','consumptions','top_ups','adjustments','categories',
    'restock_sessions','restock_items',
    'stock_transactions','stock_audits','stock_audit_items',
    'user_favorites','audit_logs','events','guest_sessions'
  ])
  LOOP
    -- Drop all existing policies on this table
    EXECUTE format('
      DO $inner$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT policyname FROM pg_policies WHERE schemaname=''public'' AND tablename=%L
        LOOP
          EXECUTE format(''DROP POLICY IF EXISTS %%I ON public.%%I'', r.policyname, %L);
        END LOOP;
      END $inner$;
    ', tbl, tbl);

    -- Add generic SELECT policy: members of org
    EXECUTE format('
      CREATE POLICY "Members view org %1$s"
      ON public.%1$I FOR SELECT
      USING (organization_id = public.current_organization_id())
    ', tbl);

    -- Add generic ALL policy: admins of org (write access)
    EXECUTE format('
      CREATE POLICY "Admins manage org %1$s"
      ON public.%1$I FOR ALL
      USING (
        organization_id = public.current_organization_id()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = ''admin''
            AND organization_id = public.current_organization_id()
        )
      )
    ', tbl);
  END LOOP;
END $$;

-- 6. Same conditional handling for notifications if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'DO $inner$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT policyname FROM pg_policies WHERE schemaname=''public'' AND tablename=''notifications''
        LOOP
          EXECUTE format(''DROP POLICY IF EXISTS %I ON public.notifications'', r.policyname);
        END LOOP;
      END $inner$';

    EXECUTE 'CREATE POLICY "Members view org notifications" ON public.notifications FOR SELECT USING (organization_id = public.current_organization_id())';
    EXECUTE 'CREATE POLICY "Admins manage org notifications" ON public.notifications FOR ALL USING (organization_id = public.current_organization_id() AND EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role=''admin'' AND organization_id=public.current_organization_id()))';
  END IF;
END $$;

COMMIT;
```

**Note on consumptions/top_ups:** the generic admin-write policy above means only admins can INSERT consumptions/top_ups. That's wrong — regular users log their own drinks. After Step 2 verify, you may need a follow-up migration that adds user-INSERT policies for these specific tables. The plan lists this as Task B4.5 below.

- [ ] **Step 2 (USER ACTION): Apply migration**

Run in Supabase Dashboard SQL editor.

If you get errors about specific tables not existing (e.g., `events`, `notifications`), comment them out from the policy loop or handle conditionally — the DO block handles `notifications` already.

- [ ] **Step 3: Verify**

```sql
-- Check helper function exists
SELECT proname FROM pg_proc WHERE proname='current_organization_id';

-- Spot-check policies on items
SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='items';
-- Expected: 2 policies (Members view, Admins manage)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100300_rls_org_isolation.sql
git commit -m "Migration: current_organization_id() helper + org-isolation RLS"
```

**Checkpoint:** RLS isolates data by org. Some user-action policies still need work (Task B4.5).

---

## Task B4.5: Migration — User-action RLS for consumptions / top_ups / favorites

**Files:**
- Create: `baraccount/supabase/migrations/20260428100350_user_action_rls.sql`

Regular users (not just admins) need INSERT permission on consumptions (logging drinks), top_ups (Stripe webhooks insert these — actually via service_role, so RLS doesn't matter there), and user_favorites (their own favorites). Carve out specific user-write policies.

- [ ] **Step 1: Write the migration**

```sql
BEGIN;

-- consumptions: any member can INSERT a consumption for themselves in their org
-- (the user_id check ensures they can't log for someone else)
CREATE POLICY "Members log own consumptions"
ON public.consumptions FOR INSERT
WITH CHECK (
  organization_id = public.current_organization_id()
  AND user_id = auth.uid()
);

-- user_favorites: any member can manage their own favorites
DROP POLICY IF EXISTS "Members manage own favorites" ON public.user_favorites;
CREATE POLICY "Members manage own favorites"
ON public.user_favorites FOR ALL
USING (
  organization_id = public.current_organization_id()
  AND user_id = auth.uid()
);

-- guest_sessions: handled via Edge Functions with service_role, so admin-only ALL policy is fine

-- top_ups: inserted via Stripe webhook (service_role), so admin-only ALL is fine for direct REST.
-- Members can SELECT their own top_ups (covered by generic Members-view-org policy).

COMMIT;
```

- [ ] **Step 2 (USER ACTION): Apply migration**

Run in Supabase Dashboard SQL editor.

- [ ] **Step 3: Verify**

```sql
SELECT policyname FROM pg_policies WHERE tablename='consumptions';
-- Expected: at least "Members view org consumptions", "Admins manage org consumptions", "Members log own consumptions"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100350_user_action_rls.sql
git commit -m "Migration: user-action RLS for consumptions and favorites"
```

**Checkpoint:** Regular users can do their normal actions (log drinks, manage favorites).

---

## Task B5: Migration — Set `organization_id` to NOT NULL

**Files:**
- Create: `baraccount/supabase/migrations/20260428100400_organization_id_not_null.sql`

Now that all data flows ensure organization_id is set, lock it down with NOT NULL constraints.

- [ ] **Step 1: Write the migration**

```sql
BEGIN;

ALTER TABLE public.profiles            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.items               ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.consumptions        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.top_ups             ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.adjustments         ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.categories          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.restock_sessions    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.restock_items       ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_transactions  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_audits        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.stock_audit_items   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.user_favorites      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.audit_logs          ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.events              ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.guest_sessions      ALTER COLUMN organization_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ALTER COLUMN organization_id SET NOT NULL';
  END IF;
END $$;

COMMIT;
```

- [ ] **Step 2 (USER ACTION): Apply migration**

If a table has rows where organization_id IS NULL, this fails. Since we're on a fresh DB with no data, no issue. If you accidentally inserted test rows earlier, clean them up first.

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.columns
WHERE table_schema='public' AND column_name='organization_id' AND is_nullable='NO'
ORDER BY table_name;
```
Expected: 14-15 tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428100400_organization_id_not_null.sql
git commit -m "Migration: organization_id NOT NULL on all org-scoped tables"
```

**Checkpoint:** Phase B done. Database is fully multi-tenant.

---

# Phase C — Edge Functions

Supabase Edge Functions are Deno scripts in `supabase/functions/<name>/index.ts`. They run server-side with service-role access. Deployment via `supabase functions deploy <name>` (Supabase CLI) or via Dashboard upload.

**Setup once:** Install Supabase CLI if not already: https://supabase.com/docs/guides/cli/getting-started. Login: `supabase login`. Link your project: `cd baraccount && supabase link --project-ref YOUR_PROJECT_REF`.

## Task C1: Edge Function — `check-slug-availability`

**Files:**
- Create: `baraccount/supabase/functions/check-slug-availability/index.ts`
- Create: `baraccount/supabase/functions/_shared/reservedSlugs.ts`

Public function that returns whether a slug is available. Used by signup form for live validation.

- [ ] **Step 1: Create shared reserved-slug list**

Create `baraccount/supabase/functions/_shared/reservedSlugs.ts`:

```ts
export const RESERVED_SLUGS = new Set([
  'www','app','api','admin','mail','support','docs','blog','status','static','assets',
  'auth','login','signup','dashboard','help',
]);

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
```

- [ ] **Step 2: Write the Edge Function**

Create `baraccount/supabase/functions/check-slug-availability/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isValidSlugFormat, isReservedSlug } from '../_shared/reservedSlugs.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get('slug') ?? '').trim().toLowerCase();

    if (!slug) {
      return new Response(JSON.stringify({ available: false, reason: 'empty' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!isValidSlugFormat(slug)) {
      return new Response(JSON.stringify({ available: false, reason: 'invalid_format' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isReservedSlug(slug)) {
      return new Response(JSON.stringify({ available: false, reason: 'reserved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;

    return new Response(
      JSON.stringify({ available: !data, reason: data ? 'taken' : 'ok' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ available: false, reason: 'error', error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 3: Deploy the function**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
supabase functions deploy check-slug-availability --no-verify-jwt
```

`--no-verify-jwt` is correct here because we want this function callable from anonymous signup form.

- [ ] **Step 4: Test the function**

```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/check-slug-availability?slug=test-club" \
  -H "apikey: YOUR_ANON_KEY"
```
Expected: `{"available":true,"reason":"ok"}`.

```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/check-slug-availability?slug=admin"
```
Expected: `{"available":false,"reason":"reserved"}`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/check-slug-availability supabase/functions/_shared
git commit -m "Edge Function: check-slug-availability"
```

**Checkpoint:** Slug-availability check works publicly.

---

## Task C2: Edge Function — `signup-organization`

**Files:**
- Create: `baraccount/supabase/functions/signup-organization/index.ts`

Atomic signup: creates auth user + org + admin profile + 5 default categories + sets JWT claim. All in one transaction (with manual cleanup if Supabase admin API calls fail mid-flow).

- [ ] **Step 1: Write the Edge Function**

Create `baraccount/supabase/functions/signup-organization/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isValidSlugFormat, isReservedSlug } from '../_shared/reservedSlugs.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignupRequest {
  email: string;
  password: string;
  name: string;       // user's name
  org_name: string;   // organization display name
  slug: string;       // subdomain
}

const DEFAULT_CATEGORIES = [
  { slug: 'frisdranken',    name: 'Frisdranken',    color: 'blue',   sort_order: 1   },
  { slug: 'bieren',         name: 'Bieren',         color: 'amber',  sort_order: 2   },
  { slug: 'sterke_dranken', name: 'Sterke dranken', color: 'red',    sort_order: 3   },
  { slug: 'chips',          name: 'Chips',          color: 'yellow', sort_order: 4   },
  { slug: 'andere',         name: 'Andere',         color: 'gray',   sort_order: 100 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let createdAuthUserId: string | null = null;
  let createdOrgId: string | null = null;

  try {
    const body = (await req.json()) as SignupRequest;
    const { email, password, name, org_name, slug: rawSlug } = body;

    if (!email || !password || !name || !org_name || !rawSlug) {
      throw new Error('Missing required field');
    }
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    if (org_name.length > 80) throw new Error('Organization name too long');
    if (name.length > 80) throw new Error('Name too long');

    const slug = rawSlug.trim().toLowerCase();
    if (!isValidSlugFormat(slug)) throw new Error('Invalid subdomain format');
    if (isReservedSlug(slug)) throw new Error('That subdomain is reserved');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Check slug availability (race-safe via UNIQUE constraint, but we check first for nicer error)
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existingOrg) throw new Error('That subdomain is already taken');

    // 2. Create auth user (email_confirm=false → Supabase sends verification email)
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });
    if (userError) throw userError;
    if (!userData.user) throw new Error('User creation returned no user');
    createdAuthUserId = userData.user.id;

    // 3. Create organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ slug, name: org_name.trim(), active: true })
      .select('id')
      .single();
    if (orgError) throw orgError;
    createdOrgId = orgData.id;

    // 4. Create profile (admin role)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: createdAuthUserId,
        name: name.trim(),
        role: 'admin',
        organization_id: createdOrgId,
        active: true,
      });
    if (profileError) throw profileError;

    // 5. Seed 5 default categories for this org
    const categoriesToInsert = DEFAULT_CATEGORIES.map((c) => ({
      ...c,
      organization_id: createdOrgId!,
      is_protected: c.slug === 'andere',
    }));
    const { error: catError } = await supabase
      .from('categories')
      .insert(categoriesToInsert);
    if (catError) throw catError;

    // 6. Set JWT claim
    const { error: claimError } = await supabase.auth.admin.updateUserById(
      createdAuthUserId,
      { app_metadata: { organization_id: createdOrgId } },
    );
    if (claimError) throw claimError;

    return new Response(
      JSON.stringify({ success: true, subdomain: slug }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    // Best-effort rollback
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    if (createdOrgId) {
      // Delete in dependency order: categories, then profile (FK to org), then org
      await supabase.from('categories').delete().eq('organization_id', createdOrgId);
      await supabase.from('profiles').delete().eq('organization_id', createdOrgId);
      await supabase.from('organizations').delete().eq('id', createdOrgId);
    }
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId);
    }

    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Deploy the function**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
supabase functions deploy signup-organization --no-verify-jwt
```

- [ ] **Step 3: Test the function**

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/signup-organization" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "email": "test+1@example.com",
    "password": "testpassword123",
    "name": "Test User",
    "org_name": "Test Club",
    "slug": "test-club"
  }'
```
Expected: `{"success":true,"subdomain":"test-club"}`.

Verify in Supabase Dashboard:
- Authentication tab → see test+1@example.com
- Tables → organizations → see "Test Club" row
- Tables → profiles → see Test User row with role=admin
- Tables → categories → see 5 rows for that org

- [ ] **Step 4: Test failure rollback**

```bash
# Try to create with a duplicate slug — should fail and clean up auth user
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/signup-organization" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test+2@example.com",
    "password": "testpassword123",
    "name": "Test User 2",
    "org_name": "Test Club 2",
    "slug": "test-club"
  }'
```
Expected: `{"success":false,"error":"That subdomain is already taken"}`. And NO new row in auth.users / profiles for test+2.

- [ ] **Step 5: Clean up the test data before continuing**

```sql
-- In Supabase SQL editor:
DELETE FROM categories WHERE organization_id = (SELECT id FROM organizations WHERE slug='test-club');
DELETE FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE slug='test-club');
DELETE FROM organizations WHERE slug='test-club';
-- Also delete the auth user via Authentication tab UI
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/signup-organization
git commit -m "Edge Function: signup-organization (atomic, with rollback)"
```

**Checkpoint:** Signup creates a complete tenant or rolls back cleanly.

---

## Task C3: Edge Function — `accept-invite`

**Files:**
- Create: `baraccount/supabase/functions/accept-invite/index.ts`

Public function that accepts an invite token and creates a new user + profile in the invited org.

- [ ] **Step 1: Write the Edge Function**

Create `baraccount/supabase/functions/accept-invite/index.ts`:

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptRequest {
  token: string;
  password: string;
  name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let createdAuthUserId: string | null = null;

  try {
    const body = (await req.json()) as AcceptRequest;
    const { token, password, name } = body;

    if (!token || !password || !name) throw new Error('Missing required field');
    if (password.length < 8) throw new Error('Password must be at least 8 characters');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Look up invite by token
    const { data: invite, error: inviteError } = await supabase
      .from('invitations')
      .select('id, organization_id, email, role, expires_at, status')
      .eq('token', token)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) throw new Error('Invalid or expired invite');
    if (invite.status !== 'pending') throw new Error('This invite has already been used or cancelled');
    if (new Date(invite.expires_at) < new Date()) {
      // Mark as expired and reject
      await supabase.from('invitations').update({ status: 'expired' }).eq('id', invite.id);
      throw new Error('This invite has expired');
    }

    // 2. Check email isn't already in another org (strict 1-user-1-org)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, organization_id')
      .in('id', (await supabase.auth.admin.listUsers()).data.users.filter((u) => u.email === invite.email).map((u) => u.id))
      .maybeSingle();
    if (existingProfile) {
      throw new Error('This email address is already registered with another organization');
    }

    // 3. Create auth user (email_confirm=true: invite IS the verification)
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });
    if (userError) throw userError;
    if (!userData.user) throw new Error('User creation returned no user');
    createdAuthUserId = userData.user.id;

    // 4. Create profile with the role from invite
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: createdAuthUserId,
        name: name.trim(),
        role: invite.role,
        organization_id: invite.organization_id,
        active: true,
      });
    if (profileError) throw profileError;

    // 5. Set JWT claim
    const { error: claimError } = await supabase.auth.admin.updateUserById(
      createdAuthUserId,
      { app_metadata: { organization_id: invite.organization_id } },
    );
    if (claimError) throw claimError;

    // 6. Mark invite as accepted
    await supabase.from('invitations').update({ status: 'accepted' }).eq('id', invite.id);

    // Look up org slug for redirect
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', invite.organization_id)
      .single();

    return new Response(
      JSON.stringify({ success: true, slug: org?.slug, email: invite.email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    if (createdAuthUserId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await supabase.from('profiles').delete().eq('id', createdAuthUserId);
      await supabase.auth.admin.deleteUser(createdAuthUserId);
    }
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] **Step 2: Deploy**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
supabase functions deploy accept-invite --no-verify-jwt
```

- [ ] **Step 3: Test (after Phase D + manual invite creation)**

This function is hard to test in isolation. Integration test happens in Phase E. For now confirm deploy succeeded:

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/accept-invite" \
  -H "Content-Type: application/json" \
  -d '{"token":"nonexistent","password":"abcdefgh","name":"Test"}'
```
Expected: `{"success":false,"error":"Invalid or expired invite"}`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/accept-invite
git commit -m "Edge Function: accept-invite"
```

**Checkpoint:** Phase C done. All three Edge Functions deployed.

---

# Phase D — Frontend

## Task D1: Hostname-detection helper + OrgContext provider

**Files:**
- Create: `baraccount/src/lib/hostname.ts`
- Create: `baraccount/src/lib/reservedSlugs.ts` (mirror of supabase function shared file)
- Create: `baraccount/src/contexts/OrgContext.tsx`
- Create: `baraccount/src/hooks/useOrg.ts`

- [ ] **Step 1: Create `src/lib/reservedSlugs.ts`** (frontend mirror of the Edge Function shared file — keeps validation symmetric)

```ts
export const RESERVED_SLUGS = new Set([
  'www','app','api','admin','mail','support','docs','blog','status','static','assets',
  'auth','login','signup','dashboard','help',
]);

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
```

- [ ] **Step 2: Create `src/lib/hostname.ts`**

```ts
import { isReservedSlug, isValidSlugFormat } from './reservedSlugs';

export interface HostnameInfo {
  isRoot: boolean;
  slug: string | null;  // null if root, the slug otherwise
}

export function parseHostname(hostname: string): HostnameInfo {
  const lower = hostname.toLowerCase();

  // Strip port if present (shouldn't be in window.location.hostname but defensive)
  const host = lower.split(':')[0];

  // Production: baraccount.com or *.baraccount.com
  if (host === 'baraccount.com' || host === 'www.baraccount.com') {
    return { isRoot: true, slug: null };
  }
  if (host.endsWith('.baraccount.com')) {
    const slug = host.slice(0, -'.baraccount.com'.length);
    return { isRoot: false, slug };
  }

  // Dev: localhost or *.localhost
  if (host === 'localhost') {
    return { isRoot: true, slug: null };
  }
  if (host.endsWith('.localhost')) {
    const slug = host.slice(0, -'.localhost'.length);
    return { isRoot: false, slug };
  }

  // Cloudflare Pages preview deployments: *.pages.dev — treat as root for safety
  if (host.endsWith('.pages.dev')) {
    return { isRoot: true, slug: null };
  }

  // Unknown domain — treat as root, render marketing
  return { isRoot: true, slug: null };
}

export function isValidSubdomain(slug: string): boolean {
  return isValidSlugFormat(slug) && !isReservedSlug(slug);
}
```

- [ ] **Step 3: Create `src/contexts/OrgContext.tsx`**

```tsx
import { createContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseHostname } from '@/lib/hostname';

export interface Organization {
  id: string;
  slug: string;
  name: string;
}

export type OrgState =
  | { status: 'loading' }
  | { status: 'root' }                    // marketing site, no org
  | { status: 'found'; org: Organization }
  | { status: 'not_found'; slug: string };

export const OrgContext = createContext<OrgState>({ status: 'loading' });

export function OrgProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrgState>({ status: 'loading' });

  useEffect(() => {
    const info = parseHostname(window.location.hostname);

    if (info.isRoot) {
      setState({ status: 'root' });
      return;
    }

    const slug = info.slug!;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, slug, name')
        .eq('slug', slug)
        .eq('active', true)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState({ status: 'not_found', slug });
      } else {
        setState({ status: 'found', org: data });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return <OrgContext.Provider value={state}>{children}</OrgContext.Provider>;
}
```

- [ ] **Step 4: Create `src/hooks/useOrg.ts`**

```ts
import { useContext } from 'react';
import { OrgContext, OrgState } from '@/contexts/OrgContext';

export function useOrgState(): OrgState {
  return useContext(OrgContext);
}

/**
 * Convenience hook for app-side components that EXPECT to be inside an org.
 * Throws if the org isn't loaded yet or doesn't exist — only call from components
 * that are mounted under an `<App>` tree (i.e., not from marketing pages).
 */
export function useOrg() {
  const state = useContext(OrgContext);
  if (state.status !== 'found') {
    throw new Error('useOrg called outside of an org-scoped route');
  }
  return state.org;
}
```

- [ ] **Step 5: Wrap App in `OrgProvider` in `main.tsx`**

Read `baraccount/src/main.tsx`. Add the import and wrap the existing tree:

```tsx
import { OrgProvider } from '@/contexts/OrgContext';

// ... in the render:
<OrgProvider>
  <App />
</OrgProvider>
```

(Wrap inside any existing providers like ThemeProvider, but outside React Router.)

- [ ] **Step 6: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/lib/hostname.ts src/lib/reservedSlugs.ts src/contexts/OrgContext.tsx src/hooks/useOrg.ts src/main.tsx
git commit -m "feat: hostname-based OrgContext provider + useOrg hook"
```

**Checkpoint:** Org context plumbing in place.

---

## Task D2: Marketing landing page + root routing

**Files:**
- Create: `baraccount/src/pages/marketing/Landing.tsx`
- Create: `baraccount/src/pages/marketing/FindOrg.tsx`
- Create: `baraccount/src/pages/marketing/OrgNotFound.tsx`
- Modify: `baraccount/src/App.tsx` (top-level routing logic based on OrgState)

- [ ] **Step 1: Create marketing pages**

`baraccount/src/pages/marketing/Landing.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="max-w-4xl mx-auto px-4 py-20">
        <header className="flex items-center gap-3 mb-12">
          <img src="/logo-placeholder.svg" alt="baraccount" className="h-10 w-10" />
          <span className="text-2xl font-bold">baraccount</span>
        </header>

        <main className="space-y-8">
          <h1 className="text-5xl font-bold leading-tight">
            Run your bar tab.
            <br />
            For your team. Or your club.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            A self-serve platform for organizations that run an internal bar — youth movements, sports clubs, small companies. Members log drinks, top up balances, admins manage stock. We take 3% of top-up transactions. That's it.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button asChild size="lg">
              <Link to="/signup">Start your bar</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/find-org">I'm looking for my organization</Link>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
```

`baraccount/src/pages/marketing/FindOrg.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function FindOrg() {
  const [query, setQuery] = useState('');

  const { data: orgs = [] } = useQuery({
    queryKey: ['org-search', query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const { data } = await supabase
        .from('organizations')
        .select('slug, name')
        .ilike('name', `%${query.trim()}%`)
        .eq('active', true)
        .limit(10);
      return data ?? [];
    },
    enabled: query.trim().length >= 2,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← Back</Link>
        <h1 className="text-3xl font-bold mt-6 mb-2">Find your organization</h1>
        <p className="text-muted-foreground mb-6">
          Type the name of your club or company. We'll send you to the right login page.
        </p>
        <Input
          autoFocus
          placeholder="e.g., Chiro Sint-Jozef"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="mt-4 space-y-2">
          {orgs.map((org) => (
            <Card key={org.slug}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-sm text-muted-foreground">{org.slug}.baraccount.com</div>
                </div>
                <Button asChild variant="outline">
                  <a href={`https://${org.slug}.baraccount.com/login`}>Go to login</a>
                </Button>
              </CardContent>
            </Card>
          ))}
          {query.trim().length >= 2 && orgs.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No organizations match that name.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

`baraccount/src/pages/marketing/OrgNotFound.tsx`:

```tsx
import { Button } from '@/components/ui/button';

export default function OrgNotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-bold">Organization not found</h1>
        <p className="text-muted-foreground">
          We couldn't find an organization at <span className="font-mono">{slug}.baraccount.com</span>.
        </p>
        <Button asChild>
          <a href="https://baraccount.com">Back to baraccount.com</a>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/App.tsx` for top-level routing**

Read the current `App.tsx`. The chiro version has React Router routes for `/auth`, `/`, `/admin`, `/guest/:id`, etc.

Wrap the entire route-tree in a check based on OrgState. The new `App.tsx`:

```tsx
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { useOrgState } from '@/hooks/useOrg';
import Landing from '@/pages/marketing/Landing';
import FindOrg from '@/pages/marketing/FindOrg';
import OrgNotFound from '@/pages/marketing/OrgNotFound';
import Signup from '@/pages/marketing/Signup';
// ... existing imports for authenticated app pages
import Auth from '@/pages/Auth';
import Index from '@/pages/Index';
import AdminDashboard from '@/pages/AdminDashboard';
import AcceptInvite from '@/pages/AcceptInvite';
import ProtectedRoute from '@/components/ProtectedRoute';
// ... etc

export default function App() {
  const orgState = useOrgState();

  if (orgState.status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter>
      {orgState.status === 'root' && (
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/find-org" element={<FindOrg />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      )}

      {orgState.status === 'not_found' && <OrgNotFound slug={orgState.slug} />}

      {orgState.status === 'found' && (
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          {/* ALL the existing chiro app routes go here, unchanged */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          {/* ... etc */}
        </Routes>
      )}
    </BrowserRouter>
  );
}
```

**Important:** Read the existing `App.tsx` carefully and preserve all existing routes when adapting — don't lose anything. The chiro app likely has more routes than the example above shows.

- [ ] **Step 3: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```

(`Signup` and `AcceptInvite` aren't created yet — Steps below. Build will fail. Skip this step or temporarily comment those imports/routes until D3 and D5 done.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/marketing src/App.tsx
git commit -m "feat: marketing pages + hostname-based top-level routing"
```

**Checkpoint:** Routing skeleton ready. Build will be red until D3 + D5 land.

---

## Task D3: Signup page with live slug-availability check

**Files:**
- Create: `baraccount/src/pages/marketing/Signup.tsx`

- [ ] **Step 1: Create the page**

`baraccount/src/pages/marketing/Signup.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isValidSlugFormat, isReservedSlug } from '@/lib/reservedSlugs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    org_name: '',
    slug: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const debouncedSlug = useDebounce(form.slug.trim().toLowerCase(), 350);

  const slugCheck = useQuery({
    queryKey: ['slug-availability', debouncedSlug],
    queryFn: async () => {
      if (!debouncedSlug) return { available: false, reason: 'empty' };
      if (!isValidSlugFormat(debouncedSlug)) return { available: false, reason: 'invalid_format' };
      if (isReservedSlug(debouncedSlug)) return { available: false, reason: 'reserved' };
      const { data, error } = await supabase.functions.invoke('check-slug-availability', {
        body: undefined,
        method: 'GET',
      });
      // supabase-js v2 functions.invoke doesn't support GET query params well; use fetch directly:
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-slug-availability?slug=${encodeURIComponent(debouncedSlug)}`;
      const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } });
      return res.json() as Promise<{ available: boolean; reason: string }>;
    },
    enabled: debouncedSlug.length >= 3,
  });

  const signup = useMutation({
    mutationFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup-organization`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Signup failed');
      return json;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (e: Error) => {
      toast({ title: 'Signup failed', description: e.message, variant: 'destructive' });
    },
  });

  const slugAvailable = slugCheck.data?.available === true;
  const slugReason = slugCheck.data?.reason;

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.password.length >= 8 &&
    form.org_name.trim() &&
    slugAvailable &&
    !signup.isPending;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Check your inbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              We sent a verification email to <strong>{form.email}</strong>. Click the link
              to confirm your address.
            </p>
            <p>
              After that, log in at:
              <br />
              <a className="text-primary underline" href={`https://${form.slug}.baraccount.com/login`}>
                {form.slug}.baraccount.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-primary/5 to-accent/5">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
          <Link to="/" className="text-sm text-muted-foreground hover:underline">← Back</Link>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (canSubmit) signup.mutate(); }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="password">Password (min 8 chars)</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
            </div>
            <div>
              <Label htmlFor="org_name">Organization name</Label>
              <Input id="org_name" value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} maxLength={80} required />
            </div>
            <div>
              <Label htmlFor="slug">Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  placeholder="your-org"
                  required
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.baraccount.com</span>
              </div>
              {debouncedSlug && (
                <p className="text-xs mt-1">
                  {slugCheck.isLoading && 'Checking...'}
                  {slugAvailable && <span className="text-green-600">✓ Available</span>}
                  {slugReason === 'taken' && <span className="text-destructive">✗ Already taken</span>}
                  {slugReason === 'reserved' && <span className="text-destructive">✗ Reserved name</span>}
                  {slugReason === 'invalid_format' && (
                    <span className="text-destructive">✗ Use lowercase letters, numbers, hyphens (3-30 chars)</span>
                  )}
                </p>
              )}
            </div>
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {signup.isPending ? 'Creating...' : 'Create organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```
Expected: success now (Signup is the missing import from D2).

- [ ] **Step 3: Smoke test in dev**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run dev
```

Open `http://localhost:8080` → Landing page. Click "Start your bar". Fill the form with `slug=test-club`. See ✓ Available appear. Submit. See "Check your inbox" page. Verify in Supabase Dashboard the row was created.

Clean up after test:
```sql
DELETE FROM categories WHERE organization_id = (SELECT id FROM organizations WHERE slug='test-club');
DELETE FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE slug='test-club');
DELETE FROM organizations WHERE slug='test-club';
-- Delete auth user via Authentication tab
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/marketing/Signup.tsx
git commit -m "feat: signup page with live slug-availability check"
```

**Checkpoint:** Signup flow works end-to-end (signup → email → manual link click → land on subdomain login).

---

## Task D4: Login page updates (org branding + post-login validation)

**Files:**
- Modify: `baraccount/src/pages/Auth.tsx` (or wherever the chiro login page is)
- Modify: `baraccount/src/hooks/useAuth.ts`

- [ ] **Step 1: Read current Auth.tsx**

Open `baraccount/src/pages/Auth.tsx` (the chiro login page). Note the structure.

- [ ] **Step 2: Add org-branded header**

In the JSX, add at the top of the auth card (above the form):

```tsx
import { useOrg } from '@/hooks/useOrg';

// Inside the component:
const org = useOrg();

// In JSX:
<div className="text-center mb-6">
  <img src="/logo-placeholder.svg" alt={org.name} className="h-12 w-12 mx-auto mb-2" />
  <h1 className="text-xl font-semibold">Log in to {org.name}</h1>
</div>
```

- [ ] **Step 3: Add post-login org-validation in useAuth**

Read `baraccount/src/hooks/useAuth.ts`. After the user/session-setup logic, add a check that compares the user's `app_metadata.organization_id` with the current page's org.

Example pattern to add (adapt to existing code):

```ts
import { useEffect } from 'react';
import { useOrgState } from './useOrg';

// Inside the auth hook, after session is loaded:
useEffect(() => {
  if (!session?.user) return;
  if (orgState.status !== 'found') return;

  const userOrgId = session.user.app_metadata?.organization_id;
  if (userOrgId && userOrgId !== orgState.org.id) {
    // Cross-org token misuse — log out
    supabase.auth.signOut();
    window.alert('Your account does not belong to this organization. Please log in on your own subdomain.');
  }
}, [session, orgState]);
```

Make sure to import `useOrgState` and the existing supabase client.

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/Auth.tsx src/hooks/useAuth.ts
git commit -m "feat: org-branded login + post-login cross-org validation"
```

**Checkpoint:** Login page is org-aware. Cross-org JWT misuse logs out automatically.

---

## Task D5: Accept-invite page

**Files:**
- Create: `baraccount/src/pages/AcceptInvite.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const org = useOrg();
  const token = params.get('token') ?? '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const accept = useMutation({
    mutationFn: async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invite`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token, password, name }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Accept failed');
      return json as { success: true; slug: string; email: string };
    },
    onSuccess: async (json) => {
      // Auto-login the just-created user
      const { error } = await supabase.auth.signInWithPassword({
        email: json.email,
        password,
      });
      if (error) {
        toast({ title: 'Logged in but session failed', description: 'Please log in manually.' });
        navigate('/login');
      } else {
        navigate('/');
      }
    },
    onError: (e: Error) => {
      toast({ title: 'Could not accept invite', description: e.message, variant: 'destructive' });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Missing invite token.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/5 to-accent/5">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Join {org.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); if (name && password.length >= 8) accept.mutate(); }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Choose a password (min 8 chars)</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </div>
            <Button type="submit" className="w-full" disabled={accept.isPending}>
              {accept.isPending ? 'Joining...' : 'Join organization'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AcceptInvite.tsx
git commit -m "feat: accept-invite page"
```

**Checkpoint:** Invite-accept UI exists. Tested end-to-end in Phase E.

---

## Task D6: Admin Members section (invite form + outstanding invites)

**Files:**
- Create: `baraccount/src/components/admin/MemberManagement.tsx`
- Modify: `baraccount/src/pages/AdminDashboard.tsx` (add new tab)

- [ ] **Step 1: Create MemberManagement component**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/hooks/useOrg';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, RotateCw } from 'lucide-react';
import { format } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const MemberManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const org = useOrg();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'treasurer' | 'admin'>('user');

  const { data: invites = [] } = useQuery({
    queryKey: ['invitations', org.id],
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await supabase
        .from('invitations')
        .select('id, email, role, status, expires_at, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      // Generate cryptographically random token
      const token = crypto.randomUUID() + '-' + crypto.randomUUID().replace(/-/g, '');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('invitations').insert({
        organization_id: org.id,
        email: email.trim().toLowerCase(),
        role,
        token,
        created_by: user.id,
      });
      if (error) throw error;

      // Send invite email — uses Supabase's email infrastructure
      // Simplest path: use the Supabase auth.admin.inviteUserByEmail flow,
      // but that creates a user immediately. Instead we send a custom email
      // via Supabase Edge Function. For MVP, log to console and show toast
      // with the invite link.
      const inviteLink = `https://${org.slug}.baraccount.com/accept-invite?token=${token}`;
      console.log('Invite link (send via email):', inviteLink);
      toast({
        title: 'Invitation created',
        description: `Send this link to ${email}: ${inviteLink}`,
      });
      // TODO: For Block 1 ship, add a real email-send Edge Function.
      // For now admin manually copies the link from the toast or invite-table.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setOpen(false);
      setEmail('');
      setRole('user');
    },
    onError: (e: Error) => {
      toast({ title: 'Could not create invitation', description: e.message, variant: 'destructive' });
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({ title: 'Invitation cancelled' });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Members
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a new member</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
                <div>
                  <Label htmlFor="invite-email">Email</Label>
                  <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={role} onValueChange={(v: any) => setRole(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="treasurer">Treasurer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={create.isPending || !email}>Send invite</Button>
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
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No invitations yet.</TableCell></TableRow>
              ) : invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell><Badge variant="secondary">{inv.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'pending' ? 'default' : 'outline'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(inv.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{format(new Date(inv.expires_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    {inv.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => cancel.mutate(inv.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
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

export default MemberManagement;
```

**Note on email sending:** Block 1 simplification — invitations show the invite link in a toast for the admin to copy and send manually. A full email-send integration (via Supabase Edge Function calling Resend / SendGrid / Postmark) is out of scope for Block 1 per the spec. This keeps the implementation focused.

- [ ] **Step 2: Add Members tab to AdminDashboard**

Read `baraccount/src/pages/AdminDashboard.tsx`. Currently has 6 tabs (after categories was added). Add a 7th: "Members".

- Update `grid-cols-6` → `grid-cols-7`
- Add `import MemberManagement from '@/components/admin/MemberManagement'`
- Add `import { UserPlus } from 'lucide-react'` (or extend existing lucide import)
- Add a new TabsTrigger:

```tsx
<TabsTrigger value="members" className="...">
  <UserPlus className="h-4 w-4 shrink-0" />
  <span className="hidden sm:inline">Members</span>
</TabsTrigger>
```

- Add the new TabsContent:
```tsx
<TabsContent value="members">
  <MemberManagement />
</TabsContent>
```

- [ ] **Step 3: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/MemberManagement.tsx src/pages/AdminDashboard.tsx
git commit -m "feat: admin Members tab with invite creation + outstanding-invites list"
```

**Checkpoint:** Admin can create invites; pending list visible. Email sending is admin-manual (copy link from toast).

---

## Task D7: Strip remaining "Chiro" hardcoded references

**Files:**
- Modify: many (anywhere "Chiro" or `chiro` appears in src/ except inside `node_modules` or `dist`)

- [ ] **Step 1: Find all "Chiro" references in source**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
grep -rn "Chiro\|chiro\|ChiroBar" src/ --include="*.tsx" --include="*.ts" --include="*.css"
```

Expected output: a list of files with line numbers. Common locations:
- `index.html` `<title>` and `<meta name="description">`
- `src/pages/AdminDashboard.tsx` — header text
- `src/pages/Index.tsx` — welcome strings
- Various components with "Chiro" in copy

- [ ] **Step 2: Replace each occurrence**

For each match, decide:
- **Strings that should become org-name driven:** replace with `{org.name}` (and add `useOrg()` import in that file)
- **Strings that should be brand-generic** (e.g., the marketing site): replace with "baraccount"
- **HTML title tags / static metadata:** "baraccount" hardcoded is fine

For example, in `AdminDashboard.tsx`, the header says "Admin Dashboard" already (no chiro reference) — but there's an `<img src="/lovable-uploads/...png" alt="Chiro Logo">`. Replace with `<img src="/logo-placeholder.svg" alt={org.name}>`.

In `index.html`:
```html
<title>baraccount</title>
<meta name="description" content="Run your bar tab. For your team. Or your club.">
```

- [ ] **Step 3: Re-grep to verify clean**

```bash
grep -rn "Chiro\|chiro\|ChiroBar" src/ public/ index.html --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html"
```
Expected: zero matches in src/, public/, index.html. The /docs/ subdirectory still has the spec/plan referring to Chiro — that's intended (historical docs).

- [ ] **Step 4: Verify build**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount" && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: strip 'Chiro' hardcoded references; use org.name everywhere"
```

**Checkpoint:** No more chiro-isms in the user-facing app.

---

# Phase E — Smoke Testing

## Task E1: End-to-end smoke tests

**Files:** None (manual verification)

- [ ] **Step 1: Push latest code, wait for Cloudflare Pages deploy**

```bash
cd "c:/Users/Emiel/My Drive/07-tech-en-software/scripts-en-code/rep-baraccount/baraccount"
git push
```

Wait ~2 minutes. Watch Cloudflare Pages dashboard for deploy completion.

- [ ] **Step 2: Smoke test 1 — first signup**

In browser, visit `https://baraccount.com`. Click "Start your bar". Fill form:
- Name: Demo Admin
- Email: yourname+demo1@gmail.com (use a real address you can check)
- Password: testpass123
- Org name: Demo Club
- Subdomain: demo-club

Submit. See "Check your inbox". Open the verification email, click the link. Should land at `https://demo-club.baraccount.com/login` (or similar).

Log in. Should land at the app home. Add a few items, log a drink, view your saldo. Confirm everything works.

- [ ] **Step 3: Smoke test 2 — second signup, isolation check**

Open a private/incognito window. Repeat signup with `yourname+demo2@gmail.com` and slug `acme`.

Log in to `https://acme.baraccount.com`. Verify: NO items, NO categories visible from demo-club. The app feels brand new.

- [ ] **Step 4: Smoke test 3 — invite flow**

Back in `demo-club.baraccount.com` (logged in as admin):
- Go to admin → Members tab
- Click "Invite member", email yourname+demo3@gmail.com, role=user, send
- Copy invite link from toast

Open in different incognito window: paste invite link. Fill name + password. Submit. Should land logged in inside demo-club.

Verify: role is "user" (no admin tab access), can see items, can log drinks.

- [ ] **Step 5: Smoke test 4 — cross-org JWT misuse**

In your demo-club logged-in window: open DevTools → Application → Local Storage. Find the supabase token (key starts with `sb-`).

In a new tab visit `https://acme.baraccount.com`. Open DevTools → Application → Local Storage. Paste the demo-club token in. Refresh.

Expected: app detects mismatch → logs you out with alert "Your account does not belong to this organization."

- [ ] **Step 6: Smoke test 5 — RLS isolation via SQL**

In Supabase SQL editor:
```sql
SELECT name, organization_id FROM items;
-- Expected: rows from BOTH orgs visible (you're using service_role here)

-- Now simulate a query with a JWT claim for demo-club:
SET request.jwt.claims = '{"app_metadata": {"organization_id": "DEMO_CLUB_ORG_ID"}}';
SELECT name, organization_id FROM items;
-- Expected: ONLY demo-club's items
```

Replace `DEMO_CLUB_ORG_ID` with the actual UUID from `SELECT id FROM organizations WHERE slug='demo-club'`.

- [ ] **Step 7: Cleanup the test orgs (or keep them as demo data)**

Optional. If keeping: just don't delete. If cleaning up:
```sql
-- For each test slug:
DELETE FROM consumptions WHERE organization_id = (SELECT id FROM organizations WHERE slug='demo-club');
DELETE FROM items WHERE organization_id = (SELECT id FROM organizations WHERE slug='demo-club');
DELETE FROM categories WHERE organization_id = (SELECT id FROM organizations WHERE slug='demo-club');
DELETE FROM invitations WHERE organization_id = (SELECT id FROM organizations WHERE slug='demo-club');
DELETE FROM profiles WHERE organization_id = (SELECT id FROM organizations WHERE slug='demo-club');
DELETE FROM organizations WHERE slug='demo-club';
-- Repeat for 'acme'.
-- Then delete corresponding auth.users via Authentication tab UI.
```

**Checkpoint:** Block 1 fully tested end-to-end. All goals met:
- ✅ Self-serve signup works
- ✅ Two orgs are data-isolated
- ✅ Invite-flow works (admin manually emails the link)
- ✅ Cross-org JWT misuse is blocked
- ✅ RLS prevents data leaks at SQL level

---

## Self-Review

**Spec coverage:**
- ✅ `organizations` + `invitations` tables + `organization_id` on all org-scoped tables → Tasks B1, B2
- ✅ Categories UUID PK refactor → Task B3
- ✅ `current_organization_id()` helper + RLS rewrite → Task B4 (+ B4.5 for user-action policies)
- ✅ Subdomain routing + hostname helper + OrgContext → Task D1
- ✅ Marketing landing page + signup → Tasks D2, D3
- ✅ Edge Function: signup-organization (atomic + rollback) → Task C2
- ✅ Edge Function: accept-invite → Task C3
- ✅ Edge Function: check-slug-availability → Task C1
- ✅ Login page org-branding + post-login validation → Task D4
- ✅ Accept-invite page → Task D5
- ✅ Admin Members tab (invite create + outstanding list) → Task D6
- ✅ Strip hardcoded Chiro references → Tasks A2 (branding) + D7 (code strings)
- ✅ Strip seed-INSERTs from migrations → Task A3
- ✅ Cloudflare Pages + DNS setup → Task A5
- ✅ End-to-end smoke testing → Task E1
- ⚠️ Email-sending for invites: simplified to "admin copies link from toast" — full email Edge Function (via Resend/SendGrid) deferred. Spec mentions "Email via Supabase" in Section 3 but doesn't fully spec it. **This is a known simplification noted in Task D6.**
- ⚠️ Default-categories seed via signup-organization Edge Function → Task C2 includes this in step 5 of the function

**Placeholder scan:** No "TBD" / "TODO" left in actionable steps. The "TODO" in Task D6 (re email-sending) is an explicit deferred-feature note, not a missing step.

**Type consistency:**
- `Organization` interface — defined in OrgContext.tsx, used by useOrg.ts (Task D1) — consistent
- `OrgState` discriminated union — defined in OrgContext.tsx, used by App.tsx (Task D2) — consistent
- `useOrg()` hook — defined in Task D1, used in D4, D5, D6, D7 — consistent
- Supabase env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — used consistently across Task A4, D3, D5
- Edge Function URLs follow same pattern: `${VITE_SUPABASE_URL}/functions/v1/<name>`

No drift.
