#!/usr/bin/env node
// create-formgong: scaffold a Formgong contact form starter from github.com/formgong.
// Zero dependencies. Usage: npm create formgong@latest [dir] -- [--template nextjs|astro|html|react] [--key fk_...] [--create-form]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, relative, sep } from "node:path";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit, env } from "node:process";

const VERSION = "0.2.0";
const PLACEHOLDER = "fk_your_access_key";
const TEMPLATES = {
  nextjs: { repo: "nextjs-starter", title: "Next.js (App Router)", keyFile: ".env.local", fromExample: ".env.example", next: ["npm install", "npm run dev"] },
  astro: { repo: "astro-starter", title: "Astro (static)", keyFile: ".env", fromExample: ".env.example", next: ["npm install", "npm run dev"] },
  html: { repo: "html-starter", title: "Plain HTML (no build step)", keyFile: "index.html", next: ["open index.html, or upload the folder to any static host"] },
  react: { repo: "react-contact-form", title: "React component for Lovable, Bolt, v0", keyFile: "ContactForm.tsx", next: ["copy ContactForm.tsx into src/components/ of your React app"] },
};
const ALIASES = { next: "nextjs", "next.js": "nextjs", static: "html", lovable: "react", bolt: "react", v0: "react", component: "react" };

const color = (code) => (text) => (stdout.isTTY && !env.NO_COLOR ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = color(1), dim = color(2), green = color(32), red = color(31), cyan = color(36);

function help() {
  console.log(`${bold("create-formgong")} ${VERSION}: contact form starters for Formgong (https://formgong.com)

Usage:
  npm create formgong@latest [dir] -- [options]
  npx create-formgong [dir] [options]

Options:
  -t, --template <name>  ${Object.keys(TEMPLATES).join(" | ")}
  -k, --key <fk_...>     your Formgong access key (optional; you can paste it later)
  -c, --create-form      create a new form on your account and use its key
                         (uses the token saved by "npx formgong login" or FORMGONG_TOKEN)
  -y, --yes              no questions: defaults are dir "formgong-site", template "nextjs"
  -h, --help             show this help
  -v, --version          show the version

Templates are downloaded from https://github.com/formgong (MIT).
Already have a project? "npx formgong init" adds a contact form to it.
Docs: https://formgong.com/en/docs/  ·  MCP server: https://formgong.com/en/docs/mcp/`);
}

function parseArgs(args) {
  const opts = { dir: undefined, template: undefined, key: undefined, yes: false, createForm: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const [name, inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => inline ?? args[++i];
    if (name === "-h" || name === "--help") opts.help = true;
    else if (name === "-v" || name === "--version") opts.version = true;
    else if (name === "-y" || name === "--yes") opts.yes = true;
    else if (name === "-t" || name === "--template") opts.template = value();
    else if (name === "-k" || name === "--key") opts.key = value();
    else if (name === "-c" || name === "--create-form") opts.createForm = true;
    else if (name.startsWith("-")) throw new Error(`Unknown option ${name}. Run with --help.`);
    else if (!opts.dir) opts.dir = name;
    else throw new Error(`Unexpected argument ${name}.`);
  }
  return opts;
}

function normalizeTemplate(name) {
  if (!name) return undefined;
  const key = ALIASES[name.toLowerCase()] ?? name.toLowerCase();
  if (!TEMPLATES[key]) throw new Error(`Unknown template "${name}". Choose one of: ${Object.keys(TEMPLATES).join(", ")}.`);
  return key;
}

function checkKey(key) {
  if (key && !/^fk_[A-Za-z0-9_-]{6,128}$/.test(key)) throw new Error(`"${key}" doesn't look like a Formgong access key (fk_…). Copy it from https://formgong.com/dashboard.`);
  return key || undefined;
}

/** Personal API token shared with the `formgong` CLI (npx formgong login). */
function savedToken() {
  if (env.FORMGONG_TOKEN) return env.FORMGONG_TOKEN.trim();
  const dir = env.FORMGONG_CONFIG_DIR
    || (process.platform === "win32" && env.APPDATA ? join(env.APPDATA, "formgong") : join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "formgong"));
  try {
    return JSON.parse(readFileSync(join(dir, "credentials.json"), "utf8")).token || undefined;
  } catch {
    return undefined;
  }
}

/** Create a form through Formgong's account API (the same JSON-RPC endpoint the MCP server uses). */
async function createForm(token, name) {
  const url = env.FORMGONG_API_URL || "https://formgong.com/mcp";
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}`, "user-agent": `create-formgong/${VERSION}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_form", arguments: { name } } }),
  });
  const json = await response.json().catch(() => null);
  if (json?.error) throw new Error(`${json.error.message} (create a token at https://formgong.com/dashboard/account#api-tokens)`);
  const result = json?.result;
  if (!result || result.isError) throw new Error(result?.content?.[0]?.text || `Could not create a form (HTTP ${response.status}).`);
  return result.structuredContent ?? JSON.parse(result.content[0].text);
}

