# Google Play Draft

Updated: 2026-07-02

## App Identity

- App name: বাকি / Baki
- Package: `com.baki.app`
- Track: closed testing first, production later
- Android target: v1.1 after iOS closed beta unless release priorities change

## Short Description

Bengali-first shared expense khata for Bangladesh.

## Full Description Draft

Baki is a Bengali-first shared expense ledger for Bangladesh. Use it for mess bills, trips, family expenses, events, and flatmate costs. Add BDT expenses, split them with group members, see balances, and record settlements made outside the app through cash, bKash, Nagad, or another method.

Baki does not process payments or hold money. It only records the ledger and helps with outside-app settlement handoff.

## Data Safety Draft

- Personal info: phone number and display name for sign-in and group identity.
- Financial info: shared expense and settlement ledger entries. Baki does not collect card, bank, or payment credentials.
- Optional MFS numbers: bKash/Nagad numbers may be used for settlement handoff if entered by the user.
- App activity: crash diagnostics if Sentry is configured.
- Data deletion: in-app account deletion is available, blocked only while the user has unsettled balances.

## Closed Testing Checklist

- Prepare a closed testing track.
- Add at least 12 testers and keep the app available for the required testing window if Google Play's current policy applies to the developer account.
- Use preview/test Supabase for seeded test accounts; do not enable E2E seed auth against production.
- Verify Android bKash/Nagad handoff behavior separately from iOS before public Android release.

## Reviewer Notes

Baki is an expense tracker and shared ledger. It does not transfer money, hold funds, provide credit, or authorize payments. Cash, bKash, and Nagad settlements are recorded after the user completes payment outside Baki.

## Current Android Blockers

- Android production release is v1.1 by roadmap.
- Need device QA on common Bangladesh Android devices before public Play release.
- Need Play Console privacy policy URL, data safety form, and screenshots.
