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
    message: "Mobile code must not insert directly into money tables.",
    paths: ["apps/mobile"],
    pattern: /\.from\(\s*["'`](expenses|expense_shares|settlements)["'`]\s*\)\s*\.insert/s
  },
  {
    message: "Use safer benchmark wording for product comparisons.",
    paths: ["AGENTS.md", "README.md", "TASKS.md", "apps", "docs", "e2e", "packages", "tasks"],
    pattern: /Splitwise[\s-]+style/i
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

  return readdirSync(absolutePath).flatMap((entry) => walk(relative(repoRoot, join(absolutePath, entry))));
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
