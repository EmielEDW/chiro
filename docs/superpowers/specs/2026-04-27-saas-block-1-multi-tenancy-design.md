# SaaS Block 1 — Multi-Tenancy Infrastructure — Design

**Datum:** 2026-04-27
**Status:** Approved (sections 1–5)
**Project context:** Onderdeel 1 van 4 in de productisering van de Chirobar PWA naar een verkoopbaar SaaS-product voor jeugdbewegingen + bedrijven.

## Probleem

De huidige Chirobar PWA is single-tenant: hardcoded voor één Chiro, met vaste branding (`#e94560`, Chiro-logo, "Chiro Bar" strings) en één Supabase project waar alle data van die ene organisatie woont. Om aan andere klanten te kunnen verkopen moet de codebase getransformeerd naar multi-tenant: meerdere onafhankelijke organisaties op één deployment, met geïsoleerde data, eigen subdomein en eigen admin-account.

Dit is **Blok 1 van 4**. Volgende blokken: per-org branding (Blok 2), Stripe Connect met 3% application fee (Blok 3), divergence-features zoals top_up_mode + CSV exports + GDPR DPA (Blok 4).

## Doelen (Blok 1)

1. Eén nieuwe codebase (fork van `chiro/` naar `baraccount/`) die meerdere organisaties tegelijk serveert via subdomain-routing (`<slug>.baraccount.com`).
2. Volledige data-isolatie tussen orgs via PostgreSQL RLS.
3. Open self-serve signup: iemand vult een form in op `baraccount.com/signup` → 60 seconden later is hun org live op `<slug>.baraccount.com`.
4. Member-invites: admin nodigt teamleden uit via email; invitee landt direct in de juiste org na klik op invite-link.
5. Alle bestaande Chirobar-features (drinkjes loggen, voorraad, herbevoorrading, audits, categorieën, gast-modus) werken org-geïsoleerd.
6. Chirobar-deployment blijft live op zijn eigen Supabase + Vercel/host. Geen migratie van bestaande Chiro-data in Blok 1.

## Niet-doelen (Blok 1)

- White-label branding UI (logo upload, kleur picker per org) — Blok 2.
- Stripe Connect, application fee, payouts naar org-bankrekeningen — Blok 3.
- `top_up_mode` (admin-credit vs self-pay), CSV exports, GDPR DPA, EU region keuze — Blok 4.
- Multi-org membership (één user = meerdere orgs) — out of scope, ooit als product groeit.
- Migratie van Chirobar's bestaande data naar de nieuwe SaaS — uitgesteld, mogelijk Blok 5 of nooit (Chiro blijft op standalone deployment).
- SSO / SAML voor enterprise — uitgesteld tot eerste betalende bedrijfsklant het vraagt.

## Design

### 1. Data model

#### Nieuwe tabel `organizations`

| Kolom | Type | Beschrijving |
|---|---|---|
| `id` | `uuid` PK DEFAULT `gen_random_uuid()` | Auto-generated |
| `slug` | `text` UNIQUE NOT NULL | Subdomain prefix. Lowercase, regex `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, 3-30 chars. |
| `name` | `text` NOT NULL | Display name |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |
| `active` | `boolean` NOT NULL DEFAULT `true` | Soft-delete vlag |

`CHECK (slug NOT IN ('www','app','api','admin','mail','support','docs','blog','status','static','assets'))` voor reserved slugs (zelfde lijst ook in app-validatie).

Geen `owner_id`-kolom: admins worden afgeleid uit `profiles WHERE role='admin' AND organization_id=org.id`. Een org kan meerdere admins hebben.

#### Nieuwe tabel `invitations`

| Kolom | Type | Beschrijving |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` NOT NULL FK → `organizations(id)` | |
| `email` | `text` NOT NULL | |
| `role` | `user_role` NOT NULL | `user`/`treasurer`/`admin` |
| `token` | `text` UNIQUE NOT NULL | Cryptographically random, 32+ chars |
| `expires_at` | `timestamptz` NOT NULL | Default now() + 7 days |
| `status` | `text` NOT NULL DEFAULT `'pending'` CHECK in `('pending','accepted','cancelled','expired')` | |
| `created_by` | `uuid` NOT NULL FK → `profiles(id)` | |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | |

