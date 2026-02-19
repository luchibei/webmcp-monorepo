#!/usr/bin/env node

import { verifyWebMcpSite } from "../lib/verify";

async function main() {
  const [url] = process.argv.slice(2);

  if (!url) {
    console.error("Usage: webmcp-verify <url>");
    process.exit(1);
  }

  try {
    const report = await verifyWebMcpSite(url);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (report.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    console.error(JSON.stringify({ errors: [message] }, null, 2));
    process.exit(1);
  }
}

void main();
