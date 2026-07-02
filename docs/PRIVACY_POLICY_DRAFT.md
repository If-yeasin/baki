# Baki Privacy Policy Draft

Last updated: 2026-07-02

Baki is a Bengali-first shared expense ledger for Bangladesh. Baki helps groups record expenses, calculate balances, and open bKash/Nagad settlement handoffs. Baki does not hold money, process payments, or act as a bank.

## Data We Collect

- Phone number for OTP sign-in.
- Display name and app language preference.
- Khata membership, expenses, shares, settlements, activity logs, invite codes, and offline sync metadata.
- Optional bKash or Nagad number if the user chooses to save one for settlement handoff.
- Expo push token and notification preferences after the user enables notifications.
- Crash and diagnostic context through Sentry, without raw OTP codes, JWTs, bKash/Nagad numbers, or settlement transaction references.

## How We Use Data

- Authenticate the user and show shared khata history to authorized group members.
- Calculate balances, simplify settlement plans, and keep offline changes replayable.
- Send notification reminders if enabled.
- Diagnose crashes, sync failures, and release issues.

## Payment Boundary

Baki can open bKash, Nagad, cash, or other settlement flows, but payment happens outside Baki. Baki stores only the ledger record users choose to enter.

## Deletion

Users can request account deletion in Settings. Deletion removes the user's profile, membership, push tokens, and payment details after their own active balances are settled. Shared ledger history remains for other members with the deleted user replaced by a deleted-user label.

## Contact

Support: support@baki.app
