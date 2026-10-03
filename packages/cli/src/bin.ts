import { run } from "./cli.js";

run(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
  cwd: process.cwd(),
  isTTY: Boolean(process.stdout.isTTY && process.stdin.isTTY),
}).then((code) => { process.exitCode = code; });
