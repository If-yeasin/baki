import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const DB_URL = process.env.DB_URL ?? DEFAULT_DB_URL;
const PSQL_BIN = "psql";
const SUPABASE_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Baki_-_";

const SEED = {
  tanvirId: "11111111-1111-4111-8111-111111111111",
  riniId: "22222222-2222-4222-8222-222222222222",
  groupId: "33333333-3333-4333-8333-333333333333",
  groupName: "Sajek Trip"
} as const;

const temporaryUser = {
  id: randomUUID(),
  email: `rls-${Date.now()}-${randomUUID()}@example.test`,
  phone: `+88019${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0")}`
};

type Readiness =
  | { ok: true }
  | {
      ok: false;
      reason: string;
    };

type SeedSanity = {
  tanvirProfile: boolean;
  riniProfile: boolean;
  sharedGroup: boolean;
  sharedGroupMemberCount: number;
};

type SeedFlowSanity = {
  activityCount: number;
  expenseCount: number;
  settlementCount: number;
  shareCount: number;
  simplifiedPlan: Array<{
    amount_paisa: number;
    from_user: string;
    to_user: string;
  }>;
};

type SqlRunner = "docker" | "psql";

let sqlRunner: SqlRunner = "psql";

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function databaseTarget(): string {
  try {
    const parsed = new URL(DB_URL);
    const port = parsed.port || "5432";
    const database = parsed.pathname.replace(/^\//, "") || "postgres";

    return `${parsed.hostname}:${port}/${database}`;
  } catch {
    return "DB_URL";
  }
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

function checkReadiness(): Readiness {
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
      return {
        ok: false,
        reason: "`psql` is not on PATH and Docker psql fallback is unavailable"
      };
    }
  }

  try {
    runSql("select 1;", 5_000);
  } catch {
    return {
      ok: false,
      reason: `could not connect to local Supabase Postgres at ${databaseTarget()}`
    };
  }

  return { ok: true };
}

function runJson<T>(sql: string): T {
  return JSON.parse(runSql(sql)) as T;
}

function runAsAuthenticated(userId: string, sql: string): string {
  const claims = JSON.stringify({
    sub: userId,
    role: "authenticated"
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

function visibleSeedGroupCountFor(userId: string): number {
  return Number(
    runAsAuthenticated(
      userId,
      `
        select count(*)::int
        from public.groups
        where id = ${sqlLiteral(SEED.groupId)}::uuid
          and name = ${sqlLiteral(SEED.groupName)};
      `
    )
  );
}

function createTemporaryAuthenticatedUser(): void {
  cleanupTemporaryAuthenticatedUser();

  runSql(`
    insert into auth.users (
      id,
      aud,
      role,
      email,
      phone,
      encrypted_password,
      email_confirmed_at,
      phone_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) values (
      ${sqlLiteral(temporaryUser.id)}::uuid,
      'authenticated',
      'authenticated',
      ${sqlLiteral(temporaryUser.email)},
      ${sqlLiteral(temporaryUser.phone)},
      crypt('password', gen_salt('bf')),
      now(),
      now(),
      '{"provider":"phone","providers":["phone"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    insert into public.profiles (id, display_name, phone, locale)
    values (
      ${sqlLiteral(temporaryUser.id)}::uuid,
      'RLS Nonmember',
      ${sqlLiteral(temporaryUser.phone)},
      'bn'
    );
  `);
}

function cleanupTemporaryAuthenticatedUser(): void {
  runSql(`
    delete from public.profiles where id = ${sqlLiteral(temporaryUser.id)}::uuid;
    delete from auth.users where id = ${sqlLiteral(temporaryUser.id)}::uuid;
  `);
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(
    `[db tests] Skipping local Supabase verification: ${readiness.reason}. Set DB_URL or start Supabase locally.\n`
  );
}

const describeIfDatabase = readiness.ok ? describe : describe.skip;
const suiteName = readiness.ok
  ? "local Supabase seed and RLS verification"
  : `local Supabase seed and RLS verification (skipped: ${readiness.reason})`;

describeIfDatabase(suiteName, () => {
  beforeAll(() => {
    createTemporaryAuthenticatedUser();
  });

  afterAll(() => {
    cleanupTemporaryAuthenticatedUser();
  });

  it("has the expected seed users and shared group", () => {
    const seed = runJson<SeedSanity>(`
      select jsonb_build_object(
        'tanvirProfile', exists (
          select 1
          from public.profiles
          where id = ${sqlLiteral(SEED.tanvirId)}::uuid
            and display_name = 'Tanvir'
        ),
        'riniProfile', exists (
          select 1
          from public.profiles
          where id = ${sqlLiteral(SEED.riniId)}::uuid
            and display_name = 'Rini'
        ),
        'sharedGroup', exists (
          select 1
          from public.groups
          where id = ${sqlLiteral(SEED.groupId)}::uuid
            and name = ${sqlLiteral(SEED.groupName)}
            and invite_code = 'sajek1'
        ),
        'sharedGroupMemberCount', (
          select count(*)::int
          from public.group_members
          where group_id = ${sqlLiteral(SEED.groupId)}::uuid
            and user_id in (
              ${sqlLiteral(SEED.tanvirId)}::uuid,
              ${sqlLiteral(SEED.riniId)}::uuid
            )
            and left_at is null
        )
      )::text;
    `);

    expect(seed).toEqual({
      tanvirProfile: true,
      riniProfile: true,
      sharedGroup: true,
      sharedGroupMemberCount: 2
    });
  });

  it.each([
    ["Tanvir", SEED.tanvirId],
    ["Rini", SEED.riniId]
  ])("%s can see the shared seed group through RLS", (_name, userId) => {
    expect(visibleSeedGroupCountFor(userId)).toBe(1);
  });

  it("hides the shared seed group from an authenticated non-member", () => {
    expect(visibleSeedGroupCountFor(temporaryUser.id)).toBe(0);
  });

  it("has enough seeded ledger data for the trusted-tester E2E flow", () => {
    const flowSeed = JSON.parse(
      runAsAuthenticated(
        SEED.tanvirId,
        `
          select jsonb_build_object(
            'expenseCount', (
              select count(*)::int
              from public.expenses
              where group_id = ${sqlLiteral(SEED.groupId)}::uuid
            ),
            'shareCount', (
              select count(*)::int
              from public.expense_shares es
              join public.expenses e on e.id = es.expense_id
              where e.group_id = ${sqlLiteral(SEED.groupId)}::uuid
            ),
            'settlementCount', (
              select count(*)::int
              from public.settlements
              where group_id = ${sqlLiteral(SEED.groupId)}::uuid
            ),
            'activityCount', (
              select count(*)::int
              from public.activity_log
              where group_id = ${sqlLiteral(SEED.groupId)}::uuid
            ),
            'simplifiedPlan', (
              select coalesce(jsonb_agg(to_jsonb(plan) order by amount_paisa desc), '[]'::jsonb)
              from public.simplify_debts(${sqlLiteral(SEED.groupId)}::uuid) as plan
            )
          )::text;
        `
      )
    ) as SeedFlowSanity;

    expect(flowSeed.expenseCount).toBeGreaterThanOrEqual(3);
    expect(flowSeed.shareCount).toBeGreaterThanOrEqual(6);
    expect(flowSeed.settlementCount).toBeGreaterThanOrEqual(1);
    expect(flowSeed.activityCount).toBeGreaterThanOrEqual(4);
    expect(flowSeed.simplifiedPlan).toEqual([
      {
        amount_paisa: 20_000,
        from_user: SEED.riniId,
        to_user: SEED.tanvirId
      }
    ]);
  });
});
