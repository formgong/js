import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const FRAMEWORKS = ["next", "react", "vue", "nuxt", "svelte", "sveltekit", "astro", "angular", "html"] as const;
export type Framework = (typeof FRAMEWORKS)[number];
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type Project = { framework: Framework; packageManager: PackageManager; hasPackageJson: boolean; srcDir: boolean; typescript: boolean; appRouter: boolean };

function deps(dir: string): Record<string, string> | null {
  const file = join(dir, "package.json");
  if (!existsSync(file)) return null;
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  return "npm";
}

export function detectProject(dir: string): Project {
  const d = deps(dir);
  const has = (name: string) => Boolean(d && name in d);
  let framework: Framework = "html";
  if (has("next")) framework = "next";
  else if (has("astro")) framework = "astro";
  else if (has("@angular/core")) framework = "angular";
  else if (has("@sveltejs/kit")) framework = "sveltekit";
  else if (has("svelte")) framework = "svelte";
  else if (has("nuxt")) framework = "nuxt";
  else if (has("vue")) framework = "vue";
  else if (has("react")) framework = "react";
  const srcDir = existsSync(join(dir, "src"));
  const appRouter = existsSync(join(dir, "src", "app")) || existsSync(join(dir, "app")) || !(existsSync(join(dir, "pages")) || existsSync(join(dir, "src", "pages")));
  return {
    framework,
    packageManager: detectPackageManager(dir),
    hasPackageJson: d !== null,
    srcDir,
    typescript: existsSync(join(dir, "tsconfig.json")) || has("typescript"),
    appRouter,
  };
}

export function installCommand(pm: PackageManager, pkg: string): string[] {
  if (pm === "npm") return ["npm", "install", pkg];
  if (pm === "pnpm") return ["pnpm", "add", pkg];
  if (pm === "yarn") return ["yarn", "add", pkg];
  return ["bun", "add", pkg];
}
