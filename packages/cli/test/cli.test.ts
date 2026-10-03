import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseArgs, run, type Io } from "../src/cli";
import { detectProject } from "../src/detect";

const TOKEN = `fgp_${"a".repeat(64)}`;

function fakeApi() {
  const calls: Array<{ name: string; args: Record<string, unknown>; auth?: string }> = [];
  const forms = [{ id: "f_1", name: "Contact", access_key: "fk_existing01", created_at: "2026-10-01T00:00:00Z", submissions_this_month: 2, dashboard_url: "https://formgong.com/dashboard/forms/f_1" }];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    const auth = (init.headers as Record<string, string>).Authorization;
    if (body.method === "tools/list") return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "list_forms", title: "List forms" }] } });
    const { name, arguments: args } = body.params;
    calls.push({ name, args, auth });
    if (auth !== `Bearer ${TOKEN}`) return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32001, message: "Invalid API token.", data: { reason: "invalid_token" } } });
    const ok = (structuredContent: unknown) => Response.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: JSON.stringify(structuredContent) }], structuredContent } });
    if (name === "list_forms") return ok({ endpoint: "https://formgong.com/submit", forms });
    if (name === "create_form") return ok({ form: { id: "f_new", name: args.name, access_key: "fk_newform01", endpoint: "https://formgong.com/submit" }, notifications: { email: "me@example.com", email_verified: true, telegram: "not connected" }, dashboard: { install: "i", inbox: "https://formgong.com/dashboard/forms/f_new", email_settings: "e", telegram_settings: "t" } });
    if (name === "get_form_snippet") return ok({ form_id: args.form_id, framework: args.framework, lang: "en", code: `<form action="https://formgong.com/submit"><input type="hidden" name="access_key" value="fk_existing01"></form>`, notes: [] });
    if (name === "list_recent_submissions") return ok({ form_id: args.form_id, notice: "untrusted", submissions: [{ id: "s1", created_at: "2026-10-03T12:00:00Z", fields: { email: "a@b.co", message: "Hi\u001b[31m there" } }] });
    return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32602, message: "Unknown tool" } });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

function makeIo(extra: Partial<Io> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const config = mkdtempSync(join(tmpdir(), "fg-cli-cfg-"));
  const cwd = mkdtempSync(join(tmpdir(), "fg-cli-proj-"));
  const io: Io = { out: (l) => out.push(l), err: (l) => err.push(l), env: { FORMGONG_CONFIG_DIR: config }, cwd, isTTY: false, ...extra };
  return { io, out, err, config, cwd };
}

