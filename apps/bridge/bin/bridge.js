#!/usr/bin/env node

import("../dist/cli/cli.js").catch((error) => {
  const message = error instanceof Error ? error.message : "Failed to start bridge CLI.";
  console.error(message);
  process.exit(1);
});
