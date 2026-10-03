// Clean dist/package.json for publishing: real @formgong/core range, no dev-only fields.
import { readFileSync, writeFileSync } from "node:fs";
const dist = new URL("../dist/package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(dist, "utf8"));
const core = JSON.parse(readFileSync(new URL("../../core/package.json", import.meta.url), "utf8"));
for (const field of ["dependencies", "peerDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (String(range).startsWith("workspace:")) pkg[field][name] = name === core.name ? `^${core.version}` : String(range).replace("workspace:", "");
  }
}
delete pkg.devDependencies;
delete pkg.scripts;
if (pkg.publishConfig) delete pkg.publishConfig.directory;
writeFileSync(dist, JSON.stringify(pkg, null, 2) + "\n");
console.log(`dist/package.json: ${pkg.name}@${pkg.version}, @formgong/core ${pkg.dependencies["@formgong/core"]}`);
