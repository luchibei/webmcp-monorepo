import { createTsupConfig } from "../../tsup.config.base";

export default createTsupConfig({
  entry: ["src/index.ts", "src/next.tsx", "src/provider.tsx", "src/hooks.ts"],
  bundle: false
});
