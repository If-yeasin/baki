# বাকি (Baki)

Your digital ledger for shared expenses in Bangladesh.

বাকি is an iOS-first, Bengali-first expense-sharing app for mess bills, family costs, trips, events, and flatmates. It uses Expo, Supabase, WatermelonDB, and bKash/Nagad deep-link settlement.

## Quick Start

```bash
pnpm install
pnpm --filter mobile dev
```

## Workspace

- `apps/mobile` — Expo app
- `packages/db` — Supabase schema, migrations, seed data, generated types
- `packages/ui` — shared UI primitives and theme
- `packages/i18n` — Bengali and English translation catalogs
- `packages/payments` — bKash/Nagad helper layer
- `packages/config` — shared TypeScript, ESLint, and Prettier config

Read `AGENTS.md` and `docs/` before changing product behavior.
