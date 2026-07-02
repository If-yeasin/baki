import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const DB_URL = process.env.DB_URL ?? DEFAULT_DB_URL;
const PSQL_BIN = "psql";
const SUPABASE_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Baki_-_";

const SEED = {
  groupId: "33333333-3333-4333-8333-333333333333",
  riniId: "22222222-2222-4222-8222-222222222222",
  tanvirId: "11111111-1111-4111-8111-111111111111"
} as const;

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
    set local "request.jwt.claims" = ${sqlLiteral(JSON.stringify({ role: "authenticated", sub: userId }))};
    set local role authenticated;

    ${sql}

    rollback;
  `);
}

function runJsonAsAuthenticated<T>(userId: string, sql: string): T {
  return JSON.parse(runAsAuthenticated(userId, sql)) as T;
}

const readiness = checkReadiness();

if (!readiness.ok) {
  process.stderr.write(`[db tests] Skipping group lifecycle RPC suite: ${readiness.reason}.\n`);
}

const describeIfDb = readiness.ok ? describe : describe.skip;

describeIfDb("group lifecycle RPCs", () => {
  it("create_group is idempotent by creator and client mutation id", () => {
    const summary = runJsonAsAuthenticated<{
      activityCount: number;
      firstGroupId: string;
      groupCount: number;
      memberCount: number;
      secondGroupId: string;
    }>(
      SEED.tanvirId,
      `
        create temporary table created_groups (
          attempt integer primary key,
          id uuid not null
        ) on commit drop;

        insert into created_groups (attempt, id)
        select 1, public.create_group(
          p_name := 'Release Candidate Trip',
          p_template := 'trip',
          p_client_mutation_id := 'group-lifecycle-test'
        );

        insert into created_groups (attempt, id)
        select 2, public.create_group(
          p_name := 'Release Candidate Trip',
          p_template := 'trip',
          p_client_mutation_id := 'group-lifecycle-test'
        );

        select jsonb_build_object(
          'firstGroupId', (select id::text from created_groups where attempt = 1),
          'secondGroupId', (select id::text from created_groups where attempt = 2),
          'groupCount', (
            select count(*)::int
            from public.groups
            where client_mutation_id = 'group-lifecycle-test'
          ),
          'memberCount', (
            select count(*)::int
            from public.group_members
            where group_id = (select id from created_groups where attempt = 1)
              and user_id = ${sqlLiteral(SEED.tanvirId)}::uuid
              and role = 'admin'
              and left_at is null
          ),
          'activityCount', (
            select count(*)::int
            from public.activity_log
            where group_id = (select id from created_groups where attempt = 1)
              and event_type = 'group_created'
          )
        )::text;
      `
    );

    expect(summary.firstGroupId).toBe(summary.secondGroupId);
    expect(summary.groupCount).toBe(1);
    expect(summary.memberCount).toBe(1);
    expect(summary.activityCount).toBe(1);
  });

  it("admin group edits emit activity events", () => {
    const summary = runJsonAsAuthenticated<{
      archivedAt: string | null;
      inviteChanged: boolean;
      name: string;
      template: string;
      events: string[];
    }>(
      SEED.tanvirId,
      `
        create temporary table target_group (
          id uuid primary key,
          old_invite_code text
        ) on commit drop;

        insert into target_group (id)
        values (public.create_group(
          p_name := 'Editable Khata',
          p_template := 'custom',
          p_client_mutation_id := 'group-lifecycle-edit-test'
        ));

        update target_group tg
        set old_invite_code = g.invite_code
        from public.groups g
        where g.id = tg.id;

        do $$
        begin
          perform public.rename_group((select id from target_group), 'Renamed Khata');
          perform public.update_group_template((select id from target_group), 'mess');
          perform public.regenerate_group_invite((select id from target_group));
          perform public.archive_group((select id from target_group));
        end
        $$;

        select jsonb_build_object(
          'name', (select name from public.groups where id = (select id from target_group)),
          'template', (select template from public.groups where id = (select id from target_group)),
          'archivedAt', (select archived_at::text from public.groups where id = (select id from target_group)),
          'inviteChanged', (
            select g.invite_code <> tg.old_invite_code
            from public.groups g
            join target_group tg on tg.id = g.id
          ),
          'events', (
            select jsonb_agg(event_type order by created_at)
            from public.activity_log
            where group_id = (select id from target_group)
              and event_type in (
                'group_created',
                'group_renamed',
                'group_template_changed',
                'invite_regenerated',
                'group_archived'
              )
          )
        )::text;
      `
    );

    expect(summary.name).toBe("Renamed Khata");
    expect(summary.template).toBe("mess");
    expect(summary.archivedAt).toBeTruthy();
    expect(summary.inviteChanged).toBe(true);
    expect(summary.events).toEqual([
      "group_created",
      "group_renamed",
      "group_template_changed",
      "invite_regenerated",
      "group_archived"
    ]);
  });

  it("non-admin edits and last-admin leave are rejected", () => {
    const nonAdminRenameBlocked = (() => {
      try {
        runAsAuthenticated(
          SEED.riniId,
          `
            select public.rename_group(
              ${sqlLiteral(SEED.groupId)}::uuid,
              'Unsafe Rename'
            );
          `
        );
        return false;
      } catch (err) {
        return String(err).includes("admin_required");
      }
    })();

    const lastAdminLeaveBlocked = (() => {
      try {
        runAsAuthenticated(
          SEED.tanvirId,
          `
            create temporary table target_group (
              id uuid primary key
            ) on commit drop;

            insert into target_group (id)
            select public.create_group('Solo Khata', 'custom', 'solo-leave-test');

            select public.leave_group((select id from target_group));
          `
        );
        return false;
      } catch (err) {
        return String(err).includes("last_admin_cannot_leave");
      }
    })();

    expect(nonAdminRenameBlocked).toBe(true);
    expect(lastAdminLeaveBlocked).toBe(true);
  });
});
