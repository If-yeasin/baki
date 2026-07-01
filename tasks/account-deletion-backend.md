# Account deletion — backend deployment plan

Status: SQL contract (`packages/db/migrations/0004_account_deletion.sql`) is landed.
The Edge Function below has **not** been deployed yet because the
`supabase/functions/` directory does not exist in this repo. Both the function
code and the deployment steps are specified here so a future wave can stand the
function up without re-deriving the contract.

## Wire contract (frozen — do not change without coordinating with mobile)

- Function name: `delete-account`
- Method: `POST`
- Request body: `{}` (auth comes from the Supabase JWT in the
  `Authorization: Bearer <token>` header)
- Success: HTTP 200 with `{ "deleted": true }`
- Failure: HTTP 4xx/5xx with `{ "error": "<machine_code>" }`
- Error codes: `not_authenticated` (401), `unsettled_balances` (409),
  `internal_error` (500)

See `docs/DATA_MODEL.md` → "Account deletion" for the full schema-side picture.

## Files to add when bootstrapping `supabase/functions/`

```
supabase/functions/
  delete-account/
    index.ts        # the code below
  _shared/          # optional: shared CORS / response helpers (future)
```

## `supabase/functions/delete-account/index.ts`

```ts
// supabase/functions/delete-account/index.ts
//
// Deno Edge Function: deletes the calling user's account by invoking
// public.delete_my_account() with the user's JWT, then translates SQL errors
// into the wire-level `{ error: "<machine_code>" }` shape that the mobile
// client expects. Never logs phone numbers or MFS numbers.
//
// Required env (configured via `supabase secrets set`):
//   SUPABASE_URL                — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY   — service-role key, server-only

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

type DeleteAccountResponse =
  | { deleted: true }
  | { error: "not_authenticated" | "unsettled_balances" | "internal_error" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("delete-account: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

function json(body: DeleteAccountResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "internal_error" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "not_authenticated" }, 401);
  }

  // The service-role client is used to (a) verify the JWT and (b) call the
  // RPC with the user's identity attached so auth.uid() resolves correctly
  // inside delete_my_account().
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: "not_authenticated" }, 401);
  }

  const { error } = await supabase.rpc("delete_my_account");

  if (!error) {
    return json({ deleted: true }, 200);
  }

  // PostgREST surfaces PL/pgSQL `raise exception` messages in `error.message`.
  if (error.message?.includes("unsettled_balances")) {
    return json({ error: "unsettled_balances" }, 409);
  }
  if (error.message?.includes("not_authenticated")) {
    return json({ error: "not_authenticated" }, 401);
  }

  // Anything else is logged (without sensitive fields) for debugging.
  console.error("delete-account: rpc failed", {
    code: error.code,
    message: error.message
  });
  return json({ error: "internal_error" }, 500);
});
```

## Deployment steps

```bash
# 1. Confirm the migration is applied to the live project.
pnpm --filter @baki/db migrate            # supabase db push

# 2. Set secrets on the live project (service-role key is server-only and
#    NEVER lives in the mobile app).
supabase secrets set \
  SUPABASE_URL="https://<project-ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

# 3. Deploy the function.
supabase functions deploy delete-account

# 4. Smoke-test from a signed-in test session (replace TOKEN with a real JWT
#    from a non-tombstone test account):
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}" \
  https://<project-ref>.functions.supabase.co/delete-account
# Expected: {"deleted":true}
```

## Verification checklist (post-deploy)

- [ ] Two-user RLS test extended to cover `delete_my_account()`:
      anon cannot execute, authenticated user with zero balance can,
      authenticated user with non-zero balance gets `unsettled_balances`.
- [ ] Mobile flow: Settings -> Delete account -> confirm -> client signs out.
- [ ] App Store reviewer notes updated to describe the demo path
      (see `docs/SETUP.md`).
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` does not appear in any
      `apps/**` or `packages/**` source. It exists only in: - Supabase project secrets (set via `supabase secrets set`) - the Deno runtime env of this Edge Function

## Future wave: deployment automation

Once `supabase/functions/` exists for a second function, fold the deploy step
into the release workflow (e.g. `.github/workflows/deploy-functions.yml`)
with a `supabase functions deploy --no-verify-jwt false` invocation on each
push to `main` that touches `supabase/functions/**`.
