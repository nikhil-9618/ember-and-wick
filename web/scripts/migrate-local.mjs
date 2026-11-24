#!/usr/bin/env node
/**
 * Applies every file in migrations/, in filename order, to the D1 database.
 *
 *   node scripts/migrate-local.mjs            # local (wrangler dev) database
 *   node scripts/migrate-local.mjs --remote   # the deployed database
 *
 * Each migration is applied once. Files are idempotent (IF NOT EXISTS) except for
 * ALTER TABLE statements, which is why new columns are only ever added in a new
 * migration file.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const remote = process.argv.includes("--remote");

const files = readdirSync(join(root, "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  console.log(`\n→ ${file}`);
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "DB",
      ...(remote ? ["--remote"] : ["--local"]),
      "--config",
      process.env.WRANGLER_CONFIG ?? "freebuff.wrangler.jsonc",
      "--file",
      join("migrations", file),
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nApplied ${files.length} migration(s) to the ${remote ? "remote" : "local"} database.`);