Index op `(organization_id, status)` en op `token`.

#### `organization_id` toegevoegd aan bestaande tabellen

Alle org-scoped tabellen krijgen `organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT`:

- `profiles` (1-op-1: elke profile hoort bij exact één org)
- `items`, `consumptions`, `top_ups`, `adjustments`, `categories`
- `restock_sessions`, `restock_items`
- `stock_transactions`, `stock_audits`, `stock_audit_items`
- `user_favorites`, `audit_logs`, `events`, `guest_sessions`
- `notifications` (verifiëren dat tabel bestaat tijdens implementation)

Tabellen die GEEN `organization_id` krijgen:
- `auth.users` (Supabase managed, blijft globaal)
- `transaction_reversals` (org-scope volgt indirect via gekoppelde transactie — deze tabel staat sowieso al op `original_transaction_id`)

`ON DELETE RESTRICT`: een org kan pas verwijderd worden als alle child-data weg is. Voorkomt cascading data-loss bij admin-foutje. Voor "klant zegt op": `organizations.active = false` (soft delete), data blijft staan.

#### Categories: PK refactor van slug → UUID

In de single-tenant Chirobar is `categories.slug` de PK en `items.category` is text-FK naar die slug. In multi-tenant moet de uniqueness van slug per-org zijn (twee orgs mogen elk een "frisdranken" hebben).

Refactor naar:
- `categories.id` UUID PK
- `categories.slug` text NOT NULL met `UNIQUE (organization_id, slug)`
- `items.category_id` UUID FK → `categories(id)` (kolom hernoemd van `category` naar `category_id`)
- Drop oude FK constraint `items_category_fkey` (slug-based)
- Code: alle code die `item.category === 'frisdranken'` deed werkt al niet meer rechtstreeks (dynamic categories werd gebouwd) — alleen helpers zoals `bySlug.get(...)` blijven, maar gebruiken nu `byId.get(...)`. Zelfde patroon, andere key.

#### Org-resolution via JWT custom claim

Custom claim `app_metadata.organization_id` op de Supabase `auth.users`. Wordt gezet door de signup-organization Edge Function direct na profile-creation, en door de accept-invite Edge Function na invite-accept.

Eén JWT per user, vast gekoppeld aan hun org. RLS-policies lezen de claim via een SQL-helper:

```sql
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
```

### 2. Subdomain routing & org-resolution

#### DNS

Cloudflare DNS voor `baraccount.com`:
- `A` record voor `baraccount.com` → Cloudflare Pages
- `CNAME` record voor `*.baraccount.com` → `baraccount.pages.dev`

Cloudflare Pages "custom domains": voeg `baraccount.com` én `*.baraccount.com` toe. Wildcard SSL is automatisch.

#### Eén SPA, hostname-based routing

Eén Cloudflare Pages project, één React-build. Bij opstart detecteert de SPA `window.location.hostname`:

| Hostname | Render |
|---|---|
| `baraccount.com` | Marketing landing + `/signup` + "Find your organization" widget |
| `<slug>.baraccount.com` met geldig slug | App, na org-resolution |
| `<slug>.baraccount.com` met onbekend slug | "Org niet gevonden" pagina + link naar root |
| `localhost:5173` | Marketing |
| `<slug>.localhost:5173` | App voor die slug (dev) |

#### Org-resolution flow

Top-level `OrgContext`-provider doet bij elke mount:

