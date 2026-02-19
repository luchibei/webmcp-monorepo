import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  platform: "node",
  format: ["esm"],
  target: "es2022",
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: "dist/cli"
});
