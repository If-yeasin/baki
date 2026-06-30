# delete-account Edge Function

Deletes the authenticated caller's Baki account through the database RPC
`public.delete_my_account()`. The Edge Function does not delete rows directly
and does not use the service-role key; it forwards the caller's bearer token to
Supabase with the anon key so RLS/auth context stays intact.

## Contract

- Function name: `delete-account`
- Method: `POST`
- Request body: `{}`
- Required header: `Authorization: Bearer <user-jwt>`
- Success: `200 { "deleted": true }`
- Failure: `{ "error": "<machine_code>" }`

Error codes are documented in `docs/DATA_MODEL.md`.

## Local Run

From the repo root:

```bash
supabase start
supabase db reset
supabase functions serve delete-account --env-file supabase/.env.local
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically in the hosted
runtime. For local `functions serve`, put any required local overrides in
`supabase/.env.local` and keep that file uncommitted.

## Deploy

1. Link the Supabase project if needed:

   ```bash
   supabase link --project-ref <project-ref>
   ```

2. Apply database migrations first:

   ```bash
   supabase db push
   ```

3. Deploy the function:

   ```bash
   supabase functions deploy delete-account
   ```

`supabase/config.toml` sets `[functions.delete-account].verify_jwt = false`.
Keep that setting: the function performs its own bearer-token check so auth
failures return Baki's stable JSON error codes instead of Supabase's default
function-gateway response.

## Smoke Test

Call the deployed function with a real signed-in user's JWT:

```bash
curl -i \
  -X POST "https://<project-ref>.supabase.co/functions/v1/delete-account" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected success is `200 { "deleted": true }`. If the user has unsettled
balances, expected failure is `409 { "error": "unsettled_balances" }`.