1. Parse hostname → extract subdomain
2. Root domain → render marketing (geen org needed, geen Supabase auth-init)
3. Subdomain → fetch `SELECT id, name, slug FROM organizations WHERE slug = $1 AND active = true`
4. Niet gevonden → render "Org niet gevonden"
5. Gevonden → cache org in context, expose via `useOrg()` hook
6. Login-form gebruikt `org.name` in header ("Log in bij {org.name}")

`organizations` SELECT moet werken voor anon (vóór login) — RLS-policy laat publieke SELECT toe.

#### Post-login org-validatie

Na succesvolle login: SPA checkt `profile.organization_id === currentOrg.id`. Niet gelijk → log direct uit met toast. Voorkomt cross-org token-misbruik.

#### Localhost development

`*.localhost` werkt natively in moderne browsers. Update `vite.config.ts`:
```ts
server: {
  host: 'localhost',
  allowedHosts: ['.localhost'],
}
```

### 3. Auth & signup flow

#### Signup op `baraccount.com/signup`

Form-velden: naam, email, wachtwoord (min 8 chars), org-naam, slug.

Real-time slug-availability check (debounced) via Edge Function `check-slug-availability`.

Submit → Edge Function `signup-organization` (gebruikt `service_role`):

1. Validate slug format + reserved-list + availability
2. `auth.admin.createUser({ email, password, email_confirm: false })` → creëert auth.user
3. `INSERT INTO organizations (slug, name)` → creëert org
4. `INSERT INTO profiles (id, name, role='admin', organization_id)` → koppelt user als admin
5. Seed 5 default-categorieën in deze org (Frisdranken/Bieren/Sterke dranken/Chips/Andere)
6. `auth.admin.updateUserById(userId, { app_metadata: { organization_id } })` → JWT-claim
7. Trigger Supabase email-verificatie

Heel de flow in één Postgres-transaction (behalve Supabase admin API calls die idempotent gemaakt worden — bij failure expliciet user deleten via admin API).

Returns `{ subdomain, email_verification_sent: true }`. UI toont uitleg + "Check je inbox".

#### Email verificatie

Aan in Supabase project settings. Verification-link → `https://<slug>.baraccount.com/auth/confirm?token=...` → bevestigd → redirect naar login.

#### Login op `<slug>.baraccount.com/login`

- Standaard email + password form, branded met `org.name` in header
- Bij success: post-login org-validatie (zie boven)
- Redirect naar app-startpagina

#### Password reset

`resetPasswordForEmail()` op subdomain-login. Reset-link → `<slug>.baraccount.com/reset-password?token=...`.

#### Geen `/login` op root

Op `baraccount.com` enkel marketing + signup + "Find your organization"-widget (autocomplete uit `organizations` tabel).

#### Member-invites

Admin in admin-panel "Leden"-sectie:
- Form met email + role
- Backend: `INSERT INTO invitations (...)` met token, expires_at = now() + 7 days
- Email via Supabase: link `<slug>.baraccount.com/accept-invite?token=xxx`

Admin ziet ook tabel met outstanding invites + "Resend" + "Cancel" knoppen.

Invitee klikt link → form met naam + wachtwoord (geen email — die zit in invite, geen subdomain — die zit in URL):

Edge Function `accept-invite`:

1. Validate token: bestaat, niet expired, status=pending
2. Check: email niet al in een andere org → error *"Dit emailadres is al gekoppeld aan een andere organisatie."*
3. `auth.admin.createUser({ email, password, email_confirm: true })` (geen extra verificatie — invite IS de verificatie)
4. `INSERT INTO profiles` met role uit invite
5. Update JWT-claim met org_id
6. Mark invitation status=accepted
7. Returns success → redirect naar `<slug>.baraccount.com/`

### 4. RLS strategy

Alle org-scoped tabellen krijgen dit pattern (voorbeeld voor `items`):

```sql
DROP POLICY IF EXISTS ... old policies ...;

CREATE POLICY "Members can view org items"
ON public.items FOR SELECT
USING (organization_id = public.current_organization_id());

CREATE POLICY "Admins can manage org items"
ON public.items FOR ALL
USING (
  organization_id = public.current_organization_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
      AND organization_id = public.current_organization_id()
  )
);
```

