import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["cli/webmcp-verify.ts"],
  platform: "node",
  format: ["esm"],
  target: "es2022",
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: "dist/cli"
});
