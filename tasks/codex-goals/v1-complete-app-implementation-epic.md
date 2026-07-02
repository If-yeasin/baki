# Baki v1 Complete App Implementation Epic

## Goal Type

Implementation epic for a future Codex run.

Do not treat this file itself as completion of the goal. The goal described
below is complete only when the required app, backend, offline, notification,
export, QA, release, and store-readiness implementation has landed in code,
passed automated gates, merged to `main`, and produced a passing main CI run.

## Mission

Turn Baki from a release-candidate foundation into a complete v1 closed-beta
app for Bangladesh.

Baki is a Bengali-first shared expense and settlement ledger for Bangladesh.
The repo already has a strong trusted-tester MVP foundation, idempotent money
RPCs, group lifecycle RPCs, offline queue/replay, local cache scaffolding,
preview-only E2E auth, and CI/release-safety checks.

Splitwise-level usability is only a feature-completeness benchmark. Do not copy
Splitwise branding, colors, layouts, copy, icons, illustrations, or exact
screen composition. Preserve Baki's own Bengali-first khata identity, BDT money
model, bKash/Nagad/cash settlement context, and offline-first reliability.

## Required Branch And PR

- Branch: `codex/v1-complete-app-implementation`
- PR target: `main`
- PR title: `Complete Baki v1 app implementation`

Do not work directly on `main`. Create the branch from current `main` before
editing.

## Current Blockers

- Expense edit/delete is missing.
- Receipt attachment is not implemented.
- CSV export is missing.
- Push notification registration, preferences, and server delivery are missing.
- Legal/support/privacy UI is incomplete.
- Activity feed needs pagination, pull-to-refresh, and richer event rendering.
- Failed sync repair/dismiss UX is incomplete.
- Hosted EAS/Maestro preview E2E is optional, not a required gate.
- Store screenshots and store-submission assets are incomplete.

## Non-Negotiable Completion Rule

This goal cannot be completed by documentation only. At minimum, the
implementation must ship:

1. Expense edit/delete end-to-end.
2. CSV export end-to-end.
3. Notification token registration and preferences.
4. Failed sync repair/dismiss UX.
5. Legal/support/privacy settings screens.
6. Activity feed pagination and pull-to-refresh.
7. Expanded automated tests and release-safety checks.
8. Store/screenshot prep updated after implementation.

## Subagents

Use subagents where useful, especially for parallel read-only recon and
domain-specific implementation review:

- `repo-coordinator`
- `backend-ledger-engineer`
- `mobile-feature-engineer`
- `offline-sync-engineer`
- `notifications-engineer`
- `qa-automation-engineer`
- `release-store-engineer`
- `security-privacy-engineer`
- `i18n-accessibility-engineer`

The repo coordinator owns conflict prevention, branch discipline, final
integration status, and the final report.

## Phase 0 - Recon

Before editing code, inspect:

- `AGENTS.md`
- `TASKS.md`
- `docs/FEATURES.md`
- `docs/V1_RELEASE_CANDIDATE_GAP_MAP.md`
- `docs/DATA_MODEL.md`
- `docs/OFFLINE_SYNC.md`
- `docs/QA/AUTOMATED_RELEASE_GATE.md`
- `docs/STORE/APP_STORE_CONNECT.md`
- `docs/STORE/GOOGLE_PLAY.md`
- `docs/STORE/SCREENSHOTS.md`
- `docs/RELEASE_NOTES.md`
- `apps/mobile/app`
- `apps/mobile/src/features`
- `apps/mobile/src/watermelon`
- `packages/db/migrations`
- `packages/db/tests`
- `packages/i18n/src`
- `e2e/maestro`
- `.github/workflows`
- `.eas/workflows` if present
- `apps/mobile/eas.json`
- `apps/mobile/app.config.ts`

Output a short implementation plan before editing, then continue into the
implementation. Do not stop after planning.

## Phase 1 - Expense Edit/Delete End-To-End

Implement backend support:

- Add `edit_expense` RPC.
- Add `delete_expense` RPC.
- Keep money in integer paisa only.
- Validate caller membership.
- Validate `paid_by` is an active group member.
- Validate every split user is an active group member.
- Validate split totals for equal, exact, percentage, and shares methods.
- Validate category, description, amount, date, and note.
- Prefer soft delete for expense deletion.
- Preserve audit/activity history.
- Add idempotency for replayable edit/delete operations.
- Emit `activity_log` events for `expense_edited` and `expense_deleted`.
- Keep direct mobile writes to money-changing tables blocked by RLS.

