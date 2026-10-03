import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    svelte({ hot: false }),
    // In dist the components import the built ./index.js; in tests point them at the TS source.
    { name: "svelte-src-index", enforce: "pre", resolveId: (id, importer) => (id === "./index.js" && importer?.endsWith(".svelte") ? fileURLToPath(new URL("./src/index.ts", import.meta.url)) : null) },
  ],
  resolve: { conditions: ["browser"] },
  test: { environment: "jsdom" },
});