async function ask(opts) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    if (!opts.dir) opts.dir = (await rl.question(`Project folder ${dim("(formgong-site)")}: `)).trim() || "formgong-site";
    if (!opts.template) {
      const names = Object.keys(TEMPLATES);
      console.log("Template:");
      names.forEach((name, i) => console.log(`  ${cyan(String(i + 1))}) ${TEMPLATES[name].title}`));
      const answer = (await rl.question(`Choose 1-${names.length} ${dim("(1)")}: `)).trim();
      opts.template = names[Number(answer || "1") - 1] ?? normalizeTemplate(answer);
    }
    if (opts.key === undefined && !opts.createForm && savedToken()) {
      const answer = (await rl.question(`Create a new form on your Formgong account? ${dim("(Y/n)")}: `)).trim().toLowerCase();
      opts.createForm = answer === "" || answer === "y" || answer === "yes";
    }
    if (opts.key === undefined && !opts.createForm) {
      opts.key = checkKey((await rl.question(`Access key ${dim("(fk_…, Enter to add later)")}: `)).trim());
    }
  } finally {
    rl.close();
  }
}

/** Minimal tar reader for GitHub tarballs (ustar + pax/GNU long names). */
function* untar(buffer) {
  let offset = 0;
  let longName;
  let paxPath;
  const text = (start, length) => buffer.toString("utf8", start, start + length).replace(/\0.*$/s, "");
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = parseInt(text(offset + 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = text(offset + 345, 155);
    let name = text(offset, 100);
    if (prefix) name = `${prefix}/${name}`;
    const mode = parseInt(text(offset + 100, 8).trim() || "644", 8);
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "L") { longName = body.toString("utf8").replace(/\0.*$/s, ""); continue; }
    if (type === "x") { const match = body.toString("utf8").match(/\d+ path=([^\n]*)\n/); paxPath = match?.[1]; continue; }
    if (type === "g") continue;
    const path = paxPath ?? longName ?? name;
    paxPath = longName = undefined;
    if (type === "0" || type === "\0" || type === "5") yield { path, type: type === "5" ? "dir" : "file", mode, body };
  }
}

async function download(repo) {
  const url = `https://codeload.github.com/formgong/${repo}/tar.gz/refs/heads/main`;
  const response = await fetch(url, { headers: { "user-agent": `create-formgong/${VERSION}` } });
  if (!response.ok) throw new Error(`Could not download ${url} (HTTP ${response.status}).`);
  return gunzipSync(Buffer.from(await response.arrayBuffer()));
}

function extract(tar, target) {
  let count = 0;
  for (const entry of untar(tar)) {
    const rel = entry.path.split("/").slice(1).join("/");
    if (!rel) continue;
    const out = resolve(target, rel);
    if (out !== target && !out.startsWith(target + sep)) throw new Error(`Unsafe path in archive: ${entry.path}`);
    if (entry.type === "dir") { mkdirSync(out, { recursive: true }); continue; }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, entry.body);
    if (entry.mode & 0o111) chmodSync(out, 0o755);
    count++;
  }
  return count;
}

function applyKey(template, target, key) {
  const spec = TEMPLATES[template];
  const file = join(target, spec.keyFile);
  const source = spec.fromExample ? join(target, spec.fromExample) : file;
  if (!existsSync(source)) return false;
  const content = readFileSync(source, "utf8");
  if (!content.includes(PLACEHOLDER)) return false;
  writeFileSync(file, key ? content.replaceAll(PLACEHOLDER, key) : content);
  return true;
}

async function main() {
  const opts = parseArgs(argv.slice(2));
  if (opts.help) return help();
  if (opts.version) return console.log(VERSION);
  opts.template = normalizeTemplate(opts.template);
  opts.key = checkKey(opts.key);
  if (opts.yes) { opts.dir ??= "formgong-site"; opts.template ??= "nextjs"; }
  if ((!opts.dir || !opts.template || opts.key === undefined) && stdin.isTTY && !opts.yes) await ask(opts);
  opts.dir ??= "formgong-site";
  opts.template ??= "nextjs";
  let created;
  if (opts.createForm && !opts.key) {
    const token = savedToken();
    if (!token) throw new Error('No Formgong token found. Run "npx formgong login" first or set FORMGONG_TOKEN.');
    created = await createForm(token, `Contact – ${basename(resolve(opts.dir))}`);
    opts.key = created.form.access_key;
    console.log(green(`✔ created form "${created.form.name}" (${opts.key})`));
  }

  const target = resolve(opts.dir);
  if (existsSync(target) && readdirSync(target).length) throw new Error(`Folder ${opts.dir} already exists and is not empty.`);
  const spec = TEMPLATES[opts.template];
  console.log(`\nCreating ${bold(spec.title)} starter in ${bold(relative(process.cwd(), target) || ".")} ${dim(`(github.com/formgong/${spec.repo})`)}`);
  const files = extract(await download(spec.repo), target);
  const keyed = applyKey(opts.template, target, opts.key);
  console.log(green(`✔ ${files} files written`));
  if (opts.key && keyed) console.log(green(`✔ access key saved to ${spec.keyFile}`));
  else if (keyed) console.log(`• created ${spec.keyFile}: replace ${PLACEHOLDER} with your access key`);

  console.log(`\nNext steps:`);
  if (relative(process.cwd(), target)) console.log(`  cd ${relative(process.cwd(), target)}`);
  if (!opts.key) console.log(`  get a free access key at https://formgong.com and paste it into ${spec.keyFile}`);
  for (const step of spec.next) console.log(`  ${step}`);
  if (created) console.log(`  connect Telegram or more recipients: ${created.dashboard.telegram_settings}`);
  console.log(`\nDocs: https://formgong.com/en/docs/  ·  CLI: npx formgong  ·  MCP: https://formgong.com/en/docs/mcp/`);
}

main().catch((error) => {
  console.error(red(`✖ ${error.message}`));
  exit(1);
});
