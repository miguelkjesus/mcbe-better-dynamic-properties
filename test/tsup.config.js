import { defineConfig } from "tsup";

export default defineConfig({
  tsconfig: "../../test/tsconfig.json",
  entry: ["../../test/packs/BP/scripts/main.ts"],
  outDir: "./BP/scripts",
  external: ["@minecraft/server"],
  format: "esm",
  sourcemap: true,
  clean: true,

  outExtension() {
    return {
      js: ".js",
    };
  },
});
