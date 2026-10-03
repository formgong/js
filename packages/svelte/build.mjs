// Copies the .svelte components and the svelte entry next to the tsup output.
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
for (const file of ["FormgongForm.svelte", "ContactForm.svelte", "svelte.js", "svelte.d.ts"]) copyFileSync(`src/${file}`, `dist/${file}`);
const dts = readFileSync("dist/svelte.d.ts", "utf8");
writeFileSync("dist/svelte.d.ts", dts);
