import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Credentials = { token: string; apiUrl?: string; savedAt: string };

/** ~/.config/formgong (XDG), %APPDATA%\formgong on Windows, or $FORMGONG_CONFIG_DIR. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.FORMGONG_CONFIG_DIR) return env.FORMGONG_CONFIG_DIR;
  if (process.platform === "win32" && env.APPDATA) return join(env.APPDATA, "formgong");
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "formgong");
}

export function credentialsPath(env?: NodeJS.ProcessEnv): string {
  return join(configDir(env), "credentials.json");
}

export function readCredentials(env?: NodeJS.ProcessEnv): Credentials | null {
  const file = credentialsPath(env);
  if (!existsSync(file)) return null;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as Credentials;
    return typeof data.token === "string" && data.token ? data : null;
  } catch {
    return null;
  }
}

export function saveCredentials(creds: Credentials, env?: NodeJS.ProcessEnv): string {
  const dir = configDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = credentialsPath(env);
  writeFileSync(file, `${JSON.stringify(creds, null, 2)}\n`, { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* Windows */ }
  return file;
}

export function deleteCredentials(env?: NodeJS.ProcessEnv): boolean {
  const file = credentialsPath(env);
  if (!existsSync(file)) return false;
  rmSync(file);
  return true;
}
