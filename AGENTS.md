# AGENTS.md — বাকি (Baki)

> This file is the entry point for any AI agent (Codex, Claude Code, or otherwise) working on this codebase. Read this first, then every file in `docs/` before writing a single line of code.

## 1. Project identity

**Name:** বাকি (Baki)
**Tagline:** আপনার বাকির ডিজিটাল খাতা — Your digital ledger for shared expenses.
**One-liner:** A Splitwise-style expense-sharing app built natively for Bangladesh, with bKash/Nagad settlement, Bengali-first UI, and offline-first ledgers.
**Primary platform (v1):** iOS (App Store)
**Secondary platform (v1.1):** Android (Play Store)
**Locale:** Bangladesh, Bengali default + English toggle
**Currency:** BDT (৳)

## 2. Why "বাকি"

In Bangladesh, বাকি is the everyday word for outstanding balance. The corner-shop খাতা, the friend who owes you for last week's iftar, the cousin who still hasn't paid back his share of the Sajek trip. The word does the marketing for us — no translation, no explanation. The product is a digital khata.

## 3. Read these documents before doing anything

1. `docs/PRD.md` — what we are building and for whom
2. `docs/FEATURES.md` — MVP feature breakdown
3. `docs/ARCHITECTURE.md` — tech stack, folder structure, conventions
4. `docs/DATA_MODEL.md` — Supabase schema and RLS policies
5. `docs/DESIGN_SYSTEM.md` — colors, typography, components
6. `docs/BANGLADESH_CONTEXT.md` — bKash/Nagad, Bengali, cultural patterns
7. `docs/ROADMAP.md` — phased delivery iOS → Android
8. `docs/SETUP.md` — environment, secrets, build pipeline

## 4. Operating principles for AI agents

- **Bengali is the default language.** Every user-facing string ships in both `bn` and `en`. No hardcoded English in the UI tree.
- **Offline-first is non-negotiable.** Users in Rangamati or a Comilla village on patchy 2G must be able to add expenses and see balances. WatermelonDB local, Supabase remote, sync on connectivity.
- **bKash/Nagad first, card last.** Settlement UX assumes mobile financial services (MFS) are the default. Card/bank transfer is a fallback, not the headline.
- **Trust the corner-shop metaphor.** Every screen should feel as obvious as a khata. If a screen needs a tooltip to be understood, redesign it.
- **Type-safe end to end.** TypeScript strict, generated Supabase types, Zod at every boundary (forms, API responses, deep links).
- **Test what would hurt to break.** Split math, balance simplification, MFS deep links, sync conflict resolution. Snapshot tests for UI, unit tests for logic, Maestro flows for the critical path.
- **No silent failures.** Every error path either retries, surfaces a localized message, or logs to Sentry with context.

## 5. Multi-agent workflow

This project uses Claude Code subagents defined in `.claude/agents/`. Each subagent owns a slice of the codebase. The orchestrator (the main Claude Code session) delegates by topic:

| Subagent | Owns |
|---|---|
| `mobile-engineer` | React Native / Expo app, screens, navigation, hooks |
| `backend-engineer` | Supabase schema, migrations, RLS, edge functions |
| `payments-engineer` | bKash, Nagad, Stripe integration, settlement flows |
| `design-system-engineer` | Theme tokens, NativeWind config, reusable components, i18n |
| `release-engineer` | EAS build/submit, App Store Connect, Play Console, CI |

When a task spans multiple domains, the orchestrator decomposes it and dispatches in sequence (backend schema → mobile UI → release plumbing).

## 6. Definition of done

A feature is done when:

1. Bengali + English strings exist and render correctly
2. Offline path works (airplane mode test)
3. RLS policies prevent cross-group data leaks (verified with a second test user)
4. Unit tests cover the split/balance math
5. Maestro flow added or updated for the critical user journey
6. EAS preview build (iOS) runs on a physical device
7. No TypeScript errors, no ESLint errors, no untranslated strings

## 7. What you must never do

- Never hardcode user-facing strings — always go through `i18next`
- Never bypass RLS by using the service-role key on the client
- Never store bKash/Nagad numbers or transaction IDs in plaintext logs
- Never assume the user has stable internet — every fetch needs offline fallback
- Never ship a screen without testing the long-Bengali-string overflow case
- Never invent a Supabase column — update `docs/DATA_MODEL.md` first, then migrate

## 8. Quick orientation

- Monorepo root, managed with pnpm workspaces + Turborepo
- `apps/mobile` — Expo app (the product)
- `apps/admin` — Next.js admin (v1.5, post-launch)
- `packages/db` — Supabase schema, migrations, generated types
- `packages/ui` — shared components (cross-platform later)
- `packages/i18n` — translation catalogs (`bn.json`, `en.json`)
- `packages/payments` — bKash/Nagad SDK wrappers

See `docs/ARCHITECTURE.md` for the full tree.
