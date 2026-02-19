#!/usr/bin/env node

import("../dist/cli/webmcp-verify.js").catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to start webmcp-verify.";
  console.error(message);
  process.exit(1);
});
