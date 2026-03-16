# Chiro Bar - Project Context

## Project

PWA voor het beheer van een Chiro-bar. Leden kunnen drankjes loggen via hun account, hun saldo bekijken en aanvullen. Admins beheren producten, voorraad, gebruikers en financiën.

## Tech Stack

- **React 18** + **TypeScript** (strict: false)
- **Vite** (dev op poort 8080, SWC plugin)
- **Tailwind CSS v3** + **shadcn/ui** (Radix UI)
- **TanStack React Query v5** – data fetching & caching
- **Supabase** – database (PostgreSQL), auth, edge functions
- **React Router v6** – client-side routing

## Commands

```bash
npm run dev       # development server op poort 8080
npm run build     # production build
npm run lint      # ESLint
npm run preview   # preview production build
```

## Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui components (niet handmatig aanpassen)
│   ├── admin/        # admin-specifieke componenten
│   └── *.tsx         # feature components
├── pages/            # route-level componenten
├── hooks/            # useAuth, useProfile, use-mobile, use-toast
├── integrations/
│   └── supabase/
│       ├── client.ts # Supabase client (auto-generated, niet aanpassen)
│       └── types.ts  # database types (auto-generated, niet aanpassen)
├── lib/
│   ├── auth.ts       # auth utilities
│   └── utils.ts      # cn() voor Tailwind class merging
supabase/
├── functions/        # Edge Functions (Deno)
└── migrations/       # SQL migraties
```

## Routing & Auth

- Alle routes behalve `/auth` en `/guest/:id` zijn protected via `<ProtectedRoute>`
- Rollen: `user` | `treasurer` | `admin`
- Auth state via `useAuth()` hook (AuthContext)
- Profiel & saldo via `useProfile()` hook

## Database

Hoofd-tabellen in Supabase:
- `profiles` – users met rol, saldo, active-vlag
- `items` – producten (price_cents, stock_quantity, categorie)
- `consumptions` – transacties (drankjes gelogd)
- `top_ups` – saldo aanvullingen (Stripe)
- `adjustments` – handmatige saldo-aanpassingen
- `guest_sessions` – tijdelijke gast-sessies

Saldo = top_ups (paid) + adjustments - consumptions

## Styling Conventions

- Tailwind utility classes, HSL CSS variabelen in `src/index.css`
- Custom klassen: `.glass`, `.glass-button`, `.glass-nav` (glassmorphism)
- Dark mode via `class` strategie (`dark:` prefix)
- Primary kleur: `#e94560` (roze/rood)
- Mobile-first responsive design; `useIsMobile()` voor mobiel-specifieke layouts

## Data Fetching Patterns

```tsx
// Query
const { data, isLoading } = useQuery({
  queryKey: ['items'],
  queryFn: () => supabase.from('items').select('*')
})

// Mutation + invalidate
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: ...,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] })
})
```

Veelgebruikte query keys: `['items']`, `['profile', userId]`, `['balance', userId]`, `['favorites', userId]`

## Supabase Edge Functions

Staan in `supabase/functions/`. Draaien als Deno-functies:
- `create-payment` / `verify-payment` – Stripe betaling
- `create-guest-payment` / `admin-settle-guest` – gast afrekenen
- `create-temp-guest` – tijdelijk gast aanmaken
- `delete-user` – gebruiker verwijderen

## Naming Conventions

- Components: `PascalCase`
- Hooks: `useNaam`
- Bestanden: matchen met component/functienaam
- camelCase voor functies en variabelen

## Product Categorieën

`frisdranken` | `bieren` | `sterke_dranken` | `mixed_drinks` | `chips` | `andere`

## Taal

UI is in het **Nederlands**. Houd dat aan in alle user-facing strings.

## Niet aanpassen

- `src/integrations/supabase/client.ts` en `types.ts` – auto-generated door Supabase CLI
- `src/components/ui/` – shadcn/ui library; voeg enkel toe via `npx shadcn-ui add`
