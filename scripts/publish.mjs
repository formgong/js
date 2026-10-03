#!/usr/bin/env node
/**
 * Publish every public workspace package whose current version is not on npm yet,
 * with npm provenance. Used by .github/workflows/release.yml (manual trigger only).
 *
 *   node scripts/publish.mjs            # dry run: shows what would be published
 *   node scripts/publish.mjs --publish  # really publish (CI only: provenance needs GitHub OIDC)
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const really = process.argv.includes("--publish");
const root = join(import.meta.dirname, "..");
// Publish order: dependencies first.
const order = ["core", "react", "vue", "svelte", "astro", "next", "cli", "create-formgong"];
const dirs = readdirSync(join(root, "packages")).sort((a, b) => order.indexOf(a) - order.indexOf(b));

const onNpm = (name, version) => {
  try {
    return execFileSync("npm", ["view", `${name}@${version}`, "version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() === version;
  } catch {
    return false;
  }
};

let failed = false;
for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
  if (pkg.private) continue;
  if (onNpm(pkg.name, pkg.version)) { console.log(`= ${pkg.name}@${pkg.version} already on npm`); continue; }
  const args = ["publish", "--provenance", "--access", "public", "--no-git-checks", ...(really ? [] : ["--dry-run"])];
  console.log(`${really ? "→" : "(dry run)"} pnpm ${args.join(" ")}  # ${pkg.name}@${pkg.version}`);
  try {
    execFileSync("pnpm", args, { cwd: join(root, "packages", dir), stdio: "inherit" });
  } catch {
    failed = true;
    console.error(`✖ ${pkg.name}@${pkg.version} failed`);
  }
}
process.exit(failed ? 1 : 0);
