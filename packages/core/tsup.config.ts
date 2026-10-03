import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/api.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  target: "es2020",
  treeshake: true,
});
