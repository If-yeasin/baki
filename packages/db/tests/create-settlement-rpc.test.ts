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
  email: `settlement-rpc-${Date.now()}-${randomUUID()}@example.test`,
  id: randomUUID(),
  phone: `+88018${Math.floor(Math.random() * 100_000_000)
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
      PGCONNECTTIMEOUT: "3",
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

function runAsAuthenticatedAfterAdminSql(userId: string, adminSql: string, sql: string): string {
  const claims = JSON.stringify({
    role: "authenticated",
    sub: userId
  });

  return runSql(`
    begin;
    ${adminSql}

    set local "request.jwt.claim.sub" = ${sqlLiteral(userId)};
    set local "request.jwt.claim.role" = 'authenticated';
    set local "request.jwt.claims" = ${sqlLiteral(claims)};
    set local role authenticated;

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
    values (${sqlLiteral(outsider.id)}::uuid, 'Settlement RPC Outsider', ${sqlLiteral(outsider.phone)}, 'bn');
  `);
}

function cleanupOutsiderFixture(): void {
  runSql(`
    delete from public.profiles where id = ${sqlLiteral(outsider.id)}::uuid;
    delete from auth.users where id = ${sqlLiteral(outsider.id)}::uuid;
  `);
}

type CreatedSettlementSummary = {
  activityCount: number;
  activityMethod: string;
  settlementCount: number;
  settlementId: string;
};

type RetriedSettlementSummary = {
  activityCount: number;
  firstSettlementId: string;
  secondSettlementId: string;
  settlementCount: number;
};

function createSettlementSql({
  amountPaisa,
  clientMutationId,
  externalRef,
  fromUser = SEED.tanvirId,
  method = "bkash",
  toUser = SEED.riniId
}: {
  amountPaisa: number;
  clientMutationId?: string;
  externalRef?: string;
  fromUser?: string;
  method?: string;
  toUser?: string;
}): string {
  return `
    create temporary table created_settlement_rpc_result (
      id uuid primary key
    ) on commit drop;

    insert into created_settlement_rpc_result (id)
    select public.create_settlement(
      p_group_id := ${sqlLiteral(SEED.groupId)}::uuid,
      p_from_user := ${sqlLiteral(fromUser)}::uuid,
      p_to_user := ${sqlLiteral(toUser)}::uuid,
      p_amount_paisa := ${amountPaisa},
      p_method := ${sqlLiteral(method)}
      ${externalRef ? `, p_external_ref := ${sqlLiteral(externalRef)}` : ""}
      ${clientMutationId ? `, p_client_mutation_id := ${sqlLiteral(clientMutationId)}` : ""}
    );

    select jsonb_build_object(
      'settlementId', (select id::text from created_settlement_rpc_result),
      'settlementCount', (
        select count(*)::int
        from public.settlements
        where id = (select id from created_settlement_rpc_result)
      ),
      'activityCount', (
        select count(*)::int
        from public.activity_log
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and event_type = 'settled'
          and payload->>'settlement_id' = (
            select id::text from created_settlement_rpc_result
          )
      ),
      'activityMethod', (
        select payload->>'method'
        from public.activity_log
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and event_type = 'settled'
          and payload->>'settlement_id' = (
            select id::text from created_settlement_rpc_result
          )
        limit 1
      )
    )::text;
  `;
}

function retrySettlementSql({
  clientMutationId,
  externalRef
}: {
  clientMutationId: string;
  externalRef: string;
}): string {
  const createSql = (attempt: number) => `
    insert into retried_settlement_rpc_result (attempt, id)
    select ${attempt}, public.create_settlement(
      p_group_id := ${sqlLiteral(SEED.groupId)}::uuid,
      p_from_user := ${sqlLiteral(SEED.tanvirId)}::uuid,
      p_to_user := ${sqlLiteral(SEED.riniId)}::uuid,
      p_amount_paisa := 12300,
      p_method := 'bkash',
      p_external_ref := ${sqlLiteral(externalRef)},
      p_client_mutation_id := ${sqlLiteral(clientMutationId)}
    );
  `;

  return `
    create temporary table retried_settlement_rpc_result (
      attempt integer primary key,
      id uuid not null
    ) on commit drop;

    ${createSql(1)}
    ${createSql(2)}

    select jsonb_build_object(
      'firstSettlementId', (
        select id::text from retried_settlement_rpc_result where attempt = 1
      ),
      'secondSettlementId', (
        select id::text from retried_settlement_rpc_result where attempt = 2
      ),
      'settlementCount', (
        select count(*)::int
        from public.settlements
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and from_user = ${sqlLiteral(SEED.tanvirId)}::uuid
          and client_mutation_id = ${sqlLiteral(clientMutationId)}
      ),
      'activityCount', (
        select count(*)::int
        from public.activity_log
        where group_id = ${sqlLiteral(SEED.groupId)}::uuid
          and event_type = 'settled'
          and payload->>'settlement_id' = (
            select id::text from retried_settlement_rpc_result where attempt = 1
          )
      )
    )::text;
  `;
}

function expectSqlToRaise(run: () => void, expectedMessage: string) {
  let raised = false;
  try {
    run();
  } catch (err) {
    raised = String(err).includes(expectedMessage);
  }

  expect(raised).toBe(true);
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(`[db tests] Skipping create_settlement RPC suite: ${readiness.reason}.\n`);
}

const describeIfDb = readiness.ok ? describe : describe.skip;
const suiteName = readiness.ok
  ? "create_settlement RPC"
  : `create_settlement RPC (skipped: ${readiness.reason})`;

describeIfDb(suiteName, () => {
  beforeAll(() => {
    createOutsiderFixture();
  });

  afterAll(() => {
    cleanupOutsiderFixture();
  });

  it("creates a settlement atomically with an activity entry", () => {
    const result = runJsonAsAuthenticated<CreatedSettlementSummary>(
      SEED.tanvirId,
      createSettlementSql({
        amountPaisa: 12_300,
        externalRef: `BKASH-${randomUUID()}`,
        method: "bkash"
      })
    );

    expect(result.settlementId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.settlementCount).toBe(1);
    expect(result.activityCount).toBe(1);
    expect(result.activityMethod).toBe("bkash");
  });

  it("returns the existing id without duplicating settlements or activity on retry", () => {
    const result = runJsonAsAuthenticated<RetriedSettlementSummary>(
      SEED.tanvirId,
      retrySettlementSql({
        clientMutationId: `settlement-test:${randomUUID()}`,
        externalRef: `BKASH-${randomUUID()}`
      })
    );

    expect(result.firstSettlementId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.secondSettlementId).toBe(result.firstSettlementId);
    expect(result.settlementCount).toBe(1);
    expect(result.activityCount).toBe(1);
  });

  it("rejects an unauthenticated caller", () => {
    expectSqlToRaise(
      () =>
        runAsAnon(
          createSettlementSql({
            amountPaisa: 1_000
          })
        ),
      "permission denied"
    );
  });

  it("rejects a caller who is not a group member", () => {
    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          outsider.id,
          createSettlementSql({
            amountPaisa: 1_000
          })
        ),
      "not_group_member"
    );
  });

  it("rejects creating settlements in archived or deleted groups", () => {
    const inactiveGroupCases = [
      {
        label: "archived",
        sql: `update public.groups set archived_at = now() where id = ${sqlLiteral(SEED.groupId)}::uuid;`
      },
      {
        label: "deleted",
        sql: `update public.groups set deleted_at = now() where id = ${sqlLiteral(SEED.groupId)}::uuid;`
      }
    ];

    for (const inactiveGroupCase of inactiveGroupCases) {
      expectSqlToRaise(
        () =>
          runAsAuthenticatedAfterAdminSql(
            SEED.tanvirId,
            inactiveGroupCase.sql,
            createSettlementSql({
              amountPaisa: 1_000,
              externalRef: `${inactiveGroupCase.label}-${randomUUID()}`
            })
          ),
        "group_not_active"
      );
    }
  });

  it("rejects settlement parties who are not group members", () => {
    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          SEED.tanvirId,
          createSettlementSql({
            amountPaisa: 1_000,
            fromUser: outsider.id
          })
        ),
      "from_user_not_group_member"
    );

    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          SEED.tanvirId,
          createSettlementSql({
            amountPaisa: 1_000,
            toUser: outsider.id
          })
        ),
      "to_user_not_group_member"
    );
  });

  it("rejects non-positive amounts", () => {
    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          SEED.tanvirId,
          createSettlementSql({
            amountPaisa: 0
          })
        ),
      "amount_must_be_positive"
    );
  });

  it("rejects unsupported settlement methods", () => {
    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          SEED.tanvirId,
          createSettlementSql({
            amountPaisa: 1_000,
            method: "rocket"
          })
        ),
      "invalid_settlement_method"
    );
  });

  it("rejects matching settlement parties", () => {
    expectSqlToRaise(
      () =>
        runAsAuthenticated(
          SEED.tanvirId,
          createSettlementSql({
            amountPaisa: 1_000,
            fromUser: SEED.tanvirId,
            toUser: SEED.tanvirId
          })
        ),
      "settlement_parties_must_differ"
    );
  });
});
