import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/server.ts", "src/client.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  external: ["next", "next/headers", "react", "react-dom", "@formgong/react", "@formgong/core"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
