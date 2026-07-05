# ARCHITECTURE.md

## Tech stack

### Mobile (apps/mobile)

- **Expo SDK 54** with **React Native 0.81.5** (New Architecture enabled by default)
- **React 19.1.0**
- **TypeScript** strict mode
- **Expo Router 6** for file-based navigation
- **NativeWind v4.2** for styling (Tailwind in RN)
- **Zustand** for client state (UI, prefs)
- **TanStack Query v5** for server state
- **WatermelonDB** for offline storage and sync
- **react-hook-form** + **Zod** for forms and validation
- **i18next** + **react-i18next** for localization
- **Reanimated 4** + **Gesture Handler** for interactions
- **Expo Notifications** for push
- **Sentry** for error tracking
- **MMKV** for fast key-value storage (auth tokens, prefs)

### Backend (packages/db + Supabase)

- **Supabase** managed: Postgres 15, Auth, Realtime, Storage, Edge Functions (Deno)
- **PostgREST** for the API surface
- **Row Level Security** on every table — no exceptions
- **Database functions** for balance simplification (PL/pgSQL)

### Payments (packages/payments)

- **bKash** — deep-link/copy handoff only; merchant checkout and in-app money movement are out of scope for the current product and monetization roadmap
- **Nagad** — deep link / USSD copy
- **Mobile subscription billing** — not implemented; any future paid entitlements must use App Store/Play-compliant IAP with server verification and stay separate from settlement handoff/payment processing

### Build & release

- **EAS Build** for iOS + Android binaries
- **EAS Submit** for App Store Connect + Play Console
- **EAS Update** for OTA JS bundles
- **Fastlane** not needed (EAS handles it)

### Monorepo

- **pnpm workspaces**
- **Turborepo** for task orchestration and caching
- **changesets** for version bumps (post-launch)

## Folder structure

```
baki/
├── apps/
│   ├── mobile/                  # The Expo app
│   │   ├── app/                 # Expo Router pages
│   │   │   ├── (auth)/          # auth stack
│   │   │   ├── (tabs)/          # main app tabs
│   │   │   ├── group/[id]/      # group detail
│   │   │   └── _layout.tsx
│   │   ├── src/
│   │   │   ├── components/      # screen-specific components
│   │   │   ├── hooks/
│   │   │   ├── lib/             # supabase client, mmkv, etc.
│   │   │   ├── stores/          # zustand stores
│   │   │   ├── features/        # feature-scoped logic
│   │   │   │   ├── auth/
│   │   │   │   ├── groups/
│   │   │   │   ├── expenses/
│   │   │   │   ├── balances/
│   │   │   │   └── settlement/
│   │   │   └── watermelon/      # WatermelonDB models, schema
│   │   ├── assets/              # fonts, images, icons
│   │   ├── app.config.ts
│   │   ├── eas.json
│   │   └── package.json
│   └── admin/                   # Planned Next.js admin dashboard (v1.5, not scaffolded yet)
├── packages/
│   ├── db/                      # Supabase schema, migrations, types
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── types.ts         # generated Supabase types
│   │   ├── tests/
│   │   ├── seed.sql
│   │   └── package.json
│   ├── ui/                      # shared component library
│   │   ├── src/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Money.tsx
│   │   │   ├── Avatar.tsx
│   │   │   └── theme/
│   │   └── package.json
│   ├── i18n/                    # translation catalogs
│   │   ├── src/
│   │   │   ├── bn.json
│   │   │   ├── en.json
│   │   │   └── index.ts
│   │   └── package.json
│   ├── payments/                # bKash, Nagad wrappers
│   │   ├── src/
│   │   │   ├── bkash.ts
│   │   │   ├── nagad.ts
│   │   │   └── types.ts
│   │   └── package.json
│   └── config/                  # shared eslint, tsconfig
├── .claude/
│   └── agents/                  # Claude Code subagent definitions
├── docs/
├── AGENTS.md
├── CLAUDE.md
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Data flow

```
[ UI (screen) ]
       |
       v
[ TanStack Query hook ] -- reads/writes -->  [ Supabase via PostgREST ]
       |                                              |
       v                                              v
[ WatermelonDB (local) ] <-- sync engine -- [ Supabase Realtime ]
```

- **Reads:** TanStack Query, with WatermelonDB as the offline cache. On mount, hydrate from WatermelonDB instantly, then fetch from Supabase to refresh.
- **Writes:** validated RPC first for group lifecycle and money-changing actions. Temporary network/RPC failures are saved in the MMKV mutation queue with the same client mutation id and replayed through RPCs; WatermelonDB is the read/cache fallback for the current trusted-tester app.
- **Conflicts:** last-write-wins by `updated_at`, with the loser's edit preserved in the activity feed as "previous version".

## Auth flow

1. User enters BD phone number (+880 prefilled)
2. Supabase Auth sends OTP via configured SMS provider
3. User enters 6-digit OTP
4. Supabase returns session JWT
5. JWT stored in MMKV, attached to every Supabase client request
6. On first sign-in, prompt for display name and optional avatar → upsert to `public.profiles`

## State management split

- **TanStack Query** — server data (groups, expenses, balances, profiles)
- **Zustand** — UI state (selected tab, modal visibility, draft expense)
- **WatermelonDB** — offline cache + mutation queue
- **MMKV** — auth tokens, user preferences, feature flags

## Money handling

- Stored as **integer paisa** everywhere (1 BDT = 100 paisa)
- Never use floats for money
- Format with a `<Money />` component that respects locale numerals
- All split-math operations round at the last step using banker's rounding; any remainder paisa is assigned to the payer

## Naming conventions

- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Stores: `useXxxStore` (Zustand)
- Supabase tables: `snake_case`, plural (`expenses`, `group_members`)
- Translation keys: `dot.notation` grouped by feature (`expenses.add.title`)

## Testing strategy

- **Unit (Vitest)** — split math, balance simplification, formatters
- **Component (React Native Testing Library)** — critical UI components
- **E2E (Maestro)** — auth, create group, add expense, settle
- **RLS (pgTAP or custom)** — every policy verified with at least two users

## Quality gates (CI)

- Lint (ESLint + Prettier)
- Typecheck (`tsc --noEmit`)
- Unit tests
- i18n key parity check (every `bn` key has an `en` key and vice versa)
- Database verification (`pnpm db:check`, backed by the DB test suite)
- (Optional until hosted green) EAS preview / preview-E2E build