Speciale gevallen:

- **`organizations`:** SELECT toegelaten voor `anon` + `authenticated` (voor org-resolution vóór login). UPDATE/DELETE alleen door admins van die org.
- **`profiles`:** users zien hun eigen profile + alle profiles in hun org. Admins kunnen profiles in hun org wijzigen. Geen cross-org read.
- **`invitations`:** alleen admins van de org kunnen lezen/aanmaken/wijzigen. Anonymous SELECT op token gebeurt enkel via Edge Function (niet via REST).
- **`auth.users`:** Supabase managed, niet aanraken.

#### Defense in depth

Edge Functions die schrijfacties doen valideren `organization_id` uit de JWT-claim, niet uit user-input. Voorkomt dat malafide client een vreemd org-id meegeeft. RLS vangt het ook af, maar dubbel-check is veiliger.

### 5. Chiro-strip + migratie-volgorde

#### Wat uit de fork weg moet

| Wat | Locatie | Vervang door |
|---|---|---|
| Chiro logo | `public/lovable-uploads/11df38ab-3cdc-4bfc-8e71-a51ec8bef666.png` (en alle andere lovable-uploads) | Verwijder map; placeholder-logo (generieke "B" letter SVG) |
| Primary kleur `#e94560` | `src/index.css` HSL CSS-variabelen | Tailwind `blue-600` als generic default. Block 2 maakt per-org instelbaar. |
| App-naam "Chiro Bar" / "ChiroBar" | Hardcoded in component-strings, page titles, README, package.json | Gebruik `useOrg().name`; root marketing-site gebruikt "baraccount" als merknaam |
| Chiro-thema'd welkom-strings | `src/components/*` en pages | Generic strings met `{org.name}` substitutie |
| `lovable-tagger` plugin | `vite.config.ts` | Verwijderen (was Lovable-platform-specifiek) |
| Seed-data `INSERT INTO items` | Migration `20250825162029_*.sql` lijnen 61-68 | Verwijderen — orgs starten leeg |
| Seed-data `INSERT INTO categories` | Migration `20260427090000_create_categories_table.sql` | Verwijderen uit migration; signup-organization Edge Function seedt per org |

#### Volgorde van werk binnen Blok 1

