import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const generatedTypesPath = resolve(packageRoot, "src/types.ts");
const required = process.env.CI === "true" || process.env.BAKI_DB_TYPES_REQUIRED === "true";

function normalize(content) {
  return content.replace(/\r\n/g, "\n").trimEnd();
}

let generated;

try {
  generated = execFileSync(
    "supabase",
    ["gen", "types", "--lang=typescript", "--local", "--workdir", "../.."],
    {
      cwd: packageRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000
    }
  );
} catch (error) {
  const reason = error.stderr?.toString().trim() || error.message;
  const message = [
    "[db types] Could not generate Supabase types from the local database.",
    reason,
    "Start/reset Supabase first, then run `pnpm --filter @baki/db gen:types`."
  ].join("\n");

  if (required) {
    console.error(message);
    process.exit(1);
  }

  console.warn(`${message}\n[db types] Skipping stale-type comparison outside CI.`);
  process.exit(0);
}

const committed = normalize(readFileSync(generatedTypesPath, "utf8"));

if (normalize(generated) !== committed) {
  console.error(
    [
      "[db types] packages/db/src/types.ts is stale.",
      "Run `pnpm --filter @baki/db gen:types` after applying all migrations, then commit the regenerated file."
    ].join("\n")
  );
  process.exit(1);
}

console.log("[db types] Generated Supabase types match packages/db/src/types.ts.");
