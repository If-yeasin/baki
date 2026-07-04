import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const DB_URL = process.env.DB_URL ?? DEFAULT_DB_URL;
const PSQL_BIN = "psql";
const SUPABASE_DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_Baki_-_";
const required = process.env.CI === "true" || process.env.BAKI_DB_TESTS_REQUIRED === "true";

type SqlRunner = "docker" | "psql";

let sqlRunner: SqlRunner = "psql";

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

describe("database readiness gate", () => {
  it("fails loudly in CI when Supabase database tests cannot run", () => {
    const readiness = checkReadiness();

    if (!readiness.ok && !required) {
      process.stderr.write(
        `[db tests] Database readiness gate skipped outside CI: ${readiness.reason}.\n`
      );
      return;
    }

    expect(readiness).toEqual({ ok: true });
  });
});