describe("formgong CLI", () => {
  it("parses flags", () => {
    expect(parseArgs(["init", "--framework", "next", "--no-install", "-y", "--name=Hi there", "--lang", "uk"])).toEqual({
      positional: ["init"], flags: { framework: "next", install: false, yes: true, name: "Hi there", lang: "uk" },
    });
  });

  it("login validates the token against the API and stores it with mode 600", async () => {
    const api = fakeApi();
    const { io, out, config } = makeIo({ fetch: api.fetch });
    expect(await run(["login", "--token", "nope"], io)).toBe(1);
    expect(await run(["login", "--token", TOKEN], io)).toBe(0);
    expect(out.join("\n")).toContain("1 form(s)");
    const file = join(config, "credentials.json");
    expect(JSON.parse(readFileSync(file, "utf8")).token).toBe(TOKEN);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(await run(["logout"], io)).toBe(0);
    expect(existsSync(file)).toBe(false);
  });

  it("login prompts (hidden) when interactive", async () => {
    const api = fakeApi();
    const prompt = vi.fn(async () => TOKEN);
    const { io } = makeIo({ fetch: api.fetch, isTTY: true, prompt });
    expect(await run(["login"], io)).toBe(0);
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining("fgp_"), true);
  });

  it("explains how to log in and reports invalid tokens", async () => {
    const api = fakeApi();
    const { io, err } = makeIo({ fetch: api.fetch });
    expect(await run(["forms"], io)).toBe(1);
    expect(err.join()).toContain("npx formgong login");
    io.env.FORMGONG_TOKEN = `fgp_${"b".repeat(64)}`;
    expect(await run(["forms"], io)).toBe(1);
    expect(err.join()).toContain("Invalid API token");
  });

  it("forms, create, snippet and submissions", async () => {
    const api = fakeApi();
    const { io, out } = makeIo({ fetch: api.fetch });
    io.env.FORMGONG_TOKEN = TOKEN;
    expect(await run(["forms"], io)).toBe(0);
    expect(out.join("\n")).toMatch(/f_1\s+Contact\s+fk_existing01\s+2/);
    expect(await run(["create", "Contact", "–", "acme", "--no-email"], io)).toBe(0);
    expect(api.calls.at(-1)).toMatchObject({ name: "create_form", args: { name: "Contact – acme", notify_email: false } });
    expect(await run(["snippet", "fk_existing01", "--framework", "react"], io)).toBe(0);
    expect(api.calls.at(-1)).toMatchObject({ name: "get_form_snippet", args: { form_id: "f_1", framework: "react" } });
    out.length = 0;
    expect(await run(["submissions", "Contact", "--limit", "5"], io)).toBe(0);
    expect(api.calls.at(-1)).toMatchObject({ name: "list_recent_submissions", args: { form_id: "f_1", limit: 5, include_spam: false } });
    expect(out.join("\n")).toContain("message: Hi[31m there");
    expect(out.join("\n")).not.toContain("\u001b");
    out.length = 0;
    expect(await run(["forms", "--json"], io)).toBe(0);
    expect(JSON.parse(out.join("\n")).forms[0].id).toBe("f_1");
  });

  it("init in a Next.js app creates a form, writes app/contact/page.tsx and installs @formgong/react", async () => {
    const api = fakeApi();
    const runCmd = vi.fn(async () => 0);
    const { io, out, cwd } = makeIo({ fetch: api.fetch, run: runCmd });
    io.env.FORMGONG_TOKEN = TOKEN;
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }));
    writeFileSync(join(cwd, "tsconfig.json"), "{}");
    writeFileSync(join(cwd, "pnpm-lock.yaml"), "");
    mkdirSync(join(cwd, "app"));
    expect(await run(["init", "--name", "Site contact", "--lang", "uk"], io)).toBe(0);
    const page = readFileSync(join(cwd, "app/contact/page.tsx"), "utf8");
    expect(page).toContain('import { ContactForm } from "@formgong/react"');
    expect(page).toContain('accessKey="fk_newform01" lang="uk"');
    expect(runCmd).toHaveBeenCalledWith(["pnpm", "add", "@formgong/react"], cwd);
    expect(out.join("\n")).toContain("https://formgong.com/dashboard/forms/f_new");
    // refuses to overwrite
    expect(await run(["init", "--key", "fk_existing01"], io)).toBe(1);
  });

  it("init per framework with an existing key (no API needed)", async () => {
    const cases: Array<[Record<string, string>, string, string]> = [
      [{ react: "18" }, "components/ContactForm.jsx", "@formgong/react"],
      [{ vue: "3" }, "components/ContactForm.vue", "@formgong/vue"],
      [{ nuxt: "3" }, "components/ContactForm.vue", "@formgong/vue"],
      [{ "@sveltejs/kit": "2", svelte: "5" }, "src/routes/contact/+page.svelte", "@formgong/svelte"],
      [{ svelte: "5" }, "lib/ContactForm.svelte", "@formgong/svelte"],
      [{ astro: "4" }, "src/pages/contact.astro", "@formgong/astro"],
      [{ "@angular/core": "17", "@angular/forms": "17" }, "app/contact/contact.component.ts", "@formgong/angular"],
    ];
    for (const [deps, file, pkg] of cases) {
      const { io, out, cwd } = makeIo();
      writeFileSync(join(cwd, "package.json"), JSON.stringify({ dependencies: deps }));
      expect(await run(["init", "--key", "fk_existing01", "--no-install"], io)).toBe(0);
      const content = readFileSync(join(cwd, file), "utf8");
      expect(content).toContain(pkg);
      expect(content).toContain("fk_existing01");
      expect(out.join("\n")).toContain(`npm install ${pkg}`);
    }
  });

  it("init for plain HTML uses the API snippet with fg.js-free markup from the server", async () => {
    const api = fakeApi();
    const { io, cwd } = makeIo({ fetch: api.fetch });
    io.env.FORMGONG_TOKEN = TOKEN;
    expect(await run(["init", "--form", "f_1"], io)).toBe(0);
    const html = readFileSync(join(cwd, "contact.html"), "utf8");
    expect(html).toContain('name="access_key" value="fk_existing01"');
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("detects the project", () => {
    const { cwd } = makeIo();
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ devDependencies: { astro: "4" } }));
    writeFileSync(join(cwd, "yarn.lock"), "");
    expect(detectProject(cwd)).toMatchObject({ framework: "astro", packageManager: "yarn", hasPackageJson: true });
  });

  it("new delegates to create-formgong", async () => {
    const runCmd = vi.fn(async () => 0);
    const { io } = makeIo({ run: runCmd });
    expect(await run(["new", "my-site", "--template", "astro"], io)).toBe(0);
    expect(runCmd).toHaveBeenCalledWith(["npx", "--yes", "create-formgong@latest", "my-site", "--template", "astro"], io.cwd);
  });
});