**Fase A — Setup (eenmalig)**
1. Fork `chiro/` → `c:\Users\Emiel\My Drive\07-tech-en-software\scripts-en-code\rep-baraccount\baraccount\`
2. Strip chiro-specifieke branding + assets + seeds
3. Provision nieuwe Supabase project in `eu-west-1`
4. Setup Cloudflare Pages: connect repo, custom domains
5. Setup Cloudflare DNS: A-record + wildcard CNAME

**Fase B — Database migraties (op nieuwe Supabase project, schone slate)**
6. Run alle bestaande chiro-migraties in volgorde (zonder seeds)
7. Migration: `organizations` + `invitations` tabellen
8. Migration: `organization_id` kolom (nullable initially) op alle org-scoped tabellen
9. Migration: refactor categories naar UUID PK + per-org unique slug + update `items.category_id` FK
10. Migration: `current_organization_id()` helper + alle RLS-policies herschrijven
11. Migration: `organization_id` `NOT NULL` zetten

**Fase C — Edge Functions**
12. `check-slug-availability` (GET, public)
13. `signup-organization` (POST, public, atomic flow)
14. `accept-invite` (POST, public, atomic flow)

**Fase D — Frontend**
15. Hostname-detection + `OrgContext` provider
16. Marketing landing-page (root domain) — minimal
17. Signup-pagina + slug-availability live-check
18. Login-pagina updates (org branding + post-login validatie)
19. Accept-invite pagina
20. Admin-panel: nieuwe "Leden" sectie met invite-form + outstanding-invites tabel
21. Strip alle hardcoded "Chiro" → vervang met `useOrg().name`

**Fase E — Smoke testing**
22. Sign up "test-club" → land op `test-club.baraccount.com` → kan inloggen, items toevoegen, drankjes loggen
23. Sign up "demo-acme" → totaal isolated, geen overlap
24. Invite tweede user vanuit test-club → accept-flow werkt
25. Cross-org test: log in op `test-club.baraccount.com`, kopieer JWT, navigeer naar `acme.baraccount.com` → krijgt logout
26. RLS-test: probeer met REST API rechtstreeks data uit andere org te SELECTen → 0 rows

## Verificatie

Na Blok 1:

- ✅ `baraccount.com/signup` werkt: vul form in, krijg verificatie-email, log in op subdomain
- ✅ Twee orgs aangemaakt, géén data-overlap (RLS test via SQL)
- ✅ Member-invite werkt end-to-end (verstuur, ontvang email, accept, ingelogd)
- ✅ Cross-org JWT misbruik wordt geblokkeerd door post-login validatie
- ✅ Wildcard DNS + SSL werkt op Cloudflare Pages
- ✅ Geen "Chiro" string meer in de app (grep komt 0 hits op)
- ✅ Default-branding ziet er neutraal uit (geen pink/red, geen Chiro-logo)
- ✅ Bestaande Chirobar-features (drinkjes, voorraad, audits, categorieën, gast-modus) werken in een nieuwe org
- ✅ Chirobar's standalone deployment is **niet** geraakt (parallelle codebase)

## Risico's

- **JWT-claim niet up-to-date na signup:** Supabase JWT's worden gerefreshed bij volgende sessie-init, dus directe redirect-na-signup werkt mogelijk niet zonder force-refresh. Mitigatie: na signup Edge Function force-sign-out → user logt opnieuw in op subdomain → fresh JWT met claim.

- **Wildcard SSL latency:** Cloudflare wildcard cert provisioning kan tot een paar uur duren bij eerste setup. Mitigatie: setup Cloudflare ruim voor je eerste klant vooraankondigt.

- **Reserved slug enumeration:** Iemand zou kunnen brute-forcen welke slugs gebruikt zijn via de availability-check API. Mitigatie: rate-limiting op `check-slug-availability` Edge Function (Supabase ondersteunt dit niet native — zelf in de function een simpele in-memory rate-limit per IP). Niet kritisch want org-namen zijn semi-publiek.

- **RLS-policy bug = data leak:** Eén foute policy kan cross-org data lekken. Mitigatie: in Fase E expliciete cross-org SELECT-tests; eventueel een unit-test-script dat per tabel een dummy SELECT met fake org-claim probeert.

- **Email-verificatie spam-filtering:** Supabase's default email-sender komt soms in spam. Mitigatie: configure custom SMTP (SendGrid/Postmark/Resend) zodra je eerste klant signup-issues meldt. Niet voor MVP.

- **Default-categorieën-seed in Edge Function kan falen na org-creation:** Als org gecreëerd is maar seed faalt, heeft admin lege categorieën-lijst. Mitigatie: seed binnen dezelfde Postgres transaction als org-creation. Bij failure: rollback alles.

## Out of scope (toekomstige blokken — referentie)

- **Blok 2:** Per-org branding settings (logo upload naar Supabase Storage, primary_color picker, name editing). UI in admin-panel. Nieuwe `organization_settings` tabel.
- **Blok 3:** Stripe Connect Express. Per-org connected account onboarding (KYC). Application fee 3% op alle top-ups via `application_fee_amount` parameter. Webhook voor payout tracking.
- **Blok 4:** `top_up_mode` setting (self / admin_credit / both). CSV exports per maand. EU region commitment + GDPR DPA template. Eventuele monthly billing minimum.
- **Niet gepland:** Multi-org membership, SSO/SAML, Chiro-data migratie naar SaaS, mobile native apps, multi-currency.
