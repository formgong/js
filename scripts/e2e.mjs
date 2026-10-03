#!/usr/bin/env node
/**
 * End-to-end check of the built packages against a Formgong deployment.
 *
 *   FORMGONG_BASE_URL=https://formgong.com FORMGONG_TOKEN=fgp_... node scripts/e2e.mjs
 *   FORMGONG_BASE_URL=... FORMGONG_ACCESS_KEY=fk_... node scripts/e2e.mjs   # submit-only
 *
 * With a token it runs the CLI (login, create, forms, init, snippet, submissions) on a temporary
 * form named "SDK e2e <timestamp>". Formgong's API has no delete tool yet: delete that form in the
 * dashboard (or via SQL) afterwards. Without a token it only submits to FORMGONG_ACCESS_KEY.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTracker, submit, FormgongError } from "../packages/core/dist/index.js";
import { FormgongApi } from "../packages/core/dist/api.js";

const base = (process.env.FORMGONG_BASE_URL || "https://formgong.com").replace(/\/+$/, "");
const token = process.env.FORMGONG_TOKEN;
let accessKey = process.env.FORMGONG_ACCESS_KEY;
const cli = join(import.meta.dirname, "../packages/cli/dist/bin.js");
const config = mkdtempSync(join(tmpdir(), "fg-e2e-cfg-"));
const env = { ...process.env, FORMGONG_CONFIG_DIR: config, FORMGONG_API_URL: `${base}/mcp`, NO_COLOR: "1" };
delete env.FORMGONG_TOKEN;
const results = [];
const step = async (name, fn) => {
  try { const detail = await fn(); results.push(["ok", name, detail ?? ""]); console.log(`✔ ${name}${detail ? `: ${detail}` : ""}`); }
  catch (e) { results.push(["fail", name, e.message]); console.log(`✖ ${name}: ${e.message}${e.code ? ` [${e.code} HTTP ${e.status}] ${JSON.stringify(e.body ?? null)}` : ""}`); }
};
const run = (args, cwd) => execFileSync(process.execPath, [cli, ...args], { env, cwd, encoding: "utf8" });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

let formId;
if (token) {
  await step("cli login (token via --stdin)", () => {
    const out = execFileSync(process.execPath, [cli, "login", "--stdin"], { env, input: token, encoding: "utf8" });
    assert(out.includes("Logged in"), out);
    assert(readFileSync(join(config, "credentials.json"), "utf8").includes("fgp_"), "credentials not saved");
  });
  await step("cli create", () => {
    const out = JSON.parse(run(["create", `SDK e2e ${new Date().toISOString()}`, "--no-email", "--json"]));
    formId = out.form.id; accessKey = out.form.access_key;
    return `${formId} ${accessKey.slice(0, 7)}…`;
  });
  await step("cli forms", () => { const out = run(["forms"]); assert(out.includes(formId), out); });
  await step("cli init --framework next (package mode)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fg-e2e-next-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }));
    run(["init", "--form", formId, "--no-install"], dir);
    const page = readFileSync(join(dir, "app/contact/page.jsx"), "utf8");
    assert(page.includes(accessKey), "key missing in page");
  });
  await step("cli init (plain HTML via get_form_snippet)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fg-e2e-html-"));
    run(["init", "--form", formId, "--lang", "uk"], dir);
    const html = readFileSync(join(dir, "contact.html"), "utf8");
    assert(html.includes(accessKey) && html.includes("botcheck") && html.includes('name="_lang"'), "snippet incomplete");
  });
  await step("cli snippet --framework react", () => { const out = run(["snippet", accessKey, "--framework", "react"]); assert(out.includes("export default function ContactForm"), out.slice(0, 200)); });
}

if (!accessKey) { console.log("No FORMGONG_TOKEN or FORMGONG_ACCESS_KEY: nothing to submit to."); process.exit(1); }

await step("core submit (JSON, server style, no signals)", async () => {
  const r = await submit(accessKey, { name: "SDK e2e", email: "e2e@example.com", message: "core JSON submit" }, { endpoint: `${base}/submit`, lang: "en", subject: "SDK e2e" });
  assert(r.success && r.id, JSON.stringify(r));
  return r.id;
});

await step("core submit (FormData + browser-style tracker with real PoW)", async () => {
  const target = new EventTarget();
  target.name = "message";
  const tracker = createTracker(target, accessKey, { baseUrl: base });
  target.dispatchEvent(new Event("focusin"));
  for (let i = 0; i < 24; i++) target.dispatchEvent(new Event("keydown"));
  target.dispatchEvent(new Event("input"));
  await new Promise((r) => setTimeout(r, 2500)); // a person takes a few seconds
  const signals = await tracker.signals(5000);
  assert(signals._fg_pow.includes("~"), `pow not solved: ${signals._fg_pow}`);
  const fd = new FormData();
  fd.set("name", "SDK e2e"); fd.set("email", "e2e@example.com"); fd.set("message", "core FormData submit with tracker");
  const r = await submit(accessKey, fd, { endpoint: `${base}/submit`, tracker });
  tracker.destroy();
  assert(r.success, JSON.stringify(r));
  return `${r.id} (${signals._fg_b})`;
});

await step("core typed error for an unknown key", async () => {
  try { await submit("fk_doesnotexist_e2e", { a: "1" }, { endpoint: `${base}/submit` }); throw new Error("expected failure"); }
  catch (e) { assert(e instanceof FormgongError && e.code === "unknown_access_key" && e.status === 404, `${e.code} ${e.status}`); return `${e.code} ${e.status}`; }
});

if (token) {
  await step("cli submissions --spam (both stored, not spam)", () => {
    const out = JSON.parse(run(["submissions", formId, "--spam", "--json"]));
    assert(out.submissions.length >= 2, `only ${out.submissions.length}`);
    assert(out.submissions.every((s) => s.spam === false), JSON.stringify(out.submissions.map((s) => s.spam)));
    return `${out.submissions.length} submissions, spam=false`;
  });
  await step("api tools/list (no token)", async () => { const tools = await new FormgongApi({ url: `${base}/mcp` }).tools(); return tools.map((t) => t.name).join(","); });
  run(["logout"]);
}

console.log(JSON.stringify({ base, formId: formId ?? null, ok: results.filter((r) => r[0] === "ok").length, failed: results.filter((r) => r[0] === "fail").length }));
process.exit(results.some((r) => r[0] === "fail") ? 1 : 0);
