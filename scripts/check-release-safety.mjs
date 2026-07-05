import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cwd, exit } from "node:process";

const repoRoot = cwd();
const ignoredDirectories = new Set([".git", ".turbo", "node_modules"]);

const checks = [
  {
    message: "Mobile code must not reference a Supabase service-role key.",
    paths: ["apps/mobile"],
    pattern: /service[_-]?role|SUPABASE_SERVICE_ROLE/i
  },
  {
    message: "Mobile code must not write directly to ledger lifecycle tables.",
    paths: ["apps/mobile"],
    pattern:
      /\.from\(\s*["'`](groups|group_members|expenses|expense_shares|settlements|activity_log)["'`]\s*\)\s*\.(insert|update|delete|upsert)/s
  },
  {
    message: "Use safer benchmark wording for product comparisons.",
    paths: ["AGENTS.md", "README.md", "TASKS.md", "apps", "docs", "e2e", "packages", "tasks"],
    pattern: /Splitwise[\s-]+style/i
  },
  {
    message:
      "Agent guidance must keep payments scoped to MFS handoff, not Stripe or merchant checkout.",
    paths: ["AGENTS.md", "CLAUDE.md", ".claude/agents"],
    pattern:
      /payments-engineer[^\n]*Stripe|Future:\s*merchant API|When we integrate the bKash merchant API|Token-based checkout|Webhook handler in a Supabase edge function|settlements\.external_ref/i
  },
  {
    message:
      "Canonical payment architecture must not list deferred Stripe/custom checkout as payment tech.",
    paths: ["docs/ARCHITECTURE.md"],
    pattern: /Stripe\s*[—-]\s*v3\s+only|international users\s*\(deferred\)/i
  },
  {
    message:
      "Guidance must frame card/bank as manual outside-app records, not a payment-processing fallback.",
    paths: ["AGENTS.md", "CLAUDE.md", ".claude/agents", "docs"],
    pattern: /card\/bank transfer is a fallback|bank\/card transfer is a fallback/i
  }
];

function walk(path) {
  const absolutePath = join(repoRoot, path);
  const stat = statSync(absolutePath, { throwIfNoEntry: false });
  if (!stat) return [];

  if (stat.isFile()) return [absolutePath];

  if (!stat.isDirectory()) return [];

  const basename = absolutePath.split("/").at(-1);
  if (basename && ignoredDirectories.has(basename)) return [];

  return readdirSync(absolutePath).flatMap((entry) =>
    walk(relative(repoRoot, join(absolutePath, entry)))
  );
}

const failures = [];

for (const check of checks) {
  for (const path of check.paths.flatMap(walk)) {
    const content = readFileSync(path, "utf8");
    if (check.pattern.test(content)) {
      failures.push(`${relative(repoRoot, path)}: ${check.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  exit(1);
}

console.log("Release safety scan passed.");
