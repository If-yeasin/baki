# CLAUDE.md

This file is the Claude Code entry point for the বাকি (Baki) project. Its contents mirror `AGENTS.md` (Codex's convention). **Read `AGENTS.md` first, then every file in `docs/`, then start with `TASKS.md`.**

When in doubt, check the corresponding `docs/*.md` rather than guessing. If a decision is missing from the docs, ask the user before writing code — do not invent product behavior.

## Subagents available

Subagent definitions live in `.claude/agents/`:

- `mobile-engineer` — React Native / Expo
- `backend-engineer` — Supabase schema, RLS, edge functions
- `payments-engineer` — bKash/Nagad MFS handoff, settlement UX, non-custodial payment boundary
- `design-system-engineer` — theme, components, i18n
- `release-engineer` — EAS, App Store, Play Console

Dispatch by domain. For cross-cutting features, plan the slice in the orchestrator session, then delegate the slice to each subagent in dependency order.

## Common commands

```bash
# Install
pnpm install

# Dev server (Expo)
pnpm --filter mobile dev

# Generate Supabase types
pnpm --filter db gen:types

# Run migrations against local Supabase
pnpm --filter db migrate

# Lint + typecheck everything
pnpm lint && pnpm typecheck

# Unit tests
pnpm test

# Maestro flows
pnpm e2e

# iOS preview build via EAS
pnpm --filter mobile build:ios:preview
```

## Conventions enforced in this repo

- TypeScript strict, no `any` without an inline justification comment
- All user-facing strings go through `useTranslation()`, never inline
- All Supabase queries go through generated types from `packages/db`
- All forms use react-hook-form + Zod
- Money is always stored as integer paisa (১ paisa = 0.01 BDT), formatted at the render layer
- Dates stored as UTC ISO strings, rendered in Asia/Dhaka

See `AGENTS.md` for the full operating principles.
