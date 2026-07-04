# Push Delivery Boundary

Updated: 2026-07-04

Status: partial. Mobile device-token registration and notification preferences
exist. Server-side push delivery is not implemented or verified.

## Implemented

- Mobile asks OS notification permission before requesting an Expo push token.
- Mobile stores Expo push tokens in `public.device_tokens` through own-row RLS.
- Mobile stores notification preferences in `public.notification_preferences`.
- Fresh preference rows default `push_enabled=false`; registration switches the
  master preference on only after a device token is saved.
- Settings shows registered status from `device_tokens`, not from preference
  defaults.

## Missing Server Boundary

One of these must land before claiming real push delivery:

- Supabase Edge Function that sends through Expo Push API, or
- database notification queue plus a trusted worker.

The server boundary must:

- read `device_tokens` and `notification_preferences` server-side;
- respect `push_enabled`, `expense_activity`, `settlement_activity`, and
  `reminders`;
- dedupe/retry safely;
- avoid raw phone numbers, MFS numbers, JWTs, OTPs, or payment references in
  payloads and logs;
- never expose `SUPABASE_SERVICE_ROLE_KEY` to the mobile app.

## Required Secrets

- `SUPABASE_SERVICE_ROLE_KEY` configured only in Supabase Edge Function or
  trusted worker secret storage.
- Expo push access token only if the chosen Expo project configuration requires
  authenticated push sends.
- `EXPO_PUBLIC_SENTRY_DSN` for client diagnostics; this is public and optional.

## Events To Queue Later

- new expense;
- expense edited/deleted;
- settlement recorded;
- member joined;
- low-pressure reminder.

Do not list push delivery as verified until the server boundary exists, secrets
are configured outside mobile, and an end-to-end delivery test passes.
