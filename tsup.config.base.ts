import { defineConfig, type Options } from "tsup";

const defaultOptions: Options = {
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false
};

/**
 * Shared tsup config factory for all workspace packages/apps.
 */
export function createTsupConfig(overrides: Options = {}) {
  return defineConfig({
    ...defaultOptions,
    ...overrides,
    entry: overrides.entry ?? defaultOptions.entry
  });
}

export default createTsupConfig;
