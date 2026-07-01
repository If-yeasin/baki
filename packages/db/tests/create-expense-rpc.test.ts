import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const DB_URL = process.env.DB_URL ?? DEFAULT_DB_URL;
const PSQL_BIN = "psql";
const SUPABASE_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Baki_-_";

const SEED = {
  groupId: "33333333-3333-4333-8333-333333333333",
  riniId: "22222222-2222-4222-8222-222222222222",
  tanvirId: "11111111-1111-4111-8111-111111111111"
} as const;

const outsider = {
  email: `expense-rpc-${Date.now()}-${randomUUID()}@example.test`,
  id: randomUUID(),
  phone: `+88016${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0")}`
};

type SqlRunner = "docker" | "psql";

let sqlRunner: SqlRunner = "psql";

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function runSql(sql: string, timeout = 8_000): string {
  const commonArgs = [
    "-X",
    "--set=ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--quiet",
    "--command",
    sql
  ];

  const command =
    sqlRunner === "docker"
      ? {
          args: [
            "exec",
            "-i",
            SUPABASE_DB_CONTAINER,
            PSQL_BIN,
            "-U",
            "postgres",
            "-d",
            "postgres",
            ...commonArgs
          ],
          bin: "docker"
        }
      : {
          args: ["--dbname", DB_URL, ...commonArgs],
          bin: PSQL_BIN
        };

  return execFileSync(command.bin, command.args, {
    encoding: "utf8",
    env: {
      ...process.env,
      PGCONNECT_TIMEOUT: "3"
    },
    stdio: ["ignore", "pipe", "pipe"],
    timeout
  }).trim();
}

function checkReadiness(): { ok: true } | { ok: false; reason: string } {
  let canUseHostPsql = true;
  try {
    execFileSync(PSQL_BIN, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 3_000
    });
  } catch {
    canUseHostPsql = false;
  }

  if (!canUseHostPsql) {
    try {
      execFileSync("docker", ["exec", SUPABASE_DB_CONTAINER, PSQL_BIN, "--version"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 5_000
      });
      sqlRunner = "docker";
    } catch {
      return { ok: false, reason: "no psql on PATH and docker fallback unavailable" };
    }
  }

  try {
    runSql("select 1;", 5_000);
  } catch {
    return { ok: false, reason: "could not reach local Supabase Postgres" };
  }

  return { ok: true };
}

function runAsAuthenticated(userId: string, sql: string): string {
  const claims = JSON.stringify({
    role: "authenticated",
    sub: userId
  });

  return runSql(`
    begin;
    set local "request.jwt.claim.sub" = ${sqlLiteral(userId)};
    set local "request.jwt.claim.role" = 'authenticated';
    set local "request.jwt.claims" = ${sqlLiteral(claims)};
    set local role authenticated;

    ${sql}

    rollback;
  `);
}

function runAsAnon(sql: string): string {
  return runSql(`
    begin;
    set local role anon;

    ${sql}

    rollback;
  `);
}

function runJsonAsAuthenticated<T>(userId: string, sql: string): T {
  return JSON.parse(runAsAuthenticated(userId, sql)) as T;
}

function createOutsiderFixture(): void {
  cleanupOutsiderFixture();

  runSql(`
    insert into auth.users (
      id, aud, role, email, phone,
      encrypted_password,
      email_confirmed_at, phone_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      ${sqlLiteral(outsider.id)}::uuid,
      'authenticated', 'authenticated',
      ${sqlLiteral(outsider.email)},
      ${sqlLiteral(outsider.phone)},
      extensions.crypt('password', extensions.gen_salt('bf')),
      now(), now(),
      '{"provider":"phone","providers":["phone"]}'::jsonb,
      '{}'::jsonb,
      now(), now()
    );

    insert into public.profiles (id, display_name, phone, locale)
    values (${sqlLiteral(outsider.id)}::uuid, 'Expense RPC Outsider', ${sqlLiteral(outsider.phone)}, 'bn');
  `);
}

function cleanupOutsiderFixture(): void {
  runSql(`
    delete from public.profiles where id = ${sqlLiteral(outsider.id)}::uuid;
    delete from auth.users where id = ${sqlLiteral(outsider.id)}::uuid;
  `);
}

type CreatedExpenseSummary = {
  activityCount: number;
  expenseCount: number;
  expenseId: string;
  shareTotal: number;
  sharesCount: number;
};

type RetriedExpenseSummary = {
  activityCount: number;
  expenseCount: number;
  firstExpenseId: string;
  secondExpenseId: string;
  shareTotal: number;
  sharesCount: number;
};

