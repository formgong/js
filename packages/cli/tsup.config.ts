import { defineConfig } from "tsup";

export default defineConfig([
  { entry: { bin: "src/bin.ts" }, format: ["esm"], clean: true, target: "node18", platform: "node", noExternal: ["@formgong/core"], banner: { js: "#!/usr/bin/env node" } },
  { entry: { index: "src/cli.ts" }, format: ["esm"], dts: true, target: "node18", platform: "node", noExternal: ["@formgong/core"] },
]);