Implement mobile support:

- Add edit expense route/screen.
- Prefill amount, description, category, paid-by member, date, note, members,
  split method, and split values.
- Reuse add-expense form/view-model pieces where practical.
- Add delete confirmation.
- Call RPCs only; do not update `expenses`, `expense_shares`, or `settlements`
  directly from mobile.
- Invalidate and update local WatermelonDB cache after edit/delete.
- Add `expense.edit` and `expense.delete` offline queue entries only if they are
  idempotent and safe to replay.
- Show saved-offline UX for temporary failures.
- Keep permanent failures visible for repair.

Required tests:

- Edit with equal split.
- Edit with exact split.
- Edit with percent split.
- Edit with shares split.
- Invalid split rejection.
- Non-member rejection.
- Delete updates balances.
- Idempotent retry does not duplicate ledger rows or activity.
- Mobile release-safety check catches direct client money-table writes.

## Phase 2 - CSV Export End-To-End

Implement:

- Group ledger export from Settings or group settings.
- Export expenses, shares, settlements, members, and activity summary.
- BDT amounts as readable currency while preserving integer paisa internally.
- Bengali and English column labels based on locale.
- Generated CSV file through the mobile share sheet.
- Fallback UX if native sharing is unavailable.
- Exclude secrets, JWTs, OTPs, raw sensitive identifiers, and raw MFS numbers.
- Exclude deleted expenses unless the product explicitly labels them as deleted
  audit rows.

Required tests:

- CSV shape.
- CSV escaping for commas, quotes, and newlines.
- Bengali headers.
- English headers.
- Amount formatting.
- Deleted row exclusion or explicit deleted-row labeling.

## Phase 3 - Notifications V1

Implement mobile foundation:

- Expo notification permission request.
- Device token registration/upsert into `device_tokens`.
- Token deactivation/cleanup where practical.
- Notification preferences screen with:
  - new expense
  - settlement recorded
  - group invite/member joined
  - reminders marked deferred if too large for v1

Implement backend safe boundary:

- Add a notification queue, RPC, or Edge Function boundary as appropriate.
- Never place a service-role key in mobile code.
- Do not log raw phone numbers, raw MFS numbers, JWTs, OTPs, or push tokens.
- Keep notification payloads limited to safe summaries. Do not expose sensitive
  ledger detail in push payloads.

Credential boundary:

- If real push delivery requires unavailable Expo credentials or production
  secrets, implement everything up to the safe server boundary and document the
  exact missing credential. Do not claim live push delivery without evidence.

Required tests:

- Permission denied path.
- Token upsert path.
- Preference save/load.
- No service-role reference in mobile.
- Safe payload shape.
- Token values are not logged.

## Phase 4 - Failed Sync Repair/Dismiss UX

Implement:

- Settings -> Sync failed item detail view.
- Retry failed mutation.
- Dismiss only when safe, such as non-ledger, duplicate, or permanent failures
  that cannot corrupt money state.
- Copy debug info with secrets redacted.
- Bengali and English copy for every new state.
- No silent deletion of failed money mutations unless proven safe and tested.

Required tests:

- Retry path.
- Safe dismiss path.
- Unsafe money-mutation dismiss remains blocked or clearly guarded.
- Redaction removes secrets/tokens/phone-like sensitive values.
- Permanent failures remain visible until user action.

## Phase 5 - Activity Feed Completion

Implement:

- Pagination or infinite scroll.
- Pull-to-refresh.
- Rich rendering for:
  - `expense_added`
  - `expense_edited`
  - `expense_deleted`
  - `settlement_created`
  - `member_joined`
  - `member_left`
  - `group_renamed`
  - `group_archived`
- Actor/profile fallback.
- Asia/Dhaka relative time.
- Local cache fallback when remote activity fetch fails.
- Empty, loading, error, and offline states.

Required tests:

- Event renderer coverage for every listed event.
- Missing actor/profile fallback.
- Pagination behavior.
- Pull-to-refresh behavior.
- Offline/local fallback.
- Bengali and English copy parity.

## Phase 6 - Settings, Legal, Support, And Profile Completion

Implement:

