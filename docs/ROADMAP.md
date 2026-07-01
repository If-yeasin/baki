# ROADMAP.md

## Phases

### Phase 0 — Bootstrap (Week 0)

Codex executes the bootstrap prompt; project scaffolds, dependencies install, Supabase project created, schema migrated, subagents wired, first build runs locally.

**Deliverable:** `pnpm --filter mobile dev` opens the app on the iOS Simulator showing a placeholder home screen.

### Phase 1 — Foundations (Weeks 1–2)

- Design system: tokens, typography, base components (`packages/ui`)
- i18n scaffolding with `bn` and `en` catalogs
- Auth (F1): phone OTP, profile creation, persisted session
- Supabase schema fully migrated, RLS verified with two test users
- WatermelonDB schema + sync engine wired (empty entities)

**Exit criteria:** new user can sign up via phone OTP, see an empty home with a "Create your first khata" CTA.

### Phase 2 — Groups & Expenses (Weeks 3–4)

- F2 Groups: create, join via invite, list
- F3 Expenses: add, edit, delete, all four split methods
- F8 Offline: end-to-end offline create-expense path
- Activity log writes (no UI yet)

**Exit criteria:** two devices can join one group, both add expenses offline, sync converges correctly when online.

### Phase 3 — Balances & Settlement (Weeks 5–6)

- F4 Balances: per-group and all-groups views, simplification algorithm
- F5 Settlement: bKash and Nagad deep links, cash fallback
- F6 Activity feed UI

**Exit criteria:** a friend group can run a real Sajek trip through the app end-to-end (add expenses, see balances, settle via bKash deep link, verify ledger zeros out).

### Phase 4 — Notifications & Polish (Week 7)

- F7 Push notifications wired
- F9 Localization sweep — all copy reviewed by native Bengali speaker
- F10 Settings screen
- Accessibility audit (VoiceOver, dynamic type)
- Empty states + illustrations
- Performance pass (list virtualization, image lazy-load, MMKV migration of hot reads)

**Exit criteria:** TestFlight beta to 20 invited users (friends, family, mess-mates).

### Phase 5 — iOS launch (Week 8)

- Bug bash from beta feedback
- App Store metadata (BN + EN), screenshots in both languages, preview video
- Privacy nutrition labels filled accurately
- Submit to App Store
- Launch announcement: Facebook, BUET/NSU groups, friend WhatsApp

**Exit criteria:** ✅ Live on the App Store.

### Phase 6 — Android (Weeks 9–12)

- Test on a range of Android devices (Xiaomi, Samsung mid-range, Oppo, Walton — common in BD)
- Fix Android-specific issues (back-button behavior, deep-link intents for bKash, Material elevation tuning)
- Play Console setup, internal testing track → closed testing → production
- Play Store metadata (BN + EN)

**Exit criteria:** ✅ Live on the Play Store.

### Phase 7 — Post-launch v1.1+

- Receipt OCR (Google ML Kit / Vision)
- Recurring expenses
- bKash merchant API (requires business onboarding)
- Web app (Next.js, shares `packages/db` and `packages/i18n`)
- Admin dashboard (`apps/admin`) for support
- Multi-currency for users with international groups
- Friends without groups (1:1 ledgers)
- Group photo uploads, expense comments

## Stretch ideas (not committed)

- WhatsApp bot to add expenses ("baki" mention in a group → opens app prefilled)
- Voice input ("আমি ৩৫০ টাকা দিয়েছি চা-নাস্তা")
- Iftar/Eid templates with auto-included categories
- Mess-manager monthly closing flow with auto-rotation

## Time budget assumption

- Solo founder (you) + AI agents doing implementation
- 12–16 active hours/week
- 8 weeks to App Store is aggressive but doable with the scope locked to FEATURES.md

## What I will not do, even if asked

- Crypto/blockchain integration — not relevant to the audience
- Investment/savings features — scope creep, regulated territory
- Social feed / comments on expenses (initially) — distracts from the ledger purpose
- AI auto-categorization in v1 — adds complexity without proven retention impact
