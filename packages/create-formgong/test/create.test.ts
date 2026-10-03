import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const bin = join(process.cwd(), "index.js");
const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1", ...env } });

describe("create-formgong", () => {
  it("prints help and version", () => {
    expect(execFileSync(process.execPath, [bin, "--version"], { encoding: "utf8" }).trim()).toBe("0.2.0");
    const help = run(["--help"]).stdout;
    expect(help).toContain("--create-form");
    expect(help).toContain("npx formgong init");
  });

  it("validates key and template before downloading anything", () => {
    expect(run(["x", "--key", "nope", "-y"]).stderr).toContain("doesn't look like a Formgong access key");
    expect(run(["x", "--template", "rails", "-y"]).stderr).toContain('Unknown template "rails"');
  });

  it("--create-form without a token explains how to log in", () => {
    const dir = mkdtempSync(join(tmpdir(), "cf-"));
    const r = run([join(dir, "site"), "-y", "--create-form"], { FORMGONG_CONFIG_DIR: join(dir, "cfg"), FORMGONG_TOKEN: "" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("npx formgong login");
  });

  it("--create-form surfaces API errors", async () => {
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32001, message: "Invalid API token.", data: { reason: "invalid_token" } } }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const dir = mkdtempSync(join(tmpdir(), "cf-"));
    const r = await new Promise<{ status: number | null; stderr: string }>((resolve) => {
      const child = require("node:child_process").spawn(process.execPath, [bin, join(dir, "site"), "-y", "--create-form"], { env: { ...process.env, NO_COLOR: "1", FORMGONG_TOKEN: `fgp_${"c".repeat(64)}`, FORMGONG_API_URL: `http://127.0.0.1:${port}/mcp` } });
      let stderr = "";
      child.stderr.on("data", (d: Buffer) => { stderr += d; });
      child.on("close", (status: number) => resolve({ status, stderr }));
    });
    server.close();
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Invalid API token.");
  });
});
