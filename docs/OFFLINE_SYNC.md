# OFFLINE_SYNC.md

## Scope

Baki queues money-changing work when the network is weak or unavailable, then replays it after the user is authenticated and the app can reach Supabase again. The trusted-tester path is intentionally simple: remote data wins after a successful fetch, and conflicts stay visible as failed sync items.

## Queued Mutation Types

Current queue types live in `apps/mobile/src/features/offline/mutation-queue.ts`:

- `expense.create` — replayed through `create_expense`
- `settlement.create` — replayed through `create_settlement`
- `group.create` — queued so the user intent is not lost, not replayed in this sprint
- `expense.update`, `expense.delete`, `profile.update` — reserved for later repair paths

Money-writing replay must continue to use RPCs only. Do not add direct client inserts for expenses or settlements.

## Idempotency

`create_expense` and `create_settlement` both accept `p_client_mutation_id`. The mobile app generates a client mutation id before calling the RPC and stores the same id in the queue payload if the call fails. Replaying the same payload returns the original ledger row instead of creating a duplicate.

## Failure Handling

Temporary failures stay `pending` and increment `retryCount`. Examples: network failures, 408, and 429.

Permanent failures are marked `failed` and are skipped by automatic replay. Examples: validation errors, RLS/membership errors, auth errors, foreign-key errors, and empty RPC results.

Failed mutations are not silently deleted. They remain visible on Settings -> Sync until the user taps retry, or until a future repair/dismiss path is added.

When an expense or settlement RPC fails for a temporary reason, the mobile app now keeps the payload in the queue and returns a queued-success result to the screen. The user sees "অফলাইনে সেভ হয়েছে" / "Saved offline" with copy explaining that Baki will sync automatically. Permanent money-writing failures are queued with `failed` status for visibility, but the form still treats them as errors.

## Replay Triggers

`useQueuedMutationProcessor()` runs only after the session is ready and a user id exists. It triggers replay:

- after authenticated app startup
- when the app returns to foreground
- every 60 seconds while authenticated
- when the user taps Retry sync from Settings -> Sync

The orchestrator keeps an in-memory lock so concurrent triggers share one run instead of replaying the queue twice.

## Known Limitations

- NetInfo is not installed yet. Replay is driven by app lifecycle, interval, and retry/backoff instead of explicit connectivity state.
- `group.create` can be queued but is not automatically replayed in this sprint because group creation is not idempotent yet.
- Conflict resolution is remote-wins after successful fetch. Conflicts that fail RPC validation remain visible as failed sync items.
- Expo Go uses in-memory storage and cannot validate the full WatermelonDB offline path; use a Dev Client for trusted-tester QA.

## Manual Test

1. Sign in on a Dev Client build.
2. Open or create a khata with at least two members.
3. Turn on Airplane Mode.
4. Add an expense or record a cash settlement.
5. Confirm the screen shows the saved-offline message.
6. Confirm the header sync indicator shows pending work.
7. Open Settings -> Sync and confirm pending/failed counts are visible.
8. Turn Airplane Mode off.
9. Bring the app to foreground or tap Retry sync.
10. Confirm the queue clears, balances update, and no duplicate expense/settlement rows appear in Supabase.

This manual test still requires a Dev Client or TestFlight build. Expo Go is only a UI smoke path because WatermelonDB and persistent native storage are unavailable there.
