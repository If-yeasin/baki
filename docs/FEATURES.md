# FEATURES.md — MVP scope for v1.0

> Anything not in this document is out of scope for v1. New ideas go in `ROADMAP.md` under v1.1 or later.

## F1. Authentication

- Phone number sign-up (Bangladeshi numbers, +880 default)
- SMS OTP via Supabase Auth (provider: a Bangladesh-compatible SMS gateway, e.g., SSL Wireless or Twilio with BD SMS support)
- Profile: display name, optional avatar, default currency BDT
- No email, no password, no social login in v1
- Delete account flow (Apple requirement)

## F2. Groups (খাতা)

- Create group with name + template
- Templates: `mess`, `family`, `trip`, `event`, `custom`
- Invite via shareable link or 6-character code
- Members: max 50 per group
- Group settings: rename, archive, leave, delete (only by creator if no outstanding balances)
- Group avatar (auto-generated from name initials, customizable)

## F3. Expenses

- Add expense: amount (BDT), description, category, paid-by, split-among, split-method, date, optional note
- Categories: food, rent, utility, transport, entertainment, shopping, medical, education, gift, other
- Split methods:
  - **Equal** — divide evenly among selected members
  - **Exact** — specify exact amount per person
  - **Percent** — specify percent per person (must sum to 100)
  - **Shares** — specify "shares" per person (e.g., 2:1:1)
- Edit and delete (with confirmation; reflected in audit trail)
- Attach a photo (receipt) — optional, stored in Supabase Storage

## F4. Balances

- Group view: net balance per member ("Tanvir owes you ৳450")
- "All groups" view: total net across all groups
- Simplified debts algorithm (minimize number of transactions to settle)
- Toggle: simplified view vs. raw debts view

## F5. Settlement

- Tap "Settle up" on a balance → choose method
- Methods (v1):
  - **bKash send money** — deep link `bkashopen://send?amount=X&number=Y` (verify exact scheme; fall back to web)
  - **Nagad send money** — deep link or USSD copy-to-clipboard
  - **Cash** — manual mark-as-paid
- After confirming, expense is logged as a "settlement" transaction (not deleted)
- Push notification to the other party: "Tanvir marked ৳450 as paid via bKash"

## F6. Activity feed

- Per-group chronological feed of all events: expense added, edited, deleted, settled, member joined, member left
- Each event shows who, what, when (Asia/Dhaka), and net effect on balances
- Pull-to-refresh, infinite scroll

## F7. Notifications

- Push (Expo Notifications):
  - New expense added in your group
  - Someone settled with you
  - Someone joined your group via invite link
  - Reminder: "You haven't settled ৳X with Rini for 14 days"
- Per-user notification preferences

## F8. Offline-first

- WatermelonDB local store mirrors core tables (groups, members, expenses, balances)
- Add/edit/delete expense works offline; queues mutations
- Sync on connectivity restore; conflict resolution: last-write-wins with audit trail
- Visual sync indicator in the header

## F9. Localization

- Bengali (default) and English
- Toggle in Settings → Language
- Numbers: render Bengali numerals when locale is `bn` (০১২৩৪৫৬৭৮৯)
- Dates: relative ("আজ", "গতকাল", "৩ দিন আগে") with absolute fallback
- All copy reviewed by a native Bengali speaker before launch

## F10. Settings

- Profile (name, avatar, phone)
- Language toggle
- Notification preferences
- Theme (light / dark / system)
- Export group data as CSV (sent via email)
- Delete account
- About / privacy / terms / support contact

## Feature priorities — build order

The dependency-aware build sequence the agents should follow:

1. **F1 Auth** — foundation, blocks everything
2. **Design system** — tokens, components, i18n scaffolding
3. **F2 Groups** + **F8 Offline** scaffolding — core data model live
4. **F3 Expenses** — the main interaction
5. **F4 Balances** — the math, including simplification algorithm
6. **F6 Activity feed** — gives the app "weight"
7. **F5 Settlement** — bKash/Nagad deep links
8. **F7 Notifications** — push setup
9. **F9 Localization polish** — final copy review
10. **F10 Settings** — finishing touches
11. **Hardening** — RLS audit, accessibility, App Store metadata

## Trusted tester status — 2026-07-01

| Area             | Status                     | Notes                                                                                                                                                                                         |
| ---------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1 Auth          | Implemented                | Phone OTP/profile path exists; OTP remains manual for Maestro.                                                                                                                                |
| F2 Groups        | Partial                    | Create/join/list exist; offline group-create replay is queued but not drained yet.                                                                                                            |
| F3 Expenses      | Partial                    | Add expense uses `create_expense` with idempotency; temporary RPC failures queue as pending offline saves.                                                                                    |
| F4 Balances      | Implemented for group view | `get_group_balances` remains source of truth, with local ledger fallback.                                                                                                                     |
| F5 Settlement    | Partial                    | `simplify_debts` drives the settle plan; settlement writes queue on temporary failure and record outside-app payment.                                                                         |
| F6 Activity feed | Partial                    | Group and tab activity read real `activity_log`; pagination/pull-to-refresh remain pending.                                                                                                   |
| F7 Notifications | Pending                    | Expo Notifications configured, product notification flows not shipped.                                                                                                                        |
| F8 Offline-first | Partial                    | Expense/settlement mutations queue and replay; temporary failures show saved-offline UX. PR #1 uses an automated-only gate; real-device Dev Client QA remains recommended before public beta. |
| F9 Localization  | Partial                    | BN/EN parity enforced; native Bengali review still required.                                                                                                                                  |
| F10 Settings     | Partial                    | Language/theme/delete-account/sync details exist; export/support/legal links pending.                                                                                                         |
