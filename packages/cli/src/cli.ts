/**
 * formgong CLI: create forms, add a contact form to your project and read submissions.
 * Uses the Formgong account API (MCP endpoint) with a personal API token (fgp_…).
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { DEFAULT_API_URL, FormgongApi, FormgongApiError, type FormSummary } from "@formgong/core/api";
import { credentialsPath, deleteCredentials, readCredentials, saveCredentials } from "./config.js";
import { detectProject, FRAMEWORKS, installCommand, type Framework } from "./detect.js";
import { htmlPage, scaffoldFor } from "./templates.js";

export const VERSION = "0.2.0";
const TOKEN_URL = "https://formgong.com/dashboard/account#api-tokens";

export type Io = {
  out: (line: string) => void;
  err: (line: string) => void;
  env: NodeJS.ProcessEnv;
  cwd: string;
  isTTY: boolean;
  prompt?: (question: string, hidden?: boolean) => Promise<string>;
  fetch?: typeof fetch;
  run?: (cmd: string[], cwd: string) => Promise<number>;
};

type Flags = Record<string, string | boolean>;

export function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  const short: Record<string, string> = { h: "help", v: "version", y: "yes", f: "framework", k: "key", n: "name", l: "limit", t: "token" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") { positional.push(...argv.slice(i + 1)); break; }
    if (arg.startsWith("--")) {
      const [rawName, inline] = arg.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
      if (rawName.startsWith("no-")) { flags[rawName.slice(3)] = false; continue; }
      const next = argv[i + 1];
      if (inline !== undefined) flags[rawName] = inline;
      else if (next !== undefined && !next.startsWith("-") && VALUE_FLAGS.has(rawName)) { flags[rawName] = next; i++; }
      else flags[rawName] = true;
    } else if (arg.startsWith("-") && arg.length > 1) {
      const name = short[arg.slice(1)] ?? arg.slice(1);
      const next = argv[i + 1];
      if (VALUE_FLAGS.has(name) && next !== undefined && !next.startsWith("-")) { flags[name] = next; i++; }
      else flags[name] = true;
    } else positional.push(arg);
  }
  return { positional, flags };
}

const VALUE_FLAGS = new Set(["framework", "key", "name", "limit", "token", "form", "lang", "dir", "api-url"]);

const color = (io: Io, code: number) => (text: string) => (io.isTTY && !io.env.NO_COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);

function help(io: Io) {
  const b = color(io, 1);
  io.out(`${b("formgong")} ${VERSION}: form backend for contact forms (https://formgong.com)

Usage: npx formgong <command> [options]

Commands:
  login                 Save a personal API token (fgp_…) from ${TOKEN_URL}
  logout                Remove the saved token
  init                  Create a form and add a contact form to this project
                          --framework ${FRAMEWORKS.join("|")} (auto-detected)
                          --name "Contact – acme.com"   --form <id>   --key <fk_…>
                          --lang uk   --dir <path>   --no-install   --force   --snippet
  forms                 List your forms
  create <name>         Create a form (--no-email to skip email notifications)
  snippet <form>        Print ready-to-paste code (--framework html|react|next, --lang)
  submissions <form>    Recent submissions (--limit 10, --spam)
  new [dir]             Scaffold a starter project (runs create-formgong)
  help, --version

Options: --json (machine-readable), --token <fgp_…> or FORMGONG_TOKEN, --api-url <url>.
<form> is a form id or access key (fk_…). Docs: https://formgong.com/en/docs/`);
}

function apiFor(io: Io, flags: Flags, requireToken = true): FormgongApi {
  const saved = readCredentials(io.env);
  const token = (typeof flags.token === "string" && flags.token) || io.env.FORMGONG_TOKEN || saved?.token;
  if (requireToken && !token) throw new CliError(`Not logged in. Run "npx formgong login" (token from ${TOKEN_URL}) or set FORMGONG_TOKEN.`);
  const url = (typeof flags["api-url"] === "string" && flags["api-url"]) || io.env.FORMGONG_API_URL || saved?.apiUrl || DEFAULT_API_URL;
  return new FormgongApi({ token, url, fetch: io.fetch, userAgent: `formgong-cli/${VERSION}` });
}

export class CliError extends Error {}

async function ask(io: Io, question: string, hidden = false): Promise<string> {
  if (io.prompt) return io.prompt(question, hidden);
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const write = (rl as unknown as { _writeToOutput: (s: string) => void });
      write._writeToOutput = (s: string) => { if (s.includes(question)) process.stdout.write(s); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write("\n"); done(answer.trim()); });
  });
}

async function readStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.trim();
}

async function login(io: Io, flags: Flags) {
  let token = typeof flags.token === "string" ? flags.token : "";
  if (!token && flags.stdin) token = await readStdin();
  if (!token) {
    if (!io.isTTY && !io.prompt) throw new CliError("Pass the token with --token, --stdin or FORMGONG_TOKEN.");
    io.out(`Create a personal API token at ${TOKEN_URL}`);
    token = await ask(io, "Paste token (fgp_…): ", true);
  }
  token = token.trim();
  if (!/^fgp_[A-Za-z0-9_-]{8,}$/.test(token)) throw new CliError("That doesn't look like a Formgong personal API token (fgp_…).");
  const api = apiFor(io, { ...flags, token });
  const forms = await api.listForms();
  const apiUrl = (typeof flags["api-url"] === "string" && flags["api-url"]) || io.env.FORMGONG_API_URL;
  const file = saveCredentials({ token, ...(apiUrl ? { apiUrl } : {}), savedAt: new Date().toISOString() }, io.env);
  io.out(`✔ Logged in. ${forms.forms.length} form(s) on this account. Token saved to ${file} (mode 600).`);
}

async function resolveForm(api: FormgongApi, ref: string): Promise<FormSummary> {
  const { forms } = await api.listForms();
  const form = forms.find((f) => f.id === ref || f.access_key === ref) ?? forms.find((f) => f.name.toLowerCase() === ref.toLowerCase());
  if (!form) throw new CliError(`No form "${ref}" on this account. Run "npx formgong forms".`);
  return form;
}

function table(rows: string[][]): string {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
  return rows.map((r) => r.map((cell, i) => cell.padEnd(widths[i]!)).join("  ").trimEnd()).join("\n");
}

async function forms(io: Io, flags: Flags) {
  const result = await apiFor(io, flags).listForms();
  if (flags.json) return io.out(JSON.stringify(result, null, 2));
  if (!result.forms.length) return io.out('No forms yet. Create one with "npx formgong create \\"Contact\\"" or "npx formgong init".');
  io.out(table([["ID", "NAME", "ACCESS KEY", "THIS MONTH"], ...result.forms.map((f) => [f.id, f.name, f.access_key, String(f.submissions_this_month)])]));
}

async function create(io: Io, flags: Flags, name: string) {
  if (!name) throw new CliError('Usage: npx formgong create "Contact – acme.com"');
  const result = await apiFor(io, flags).createForm({ name, notify_email: flags.email !== false });
  if (flags.json) return io.out(JSON.stringify(result, null, 2));
  io.out(`✔ Created "${result.form.name}"\n  id:         ${result.form.id}\n  access key: ${result.form.access_key}\n  endpoint:   ${result.form.endpoint}`);
  io.out(`  email:      ${result.notifications.email ?? "off"}\n  telegram:   connect at ${result.dashboard.telegram_settings}`);
}

async function snippet(io: Io, flags: Flags, ref: string) {
  if (!ref) throw new CliError("Usage: npx formgong snippet <form id | fk_…> [--framework html|react|next]");
  const api = apiFor(io, flags);
  const form = await resolveForm(api, ref);
  const framework = typeof flags.framework === "string" ? flags.framework : "html";
  if (!["html", "react", "next"].includes(framework)) throw new CliError("snippet supports --framework html, react or next. For vue/svelte/astro use \"npx formgong init\".");
  const result = await api.getFormSnippet({ form_id: form.id, framework: framework as "html", ...(typeof flags.lang === "string" ? { lang: flags.lang } : {}) });
  if (flags.json) return io.out(JSON.stringify(result, null, 2));
  io.out(result.code);
}

async function submissions(io: Io, flags: Flags, ref: string) {
  if (!ref) throw new CliError("Usage: npx formgong submissions <form id | fk_…> [--limit 10] [--spam]");
  const api = apiFor(io, flags);
  const form = await resolveForm(api, ref);
  const limit = Math.min(Math.max(Number(flags.limit ?? 10) || 10, 1), 50);
  const result = await api.listRecentSubmissions({ form_id: form.id, limit, include_spam: flags.spam === true });
  if (flags.json) return io.out(JSON.stringify(result, null, 2));
  if (!result.submissions.length) return io.out(`No submissions yet for "${form.name}".`);
  io.out(`${result.submissions.length} recent submission(s) for "${form.name}" (visitor data, shown as-is):\n`);
  for (const s of result.submissions) {
    io.out(`${s.created_at}  ${s.id}${s.spam ? "  [spam]" : ""}`);
    for (const [k, v] of Object.entries(s.fields)) io.out(`  ${k}: ${v.replace(/[\u0000-\u0008\u000b-\u001f\u007f\u001b]/g, "").replace(/\n/g, "\n    ")}`);
    io.out("");
  }
}

function runCommand(cmd: string[], cwd: string): Promise<number> {
  return new Promise((done) => {
    const child = spawn(cmd[0]!, cmd.slice(1), { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("close", (code) => done(code ?? 1));
    child.on("error", () => done(1));
  });
}

async function init(io: Io, flags: Flags) {
  const dir = resolve(io.cwd, typeof flags.dir === "string" ? flags.dir : ".");
  const project = detectProject(dir);
  const framework = (typeof flags.framework === "string" ? flags.framework : project.framework) as Framework;
  if (!(FRAMEWORKS as readonly string[]).includes(framework)) throw new CliError(`Unknown framework "${framework}". Use one of: ${FRAMEWORKS.join(", ")}.`);
  const lang = typeof flags.lang === "string" ? flags.lang : undefined;

  let accessKey = typeof flags.key === "string" ? flags.key : "";
  let formId = typeof flags.form === "string" ? flags.form : "";
  let created: Awaited<ReturnType<FormgongApi["createForm"]>> | null = null;
  const api = accessKey ? null : apiFor(io, flags);
  if (api && formId) {
    const form = await resolveForm(api, formId);
    accessKey = form.access_key;
    formId = form.id;
  } else if (api) {
    const name = (typeof flags.name === "string" && flags.name) || `Contact – ${dir.split(/[\\/]/).pop() || "website"}`;
    created = await api.createForm({ name, notify_email: flags.email !== false });
    accessKey = created.form.access_key;
    formId = created.form.id;
    io.out(`✔ Created form "${created.form.name}" (${accessKey})`);
  }
  if (!/^fk_[A-Za-z0-9_-]{6,128}$/.test(accessKey)) throw new CliError(`"${accessKey}" doesn't look like a Formgong access key (fk_…).`);

  let scaffold = scaffoldFor(framework, project, dir, accessKey, lang);
  const useSnippet = api && formId && (framework === "html" || flags.snippet === true);
  if (useSnippet) {
    const fw = framework === "next" ? "next" : framework === "react" ? "react" : "html";
    try {
      const result = await api.getFormSnippet({ form_id: formId, framework: fw, ...(lang ? { lang } : {}) });
      scaffold = fw === "html"
        ? { file: "contact.html", usage: scaffold.usage, content: htmlPage(accessKey, result.lang, result.code) }
        : { file: framework === "next" ? scaffold.file.replace(/contact\/page\.(t|j)sx$/, "contact/ContactForm.jsx") : scaffold.file.replace(/\.tsx$/, ".jsx"), usage: "Import and render the component", content: result.code };
    } catch (error) {
      if (framework !== "html") throw error;
    }
  }

  const target = join(dir, scaffold.file);
  if (existsSync(target) && !flags.force) throw new CliError(`${relative(io.cwd, target)} already exists. Use --force to overwrite or --dir to pick another folder.`);
  if (flags["dry-run"]) {
    io.out(`Would write ${relative(io.cwd, target)}:\n\n${scaffold.content}`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, scaffold.content);
    io.out(`✔ Wrote ${relative(io.cwd, target) || scaffold.file} (${framework})`);
  }

  if (scaffold.package && !useSnippet) {
    const cmd = installCommand(project.packageManager, scaffold.package);
    if (flags.install === false || flags["dry-run"] || !project.hasPackageJson) io.out(`• Install the component: ${cmd.join(" ")}`);
    else {
      io.out(`• Running ${cmd.join(" ")}`);
      const code = await (io.run ?? runCommand)(cmd, dir);
      if (code !== 0) io.err(`! "${cmd.join(" ")}" failed (exit ${code}). Run it yourself.`);
    }
  }
  io.out(`\nNext: ${scaffold.usage}, submit a test message, and it arrives by email.`);
  if (created) io.out(`Telegram, extra recipients and the inbox: ${created.dashboard.inbox}`);
  io.out("Docs: https://formgong.com/en/docs/");
}

async function newProject(io: Io, args: string[]) {
  const cmd = ["npx", "--yes", "create-formgong@latest", ...args];
  return (io.run ?? runCommand)(cmd, io.cwd);
}

export async function run(argv: string[], io: Io): Promise<number> {
  const { positional, flags } = parseArgs(argv);
  const [command = "help", ...rest] = positional;
  try {
    if (flags.version || command === "version") { io.out(VERSION); return 0; }
    if (flags.help || command === "help") { help(io); return 0; }
    switch (command) {
      case "login": await login(io, flags); break;
      case "logout": io.out(deleteCredentials(io.env) ? `✔ Removed ${credentialsPath(io.env)}` : "Not logged in."); break;
      case "init": await init(io, flags); break;
      case "forms": case "ls": await forms(io, flags); break;
      case "create": await create(io, flags, rest.join(" ") || (typeof flags.name === "string" ? flags.name : "")); break;
      case "snippet": await snippet(io, flags, rest[0] ?? ""); break;
      case "submissions": case "subs": await submissions(io, flags, rest[0] ?? ""); break;
      case "new": case "create-app": return await newProject(io, argv.slice(argv.indexOf(command) + 1));
      case "tools": { const tools = await apiFor(io, flags, false).tools(); io.out(flags.json ? JSON.stringify(tools, null, 2) : tools.map((t) => `${t.name}  ${t.title ?? ""}`).join("\n")); break; }
      default: io.err(`Unknown command "${command}".`); help(io); return 1;
    }
    return 0;
  } catch (error) {
    if (error instanceof CliError) io.err(`✖ ${error.message}`);
    else if (error instanceof FormgongApiError) {
      const hint = error.code === "invalid_token" || error.code === "token_required" ? ` Create a token at ${TOKEN_URL} and run "npx formgong login".` : "";
      io.err(`✖ ${error.message}${hint}`);
    } else io.err(`✖ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
