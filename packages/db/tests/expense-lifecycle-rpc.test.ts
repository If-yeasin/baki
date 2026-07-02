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
  email: `expense-lifecycle-${Date.now()}-${randomUUID()}@example.test`,
  id: randomUUID(),
  phone: `+88017${Math.floor(Math.random() * 100_000_000)
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
    values (${sqlLiteral(outsider.id)}::uuid, 'Expense Lifecycle Outsider', ${sqlLiteral(outsider.phone)}, 'bn');
  `);
}

function cleanupOutsiderFixture(): void {
  runSql(`
    delete from public.profiles where id = ${sqlLiteral(outsider.id)}::uuid;
    delete from auth.users where id = ${sqlLiteral(outsider.id)}::uuid;
  `);
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

function createExpenseSql(description: string): string {
  return `
    public.create_expense(
      p_group_id := ${sqlLiteral(SEED.groupId)}::uuid,
      p_amount_paisa := 10000,
      p_description := ${sqlLiteral(description)},
      p_category := 'food',
      p_paid_by := ${sqlLiteral(SEED.tanvirId)}::uuid,
      p_split_method := 'equal',
      p_shares := ${shareObject([
        [SEED.tanvirId, 5000],
        [SEED.riniId, 5000]
      ])},
      p_client_mutation_id := ${sqlLiteral(`expense-lifecycle-create:${randomUUID()}`)}
    )
  `;
}

type EditedExpenseSummary = {
  activityActorId: string;
  activityCount: number;
  amountPaisa: number;
  description: string;
  editedExpenseId: string;
  shareTotal: number;
  sharesCount: number;
};

type RetriedEditSummary = {
  activityCount: number;
  amountPaisa: number;
  firstExpenseId: string;
  secondExpenseId: string;
  shareTotal: number;
};

type DeletedExpenseSummary = {
  activityActorId: string;
  activityCount: number;
  deletedAtPresent: boolean;
  deletedExpenseId: string;
  riniDelta: number;
  shareRowsRemain: number;
  tanvirDelta: number;
};

type RetriedDeleteSummary = {
  activityCount: number;
  firstExpenseId: string;
  secondExpenseId: string;
};

function editExpenseSql({
  amountPaisa,
  clientMutationId,
  description,
  expenseIdExpression,
  paidBy = SEED.riniId,
  shares
}: {
  amountPaisa: number;
  clientMutationId?: string;
  description: string;
  expenseIdExpression: string;
  paidBy?: string;
  shares: string;
}): string {
  return `
    public.edit_expense(
      p_expense_id := ${expenseIdExpression},
      p_amount_paisa := ${amountPaisa},
      p_description := ${sqlLiteral(description)},
      p_category := 'transport',
      p_paid_by := ${sqlLiteral(paidBy)}::uuid,
      p_split_method := 'exact',
      p_shares := ${shares}
      ${clientMutationId ? `, p_client_mutation_id := ${sqlLiteral(clientMutationId)}` : ""}
    )
  `;
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(`[db tests] Skipping expense lifecycle RPC suite: ${readiness.reason}.\n`);
}

const describeIfDb = readiness.ok ? describe : describe.skip;
const suiteName = readiness.ok
  ? "expense lifecycle RPCs"
  : `expense lifecycle RPCs (skipped: ${readiness.reason})`;

describeIfDb(suiteName, () => {
  beforeAll(() => {
    createOutsiderFixture();
  });

  afterAll(() => {
    cleanupOutsiderFixture();
  });

  it("edits an expense, replaces shares, and attributes activity to the editor", () => {
    const result = runJsonAsAuthenticated<EditedExpenseSummary>(
      SEED.riniId,
      `
        create temporary table expense_lifecycle_result (
          original_id uuid primary key,
          edited_id uuid
        ) on commit drop;

        insert into expense_lifecycle_result (original_id)
        select ${createExpenseSql("Lifecycle edit success")};

        update expense_lifecycle_result
        set edited_id = ${editExpenseSql({
          amountPaisa: 12345,
          clientMutationId: `expense-lifecycle-edit:${randomUUID()}`,
          description: "Lifecycle edit updated",
          expenseIdExpression: "(select original_id from expense_lifecycle_result)",
          shares: shareObject([
            [SEED.tanvirId, 10000],
            [SEED.riniId, 2345]
          ])
        })};

        select jsonb_build_object(
          'editedExpenseId', (select edited_id::text from expense_lifecycle_result),
          'amountPaisa', (
            select amount_paisa::int
            from public.expenses
            where id = (select edited_id from expense_lifecycle_result)
          ),
          'description', (
            select description
            from public.expenses
            where id = (select edited_id from expense_lifecycle_result)
          ),
          'sharesCount', (
            select count(*)::int
            from public.expense_shares
            where expense_id = (select edited_id from expense_lifecycle_result)
          ),
          'shareTotal', (
            select coalesce(sum(share_paisa), 0)::int
            from public.expense_shares
            where expense_id = (select edited_id from expense_lifecycle_result)
          ),
          'activityActorId', (
            select actor_id::text
            from public.activity_log
            where event_type = 'expense_edited'
              and payload->>'expense_id' = (select edited_id::text from expense_lifecycle_result)
            order by created_at desc
            limit 1
          ),
          'activityCount', (
            select count(*)::int
            from public.activity_log
            where event_type = 'expense_edited'
              and payload->>'expense_id' = (select edited_id::text from expense_lifecycle_result)
          )
        )::text;
      `
    );

    expect(result.editedExpenseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.amountPaisa).toBe(12_345);
    expect(result.description).toBe("Lifecycle edit updated");
    expect(result.sharesCount).toBe(2);
    expect(result.shareTotal).toBe(12_345);
    expect(result.activityActorId).toBe(SEED.riniId);
    expect(result.activityCount).toBe(1);
  });

  it("returns the existing edit id without duplicating activity on retry", () => {
    const clientMutationId = `expense-lifecycle-edit:${randomUUID()}`;
    const result = runJsonAsAuthenticated<RetriedEditSummary>(
      SEED.riniId,
      `
        create temporary table expense_lifecycle_retry_edit (
          attempt integer primary key,
          id uuid not null
        ) on commit drop;

        create temporary table expense_lifecycle_target (
          id uuid primary key
        ) on commit drop;

        insert into expense_lifecycle_target (id)
        select ${createExpenseSql("Lifecycle edit retry")};

        insert into expense_lifecycle_retry_edit (attempt, id)
        select 1, ${editExpenseSql({
          amountPaisa: 14000,
          clientMutationId,
          description: "Lifecycle edit retry first",
          expenseIdExpression: "(select id from expense_lifecycle_target)",
          shares: shareObject([
            [SEED.tanvirId, 8000],
            [SEED.riniId, 6000]
          ])
        })};

        insert into expense_lifecycle_retry_edit (attempt, id)
        select 2, ${editExpenseSql({
          amountPaisa: 99999,
          clientMutationId,
          description: "Lifecycle edit retry second ignored",
          expenseIdExpression: "(select id from expense_lifecycle_target)",
          shares: shareObject([
            [SEED.tanvirId, 50000],
            [SEED.riniId, 49999]
          ])
        })};

        select jsonb_build_object(
          'firstExpenseId', (
            select id::text from expense_lifecycle_retry_edit where attempt = 1
          ),
          'secondExpenseId', (
            select id::text from expense_lifecycle_retry_edit where attempt = 2
          ),
          'amountPaisa', (
            select amount_paisa::int
            from public.expenses
            where id = (select id from expense_lifecycle_target)
          ),
          'shareTotal', (
            select coalesce(sum(share_paisa), 0)::int
            from public.expense_shares
            where expense_id = (select id from expense_lifecycle_target)
          ),
          'activityCount', (
            select count(*)::int
            from public.activity_log
            where event_type = 'expense_edited'
              and payload->>'expense_id' = (select id::text from expense_lifecycle_target)
          )
        )::text;
      `
    );

    expect(result.secondExpenseId).toBe(result.firstExpenseId);
    expect(result.amountPaisa).toBe(14_000);
    expect(result.shareTotal).toBe(14_000);
    expect(result.activityCount).toBe(1);
  });

  it("rejects invalid edit shares without leaving partial changes", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.riniId,
        `
          create temporary table expense_lifecycle_invalid (
            id uuid primary key
          ) on commit drop;

          insert into expense_lifecycle_invalid (id)
          select ${createExpenseSql("Lifecycle invalid edit")};

          select ${editExpenseSql({
            amountPaisa: 1000,
            description: "Lifecycle invalid edit changed",
            expenseIdExpression: "(select id from expense_lifecycle_invalid)",
            shares: shareObject([
              [SEED.tanvirId, 500],
              [SEED.riniId, 499]
            ])
          })};
        `
      );
    } catch (err) {
      raised = String(err).includes("split_total_mismatch");
    }

    expect(raised).toBe(true);
  });

  it("rejects edit callers who are not group members", () => {
    const targetExpenseId = runSql(`
      with inserted_expense as (
        insert into public.expenses (
          group_id,
          amount_paisa,
          description,
          category,
          paid_by,
          split_method,
          created_by
        ) values (
          ${sqlLiteral(SEED.groupId)}::uuid,
          1000,
          ${sqlLiteral(`Lifecycle nonmember edit target ${randomUUID()}`)},
          'food',
          ${sqlLiteral(SEED.tanvirId)}::uuid,
          'equal',
          ${sqlLiteral(SEED.tanvirId)}::uuid
        )
        returning id
      ),
      inserted_shares as (
        insert into public.expense_shares (expense_id, user_id, share_paisa)
        select inserted_expense.id, split.user_id, split.share_paisa
        from inserted_expense
        cross join (
          values
            (${sqlLiteral(SEED.tanvirId)}::uuid, 500::bigint),
            (${sqlLiteral(SEED.riniId)}::uuid, 500::bigint)
        ) as split(user_id, share_paisa)
        returning 1
      )
      select id::text
      from inserted_expense;
    `);

    let raised = false;
    try {
      runAsAuthenticated(
        outsider.id,
        `
          select ${editExpenseSql({
            amountPaisa: 1000,
            description: "Lifecycle nonmember edit",
            expenseIdExpression: `${sqlLiteral(targetExpenseId)}::uuid`,
            shares: shareObject([
              [SEED.tanvirId, 500],
              [SEED.riniId, 500]
            ])
          })};
        `
      );
    } catch (err) {
      raised = String(err).includes("not_group_member");
    } finally {
      runSql(`delete from public.expenses where id = ${sqlLiteral(targetExpenseId)}::uuid;`);
    }

    expect(raised).toBe(true);
  });

  it("rejects edit split users who are not group members", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.riniId,
        `
          create temporary table expense_lifecycle_invalid_member (
            id uuid primary key
          ) on commit drop;

          insert into expense_lifecycle_invalid_member (id)
          select ${createExpenseSql("Lifecycle invalid split member")};

          select ${editExpenseSql({
            amountPaisa: 1000,
            description: "Lifecycle invalid split member changed",
            expenseIdExpression: "(select id from expense_lifecycle_invalid_member)",
            shares: shareObject([
              [SEED.tanvirId, 500],
              [outsider.id, 500]
            ])
          })};
        `
      );
    } catch (err) {
      raised = String(err).includes("split_user_not_group_member");
    }

    expect(raised).toBe(true);
  });

  it("soft-deletes an expense, keeps shares for audit, and removes it from balances", () => {
    const result = runJsonAsAuthenticated<DeletedExpenseSummary>(
      SEED.riniId,
      `
        create temporary table expense_lifecycle_delete (
          id uuid primary key
        ) on commit drop;

        insert into expense_lifecycle_delete (id)
        select ${createExpenseSql("Lifecycle delete success")};

        create temporary table expense_lifecycle_before_balance (
          user_id uuid primary key,
          net_paisa bigint
        ) on commit drop;

        insert into expense_lifecycle_before_balance
        select *
        from public.get_group_balances(${sqlLiteral(SEED.groupId)}::uuid)
        where user_id in (${sqlLiteral(SEED.tanvirId)}::uuid, ${sqlLiteral(SEED.riniId)}::uuid);

        select public.delete_expense(
          p_expense_id := (select id from expense_lifecycle_delete),
          p_client_mutation_id := ${sqlLiteral(`expense-lifecycle-delete:${randomUUID()}`)}
        );

        create temporary table expense_lifecycle_after_balance (
          user_id uuid primary key,
          net_paisa bigint
        ) on commit drop;

        insert into expense_lifecycle_after_balance
        select *
        from public.get_group_balances(${sqlLiteral(SEED.groupId)}::uuid)
        where user_id in (${sqlLiteral(SEED.tanvirId)}::uuid, ${sqlLiteral(SEED.riniId)}::uuid);

        select jsonb_build_object(
          'deletedExpenseId', (select id::text from expense_lifecycle_delete),
          'deletedAtPresent', (
            select deleted_at is not null
            from public.expenses
            where id = (select id from expense_lifecycle_delete)
          ),
          'shareRowsRemain', (
            select count(*)::int
            from public.expense_shares
            where expense_id = (select id from expense_lifecycle_delete)
          ),
          'tanvirDelta', (
            coalesce((
              select net_paisa
              from expense_lifecycle_before_balance
              where user_id = ${sqlLiteral(SEED.tanvirId)}::uuid
            ), 0) -
            coalesce((
              select net_paisa
              from expense_lifecycle_after_balance
              where user_id = ${sqlLiteral(SEED.tanvirId)}::uuid
            ), 0)
          )::int,
          'riniDelta', (
            coalesce((
              select net_paisa
              from expense_lifecycle_before_balance
              where user_id = ${sqlLiteral(SEED.riniId)}::uuid
            ), 0) -
            coalesce((
              select net_paisa
              from expense_lifecycle_after_balance
              where user_id = ${sqlLiteral(SEED.riniId)}::uuid
            ), 0)
          )::int,
          'activityActorId', (
            select actor_id::text
            from public.activity_log
            where event_type = 'expense_deleted'
              and payload->>'expense_id' = (select id::text from expense_lifecycle_delete)
            order by created_at desc
            limit 1
          ),
          'activityCount', (
            select count(*)::int
            from public.activity_log
            where event_type = 'expense_deleted'
              and payload->>'expense_id' = (select id::text from expense_lifecycle_delete)
          )
        )::text;
      `
    );

    expect(result.deletedExpenseId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.deletedAtPresent).toBe(true);
    expect(result.shareRowsRemain).toBe(2);
    expect(result.tanvirDelta).toBe(5_000);
    expect(result.riniDelta).toBe(-5_000);
    expect(result.activityActorId).toBe(SEED.riniId);
    expect(result.activityCount).toBe(1);
  });

  it("returns the existing delete id without duplicating activity on retry", () => {
    const clientMutationId = `expense-lifecycle-delete:${randomUUID()}`;
    const result = runJsonAsAuthenticated<RetriedDeleteSummary>(
      SEED.riniId,
      `
        create temporary table expense_lifecycle_retry_delete (
          attempt integer primary key,
          id uuid not null
        ) on commit drop;

        create temporary table expense_lifecycle_delete_target (
          id uuid primary key
        ) on commit drop;

        insert into expense_lifecycle_delete_target (id)
        select ${createExpenseSql("Lifecycle delete retry")};

        insert into expense_lifecycle_retry_delete (attempt, id)
        select 1, public.delete_expense(
          p_expense_id := (select id from expense_lifecycle_delete_target),
          p_client_mutation_id := ${sqlLiteral(clientMutationId)}
        );

        insert into expense_lifecycle_retry_delete (attempt, id)
        select 2, public.delete_expense(
          p_expense_id := (select id from expense_lifecycle_delete_target),
          p_client_mutation_id := ${sqlLiteral(clientMutationId)}
        );

        select jsonb_build_object(
          'firstExpenseId', (
            select id::text from expense_lifecycle_retry_delete where attempt = 1
          ),
          'secondExpenseId', (
            select id::text from expense_lifecycle_retry_delete where attempt = 2
          ),
          'activityCount', (
            select count(*)::int
            from public.activity_log
            where event_type = 'expense_deleted'
              and payload->>'expense_id' = (select id::text from expense_lifecycle_delete_target)
          )
        )::text;
      `
    );

    expect(result.secondExpenseId).toBe(result.firstExpenseId);
    expect(result.activityCount).toBe(1);
  });

  it("rejects editing a deleted expense", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        SEED.riniId,
        `
          create temporary table expense_lifecycle_deleted_edit (
            id uuid primary key
          ) on commit drop;

          insert into expense_lifecycle_deleted_edit (id)
          select ${createExpenseSql("Lifecycle edit deleted")};

          select public.delete_expense(
            p_expense_id := (select id from expense_lifecycle_deleted_edit),
            p_client_mutation_id := ${sqlLiteral(`expense-lifecycle-delete:${randomUUID()}`)}
          );

          select ${editExpenseSql({
            amountPaisa: 1000,
            description: "Lifecycle edit deleted changed",
            expenseIdExpression: "(select id from expense_lifecycle_deleted_edit)",
            shares: shareObject([
              [SEED.tanvirId, 500],
              [SEED.riniId, 500]
            ])
          })};
        `
      );
    } catch (err) {
      raised = String(err).includes("expense_not_found");
    }

    expect(raised).toBe(true);
  });

  it("rejects anonymous expense lifecycle callers", () => {
    let raised = false;
    try {
      runAsAnon(`
        select public.delete_expense(
          p_expense_id := gen_random_uuid(),
          p_client_mutation_id := ${sqlLiteral(`expense-lifecycle-delete:${randomUUID()}`)}
        );
      `);
    } catch (err) {
      raised =
        String(err).includes("permission denied") || String(err).includes("not_authenticated");
    }

    expect(raised).toBe(true);
  });
});