function createExpenseSql({
  amountPaisa,
  category = "food",
  clientMutationId,
  description,
  paidBy = SEED.tanvirId,
  shares,
  splitMethod
}: {
  amountPaisa: number;
  category?: string;
  clientMutationId?: string;
  description: string;
  paidBy?: string;
  shares: string;
  splitMethod: "equal" | "exact" | "percent" | "shares";
}): string {
  return `
    create temporary table created_expense_rpc_result (
      id uuid primary key
    ) on commit drop;

    insert into created_expense_rpc_result (id)
    select public.create_expense(
      p_group_id := ${sqlLiteral(SEED.groupId)}::uuid,
      p_amount_paisa := ${amountPaisa},
      p_description := ${sqlLiteral(description)},
      p_category := ${sqlLiteral(category)},
      p_paid_by := ${sqlLiteral(paidBy)}::uuid,
      p_split_method := ${sqlLiteral(splitMethod)},
      p_shares := ${shares}
      ${clientMutationId ? `, p_client_mutation_id := ${sqlLiteral(clientMutationId)}` : ""}
    );

    select jsonb_build_object(
      'expenseId', (select id::text from created_expense_rpc_result),
      'expenseCount', (
        select count(*)::int
        from public.expenses
        where id = (select id from created_expense_rpc_result)
      ),
      'sharesCount', (
        select count(*)::int
        from public.expense_shares
        where expense_id = (select id from created_expense_rpc_result)
      ),
      'shareTotal', (
        select coalesce(sum(share_paisa), 0)::int
        from public.expense_shares
        where expense_id = (select id from created_expense_rpc_result)
      ),
      'activityCount', (
        select count(*)::int
        from public.activity_log
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and actor_id = ${sqlLiteral(SEED.tanvirId)}::uuid
          and event_type = 'expense_added'
          and payload->>'expense_id' = (select id::text from created_expense_rpc_result)
      )
    )::text;
  `;
}

function retryExpenseSql({
  clientMutationId,
  description
}: {
  clientMutationId: string;
  description: string;
}): string {
  const shares = shareObject([
    [SEED.tanvirId, 5_001],
    [SEED.riniId, 5_000]
  ]);

  const createSql = (attempt: number) => `
    insert into retried_expense_rpc_result (attempt, id)
    select ${attempt}, public.create_expense(
      p_group_id := ${sqlLiteral(SEED.groupId)}::uuid,
      p_amount_paisa := 10001,
      p_description := ${sqlLiteral(description)},
      p_category := 'food',
      p_paid_by := ${sqlLiteral(SEED.tanvirId)}::uuid,
      p_split_method := 'equal',
      p_shares := ${shares},
      p_client_mutation_id := ${sqlLiteral(clientMutationId)}
    );
  `;

  return `
    create temporary table retried_expense_rpc_result (
      attempt integer primary key,
      id uuid not null
    ) on commit drop;

    ${createSql(1)}
    ${createSql(2)}

    select jsonb_build_object(
      'firstExpenseId', (
        select id::text from retried_expense_rpc_result where attempt = 1
      ),
      'secondExpenseId', (
        select id::text from retried_expense_rpc_result where attempt = 2
      ),
      'expenseCount', (
        select count(*)::int
        from public.expenses
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and created_by = ${sqlLiteral(SEED.tanvirId)}::uuid
          and client_mutation_id = ${sqlLiteral(clientMutationId)}
      ),
      'sharesCount', (
        select count(*)::int
        from public.expense_shares
        where expense_id = (
          select id from retried_expense_rpc_result where attempt = 1
        )
      ),
      'shareTotal', (
        select coalesce(sum(share_paisa), 0)::int
        from public.expense_shares
        where expense_id = (
          select id from retried_expense_rpc_result where attempt = 1
        )
      ),
      'activityCount', (
        select count(*)::int
        from public.activity_log
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and actor_id = ${sqlLiteral(SEED.tanvirId)}::uuid
          and event_type = 'expense_added'
          and payload->>'expense_id' = (
            select id::text from retried_expense_rpc_result where attempt = 1
          )
      )
    )::text;
  `;
}

function shareObject(entries: Array<[string, number | string]>): string {
  const args = entries
    .map(([userId, share]) => {
      const renderedShare = typeof share === "number" ? String(share) : sqlLiteral(share);
      return `${sqlLiteral(userId)}, ${renderedShare}`;
    })
    .join(", ");

  return `jsonb_build_object(${args})`;
}

function countExpensesByDescription(description: string): number {
  return Number(
    runSql(
      `select count(*)::int from public.expenses where description = ${sqlLiteral(description)};`
    )
  );
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(`[db tests] Skipping create_expense RPC suite: ${readiness.reason}.\n`);
}

const describeIfDb = readiness.ok ? describe : describe.skip;
const suiteName = readiness.ok
  ? "create_expense RPC"
  : `create_expense RPC (skipped: ${readiness.reason})`;

