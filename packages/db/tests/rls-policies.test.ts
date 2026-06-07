import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Two-user RLS coverage for the policies that the MVP depends on. Mirrors the
// psql-based pattern in `rls-and-seed.test.ts` so the suite stays runnable on
// any developer's machine that has a local Supabase up (or, failing that,
// docker exec into the supabase_db container). CI machines without a database
// see a skipped describe block instead of a hard failure.
// ---------------------------------------------------------------------------

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const DB_URL = process.env.DB_URL ?? DEFAULT_DB_URL;
const PSQL_BIN = "psql";
const SUPABASE_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Baki_-_";

const SEED = {
  tanvirId: "11111111-1111-4111-8111-111111111111",
  riniId: "22222222-2222-4222-8222-222222222222",
  groupId: "33333333-3333-4333-8333-333333333333"
} as const;

const outsider = {
  id: randomUUID(),
  email: `rls-outsider-${Date.now()}-${randomUUID()}@example.test`,
  phone: `+88017${Math.floor(Math.random() * 100_000_000)
    .toString()
    .padStart(8, "0")}`
};

const outsiderGroup = {
  id: randomUUID(),
  inviteCode: randomUUID().replace(/-/g, "").slice(0, 6).toLowerCase()
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
  return runSql(`
    begin;
    set local "request.jwt.claim.sub" = ${sqlLiteral(userId)};
    set local "request.jwt.claim.role" = 'authenticated';
    set local "request.jwt.claims" = ${sqlLiteral(JSON.stringify({ sub: userId, role: "authenticated" }))};
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

function createOutsiderFixture(): void {
  cleanupOutsiderFixture();

  // Outsider user + profile.
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
    values (${sqlLiteral(outsider.id)}::uuid, 'Outsider', ${sqlLiteral(outsider.phone)}, 'bn');
  `);

  // A second group that Tanvir/Rini are NOT members of. The
  // add_group_creator_member trigger inserts the outsider as the admin.
  runSql(`
    insert into public.groups (id, name, template, invite_code, created_by)
    values (
      ${sqlLiteral(outsiderGroup.id)}::uuid,
      'Outsider Mess',
      'mess',
      ${sqlLiteral(outsiderGroup.inviteCode)},
      ${sqlLiteral(outsider.id)}::uuid
    );
  `);
}

function cleanupOutsiderFixture(): void {
  runSql(`
    delete from public.groups where id = ${sqlLiteral(outsiderGroup.id)}::uuid;
    delete from public.profiles where id = ${sqlLiteral(outsider.id)}::uuid;
    delete from auth.users where id = ${sqlLiteral(outsider.id)}::uuid;
  `);
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(`[db tests] Skipping cross-user RLS suite: ${readiness.reason}.\n`);
}

const describeIfDb = readiness.ok ? describe : describe.skip;
const suiteName = readiness.ok
  ? "cross-user RLS, accept_invite, simplify_debts, get_group_balances"
  : `cross-user RLS (skipped: ${readiness.reason})`;

