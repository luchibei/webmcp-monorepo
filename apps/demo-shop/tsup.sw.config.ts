import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["sw/webmcp-shop-sw.ts"],
  format: ["iife"],
  platform: "browser",
  target: "es2022",
  outDir: "public",
  sourcemap: true,
  splitting: false,
  dts: false,
  clean: false,
  outExtension() {
    return {
      js: ".js"
    };
  }
});