describeIfDb(suiteName, () => {
  beforeAll(() => {
    createOutsiderFixture();
  });

  afterAll(() => {
    cleanupOutsiderFixture();
  });

  it("creates an equal split atomically with an activity entry", () => {
    const result = runJsonAsAuthenticated<CreatedExpenseSummary>(
      SEED.tanvirId,
      createExpenseSql({
        amountPaisa: 10_001,
        description: "RPC equal split",
        shares: shareObject([
          [SEED.tanvirId, 5_001],
          [SEED.riniId, 5_000]
        ]),
        splitMethod: "equal"
      })
    );

    expect(result.expenseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.expenseCount).toBe(1);
    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(10_001);
    expect(result.activityCount).toBe(1);
  });

  it("returns the existing id without duplicating expenses or shares on retry", () => {
    const result = runJsonAsAuthenticated<RetriedExpenseSummary>(
      SEED.tanvirId,
      retryExpenseSql({
        clientMutationId: `expense-test:${randomUUID()}`,
        description: "RPC idempotent retry"
      })
    );

    expect(result.firstExpenseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.secondExpenseId).toBe(result.firstExpenseId);
    expect(result.expenseCount).toBe(1);
    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(10_001);
    expect(result.activityCount).toBe(1);
  });

  it("creates an exact split atomically", () => {
    const result = runJsonAsAuthenticated<CreatedExpenseSummary>(
      SEED.tanvirId,
      createExpenseSql({
        amountPaisa: 12_345,
        description: "RPC exact split",
        shares: shareObject([
          [SEED.tanvirId, 10_000],
          [SEED.riniId, 2_345]
        ]),
        splitMethod: "exact"
      })
    );

    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(12_345);
  });

  it("creates a percent split atomically", () => {
    const result = runJsonAsAuthenticated<CreatedExpenseSummary>(
      SEED.tanvirId,
      createExpenseSql({
        amountPaisa: 9_999,
        description: "RPC percent split",
        shares: shareObject([
          [SEED.tanvirId, 3_000],
          [SEED.riniId, 6_999]
        ]),
        splitMethod: "percent"
      })
    );

    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(9_999);
  });

  it("creates a shares split atomically", () => {
    const result = runJsonAsAuthenticated<CreatedExpenseSummary>(
      SEED.tanvirId,
      createExpenseSql({
        amountPaisa: 10_000,
        description: "RPC shares split",
        shares: shareObject([
          [SEED.tanvirId, 4_000],
          [SEED.riniId, 6_000]
        ]),
        splitMethod: "shares"
      })
    );

    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(10_000);
  });

  it("rejects an invalid split total", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.tanvirId,
        createExpenseSql({
          amountPaisa: 1_000,
          description: "RPC invalid total",
          shares: shareObject([
            [SEED.tanvirId, 500],
            [SEED.riniId, 499]
          ]),
          splitMethod: "exact"
        })
      );
    } catch (err) {
      raised = String(err).includes("split_total_mismatch");
    }

    expect(raised).toBe(true);
  });

  it("rejects an unauthenticated caller", () => {
    let raised = false;
    try {
      runAsAnon(
        createExpenseSql({
          amountPaisa: 1_000,
          description: "RPC anon caller",
          shares: shareObject([
            [SEED.tanvirId, 500],
            [SEED.riniId, 500]
          ]),
          splitMethod: "equal"
        })
      );
    } catch (err) {
      raised =
        String(err).includes("permission denied") || String(err).includes("not_authenticated");
    }

    expect(raised).toBe(true);
  });

  it("rejects a caller who is not a group member", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        outsider.id,
        createExpenseSql({
          amountPaisa: 1_000,
          description: "RPC nonmember caller",
          shares: shareObject([
            [SEED.tanvirId, 500],
            [SEED.riniId, 500]
          ]),
          splitMethod: "equal"
        })
      );
    } catch (err) {
      raised = String(err).includes("not_group_member");
    }

    expect(raised).toBe(true);
  });

  it("rejects paid_by when the payer is not a group member", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.tanvirId,
        createExpenseSql({
          amountPaisa: 1_000,
          description: "RPC nonmember payer",
          paidBy: outsider.id,
          shares: shareObject([
            [SEED.tanvirId, 500],
            [SEED.riniId, 500]
          ]),
          splitMethod: "equal"
        })
      );
    } catch (err) {
      raised = String(err).includes("paid_by_not_group_member");
    }

    expect(raised).toBe(true);
  });

  it("rejects split users who are not group members", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.tanvirId,
        createExpenseSql({
          amountPaisa: 1_000,
          description: "RPC nonmember split user",
          shares: shareObject([
            [SEED.tanvirId, 500],
            [outsider.id, 500]
          ]),
          splitMethod: "equal"
        })
      );
    } catch (err) {
      raised = String(err).includes("split_user_not_group_member");
    }

    expect(raised).toBe(true);
  });

  it("does not leave partial rows when shares are invalid", () => {
    const description = `RPC invalid shares ${randomUUID()}`;
    expect(countExpensesByDescription(description)).toBe(0);

    let raised = false;
    try {
      runAsAuthenticated(
        SEED.tanvirId,
        createExpenseSql({
          amountPaisa: 1_000,
          description,
          shares: shareObject([
            [SEED.tanvirId, 500],
            [SEED.riniId, "not-a-number"]
          ]),
          splitMethod: "exact"
        })
      );
    } catch (err) {
      raised = String(err).includes("invalid_share_amount");
    }

    expect(raised).toBe(true);
    expect(countExpensesByDescription(description)).toBe(0);
  });
});
