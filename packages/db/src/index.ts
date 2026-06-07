export type { Database } from "./types";

import type { Database } from "./types";

/**
 * Row shape returned by the `get_group_balances(p_group_id uuid)` RPC
 * (see `packages/db/migrations/0003_balances_helper.sql`).
 *
 * Derived from the generated `Database` type so callers stay aligned with
 * whatever `pnpm --filter @baki/db gen:types` last produced against the
 * local Supabase. `net_paisa` is bigint on the server; Supabase's JS client
 * returns it as a JS number, which is safe within +/-2^53. Money is always
 * stored as paisa (1 BDT = 100 paisa).
 *
 * Usage:
 *
 *   import type { GroupBalanceRow } from "@baki/db";
 */
export type GroupBalanceRow =
  Database["public"]["Functions"]["get_group_balances"]["Returns"][number];