describeIfDb(suiteName, () => {
  beforeAll(() => {
    createOutsiderFixture();
  });

  afterAll(() => {
    cleanupOutsiderFixture();
  });

  it("an outsider cannot SELECT another group's row", () => {
    const count = Number(
      runAsAuthenticated(
        outsider.id,
        `select count(*)::int from public.groups where id = ${sqlLiteral(SEED.groupId)}::uuid;`
      )
    );
    expect(count).toBe(0);
  });

  it("an outsider cannot SELECT another group's expenses, shares, settlements, or activity_log", () => {
    const counts = runAsAuthenticated(
      outsider.id,
      `
        select
          (select count(*)::int from public.expenses        where group_id = ${sqlLiteral(SEED.groupId)}::uuid) || ',' ||
          (select count(*)::int from public.expense_shares  where expense_id in (
              select id from public.expenses where group_id = ${sqlLiteral(SEED.groupId)}::uuid)) || ',' ||
          (select count(*)::int from public.settlements     where group_id = ${sqlLiteral(SEED.groupId)}::uuid) || ',' ||
          (select count(*)::int from public.activity_log    where group_id = ${sqlLiteral(SEED.groupId)}::uuid);
      `
    );
    expect(counts).toBe("0,0,0,0");
  });

  it("an outsider cannot direct-INSERT into group_members for a foreign group", () => {
    let blocked = false;
    try {
      runAsAuthenticated(
        outsider.id,
        `insert into public.group_members (group_id, user_id, role)
         values (${sqlLiteral(SEED.groupId)}::uuid, ${sqlLiteral(outsider.id)}::uuid, 'member');`
      );
    } catch (err) {
      blocked = String(err).includes("row-level security") || String(err).includes("violates");
    }
    expect(blocked).toBe(true);
  });

  it("an outsider joining via accept_invite succeeds and then can read the group", () => {
    // We must run this without the surrounding rollback so the insert persists
    // long enough to query, but we still need to clean up afterwards. Use a
    // dedicated savepoint-style block.
    const inviteCode = "sajek1";
    try {
      runSql(`
        begin;
        set local "request.jwt.claim.sub" = ${sqlLiteral(outsider.id)};
        set local "request.jwt.claim.role" = 'authenticated';
        set local role authenticated;
        select public.accept_invite(${sqlLiteral(inviteCode)});
        reset role;
        commit;
      `);

      const visible = Number(
        runAsAuthenticated(
          outsider.id,
          `select count(*)::int from public.groups where id = ${sqlLiteral(SEED.groupId)}::uuid;`
        )
      );
      expect(visible).toBe(1);
    } finally {
      runSql(`
        delete from public.activity_log
         where group_id = ${sqlLiteral(SEED.groupId)}::uuid
           and actor_id = ${sqlLiteral(outsider.id)}::uuid;
        delete from public.group_members
         where group_id = ${sqlLiteral(SEED.groupId)}::uuid
           and user_id = ${sqlLiteral(outsider.id)}::uuid;
      `);
    }
  });

  it("simplify_debts raises for a non-member", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        outsider.id,
        `select * from public.simplify_debts(${sqlLiteral(SEED.groupId)}::uuid);`
      );
    } catch (err) {
      raised = String(err).includes("not_group_member");
    }
    expect(raised).toBe(true);
  });

  it("get_group_balances raises for a non-member", () => {
    let raised = false;
    try {
      runAsAuthenticated(
        outsider.id,
        `select * from public.get_group_balances(${sqlLiteral(SEED.groupId)}::uuid);`
      );
    } catch (err) {
      raised = String(err).includes("not_group_member");
    }
    expect(raised).toBe(true);
  });

  it("get_group_balances returns expected nets for the seeded group", () => {
    const raw = runAsAuthenticated(
      SEED.tanvirId,
      `select user_id::text || ':' || net_paisa::text
         from public.get_group_balances(${sqlLiteral(SEED.groupId)}::uuid)
         order by net_paisa desc;`
    );
    const rows = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [user_id, net] = line.split(":");
        return { user_id, net_paisa: Number(net) };
      });
    // Tanvir paid 170k, shares 125k, received settlement 25k => +20000
    // Rini   paid  80k, shares 125k, sent     settlement 25k => -20000
    expect(rows).toEqual([
      { user_id: SEED.tanvirId, net_paisa: 20_000 },
      { user_id: SEED.riniId, net_paisa: -20_000 }
    ]);
  });

  it("an unauthenticated (anon) caller sees no groups", () => {
    const count = Number(runAsAnon(`select count(*)::int from public.groups;`));
    expect(count).toBe(0);
  });

  it("an unauthenticated caller cannot invoke accept_invite", () => {
    let blocked = false;
    try {
      runAsAnon(`select public.accept_invite('sajek1');`);
    } catch (err) {
      blocked =
        String(err).includes("permission denied") || String(err).includes("not_authenticated");
    }
    expect(blocked).toBe(true);
  });

  it("an unauthenticated caller cannot invoke delete_my_account", () => {
    let blocked = false;
    try {
      runAsAnon(`select public.delete_my_account();`);
    } catch (err) {
      blocked =
        String(err).includes("permission denied") || String(err).includes("not_authenticated");
    }
    expect(blocked).toBe(true);
  });

  it("delete_my_account refuses a user with a non-zero net balance", () => {
    // Tanvir has +20000 paisa in the seed group, so deletion must be blocked.
    let raised = false;
    try {
      runAsAuthenticated(SEED.tanvirId, `select public.delete_my_account();`);
    } catch (err) {
      raised = String(err).includes("unsettled_balances");
    }
    expect(raised).toBe(true);
  });

  it("the tombstone profile exists and is filterable by id", () => {
    const exists = Number(
      runAsAuthenticated(
        SEED.tanvirId,
        `select count(*)::int from public.profiles
          where id = '00000000-0000-0000-0000-000000000000'::uuid;`
      )
    );
    // The tombstone is owned by no group, so RLS may still hide it from the
    // SELECT path; the schema-level row, however, is guaranteed to exist.
    // Re-check via the service-side count (anon can't see it either):
    const adminCount = Number(
      runSql(
        `select count(*)::int from public.profiles
          where id = '00000000-0000-0000-0000-000000000000'::uuid;`
      )
    );
    expect(adminCount).toBe(1);
    // The authenticated SELECT may legitimately be 0 due to RLS — we don't
    // assert a specific value, only that the row physically exists.
    expect(Number.isFinite(exists)).toBe(true);
  });
});
