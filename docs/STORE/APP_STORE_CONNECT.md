# App Store Connect Draft

Updated: 2026-07-04

## App Identity

- App name: বাকি / Baki
- Subtitle: Bengali-first shared expense ledger
- Category: Finance
- Bundle ID: `com.baki.app`
- Version line: `0.9.0` native app version, `0.9.0-beta.0` package metadata for closed beta prep

## Description Draft

বাকি is a Bengali-first shared expense ledger for Bangladesh. Create a khata for a mess, trip, family cost, event, or flat. Add expenses in BDT, split them with friends or family, see who owes whom, and record outside-app settlements by cash, bKash, Nagad, or another method.

Baki does not hold money, process payments, or authorize transactions. bKash and Nagad actions only open the user's installed app or provide a copy fallback. The user completes any payment outside Baki and records the settlement in the ledger.

## Keywords Draft

khata, Bengali, expense, split bills, Bangladesh, bKash, Nagad, BDT, mess, trip, family, ledger

## Privacy Answers Draft

- Phone number: collected, linked to identity, used for OTP sign-in and account identity.
- Display name: collected, linked to identity, shown to khata members.
- Optional bKash/Nagad numbers: collected only if the user enters them, linked to identity, used to help settlement handoff. Do not log raw MFS numbers.
- Crash diagnostics: collected through Sentry when configured, used for app stability.
- No NID, KYC, card numbers, bank details, contact list upload, or payment credentials.

## Account Deletion Note

Settings includes Delete account. The mobile app calls the `delete-account` Supabase Edge Function, which invokes `public.delete_my_account()` with the user's JWT. Deletion is blocked while the user has unsettled balances in active groups. Ledger rows are reassigned to a tombstone profile so other members' balances are preserved.

## Reviewer Notes

Baki is an expense ledger, not a payment processor. It never holds user funds or authorizes payments. bKash/Nagad buttons only open or help copy details for the user's own installed payment app. The user confirms any transfer outside Baki and records the settlement manually.

Provide a seeded reviewer/test account only for a preview or review Supabase environment. Do not enable `EXPO_PUBLIC_E2E_MODE=true` for production builds.

## Current Submission Blockers

- Real App Store Connect IDs are placeholders in `apps/mobile/eas.json`.
- Privacy policy, terms, support, and account-deletion pages are prepared in `docs-site/`, but the final hosted URLs must be deployed before submission.
- Closed-beta screenshots need to be captured from the current build.
- Production Supabase migrations and `delete-account` function deployment must be verified.
