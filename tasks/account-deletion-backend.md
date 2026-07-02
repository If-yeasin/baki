# Account Deletion Backend — Archived Status

Status: superseded by the shipped `delete-account` Edge Function.

The current implementation lives at:

- `supabase/functions/delete-account/index.ts`
- `supabase/functions/delete-account/README.md`
- `docs/DATA_MODEL.md` → Account deletion

Important boundary: the deployed function does **not** use a Supabase service-role
key. It forwards the caller's bearer token with the Supabase anon key so
`auth.uid()` and the `public.delete_my_account()` RPC execute in the caller's
auth context. Do not reintroduce a service-role implementation for account
deletion.

Deployment instructions and smoke-test commands are maintained in
`supabase/functions/delete-account/README.md`.