- Profile settings polish.
- About Baki screen.
- Privacy Policy link or in-app screen.
- Terms link or in-app screen.
- Support email/link screen.
- App version/build number display.
- Clear "Baki does not process payments" statement.
- Delete-account user-facing copy verification.
- Language/theme settings polish.

Required tests:

- Legal/support/about screens render.
- Links have safe fallbacks.
- Version/build number renders.
- Delete-account blocked/success copy is present where testable.
- New user-facing copy has Bengali and English parity.

## Phase 7 - Receipt Attachment Safe Boundary

Inspect whether Supabase Storage is configured and safely policy-scoped.

If storage is safe:

- Implement optional receipt upload.
- Add bucket and storage policies.
- Attach receipt URL through add/edit expense RPCs.
- Add docs and tests for policy behavior.
- Ensure receipts are scoped to group members.

If storage is not safe:

- Add UI placeholder only if it improves clarity.
- Document the exact deferred blocker.
- Do not fake upload support.
- Do not add broad storage permissions.

## Phase 8 - Store, Screenshot, And Release Prep

Update after implementation:

- `docs/STORE/APP_STORE_CONNECT.md`
- `docs/STORE/GOOGLE_PLAY.md`
- `docs/STORE/SCREENSHOTS.md`
- `docs/PRIVACY_POLICY_DRAFT.md`
- `docs/TERMS_DRAFT.md`
- `docs/SUPPORT.md`
- `docs/RELEASE_NOTES.md`
- `TASKS.md`
- `docs/FEATURES.md`

Release requirements:

- Screenshot checklist or automated screenshot path if practical.
- EAS release workflow remains safe.
- No production E2E auth.
- No production Supabase project in E2E mode.
- Do not claim hosted EAS/Maestro success unless a real hosted run passed.

## Phase 9 - E2E Expansion

Expand Maestro flows where practical:

- Seed auth.
- Home.
- Group detail.
- Add expense.
- Edit expense.
- Delete expense.
- Balances.
- Settle cash.
- Activity.
- Export CSV if automatable.
- Notification preferences.
- Settings -> Sync failed state.
- Legal/support screens.

Keep hosted EAS/Maestro optional unless a real hosted run passes and is reliable
enough to make it a required gate.

## Phase 10 - Final Audit

Search and confirm:

- No direct mobile inserts, updates, deletes, or upserts into `expenses`,
  `expense_shares`, `settlements`, or group lifecycle tables.
- No Supabase service-role key in mobile code.
- No unsafe benchmark wording for product comparisons.
- No production E2E auth bypass.
- Money remains bigint/integer paisa.
- All new user-facing copy has Bengali and English parity.
- Release-safety passes.
- Supabase generated types match all migrations.
- DB docs match schema/RPC behavior.

## Quality Gates

Run all commands below and fix failures caused by the implementation:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm i18n:check
pnpm db:check
pnpm --filter mobile check:assets
pnpm e2e:auth:check
pnpm release:safety
pnpm check
git diff --check
```

Also run any new scripts or focused tests added during this epic.

## PR And Merge Contract

1. Open PR from `codex/v1-complete-app-implementation` into `main`.
2. Let GitHub Actions run.
3. Fix CI failures with focused commits.
4. Merge only if automated gates pass.
5. Confirm main CI starts or passes after merge.

## Definition Of Done

This goal is complete only when all are true:

- Minimum deliverables are implemented in code.
- New and existing tests pass locally.
- PR is opened with the required title.
- PR CI passes.
- PR is merged.
- Main CI starts or passes after merge.
- Final report includes every required status item.

## Not Acceptable As Done

- Only updating docs.
- Only adding TODOs.
- Deferring expense edit/delete.
- Deferring export.
- Deferring notification token/preferences.
- Deferring failed sync repair/dismiss.
- Claiming manual QA was done.
- Claiming hosted EAS/Maestro success without evidence.
- Weakening RLS, idempotency, release-safety, or Bengali/English parity.

## Final Report Requirements

The final report must include:

- Branch.
- PR URL.
- Merge commit.
- Main CI status.
- Files changed.
- DB migrations added.
- RPCs added/changed.
- Mobile screens added/changed.
- Offline queue changes.
- Notification implementation status.
- Export implementation status.
- Tests added.
- Commands run with pass/fail status.
- Remaining blockers before public launch.
