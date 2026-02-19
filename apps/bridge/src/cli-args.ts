export type WriteToolPolicy =
  | {
      mode: "none";
      allowlist: string[];
    }
  | {
      mode: "all";
      allowlist: string[];
    }
  | {
      mode: "allowlist";
      allowlist: string[];
    };

export interface BridgeCliOptions {
  siteUrl: string;
  interactive: boolean;
  writeToolPolicy: WriteToolPolicy;
}

export const bridgeCliUsage = [
  "Usage:",
  "  bridge --url <siteUrl> [--interactive] [--allow-write [toolA,toolB|*]]",
  "",
  "Flags:",
  "  --url <siteUrl>             WebMCP website URL to open in Chromium.",
  "  --interactive               Allow browser confirm() for requestUserInteraction.",
  "  --allow-write               Allow all write tools (dangerous).",
  "  --allow-write <a,b,c>       Allowlist write tools by name.",
  "  --allow-write *             Same as allowing all write tools.",
  "  --help                      Show this help text."
].join("\n");

function normalizeUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("--url must use http or https.");
  }

  return parsed.toString();
}

function parseAllowWriteList(rawList: string): string[] {
  return rawList
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parses CLI arguments for the bridge command.
 */
export function parseBridgeCliArgs(argv: string[]): BridgeCliOptions {
  let rawUrl: string | null = null;
  let interactive = false;
  let policyMode: WriteToolPolicy["mode"] = "none";
  const writeAllowlist = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      throw new Error(bridgeCliUsage);
    }

    if (token === "--url") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --url.");
      }

      rawUrl = value;
      index += 1;
      continue;
    }

    if (token === "--interactive") {
      interactive = true;
      continue;
    }

    if (token === "--allow-write") {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        policyMode = "all";
        continue;
      }

      index += 1;

      if (nextValue === "*" || nextValue.toLowerCase() === "all") {
        policyMode = "all";
        continue;
      }

      const entries = parseAllowWriteList(nextValue);
      if (entries.length === 0) {
        throw new Error("--allow-write list cannot be empty.");
      }

      if (policyMode !== "all") {
        policyMode = "allowlist";
      }

      for (const entry of entries) {
        writeAllowlist.add(entry);
      }

      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!rawUrl) {
    throw new Error("Missing required --url option.");
  }

  const siteUrl = normalizeUrl(rawUrl);
  const allowlist = [...writeAllowlist];

  if (policyMode === "allowlist") {
    return {
      siteUrl,
      interactive,
      writeToolPolicy: {
        mode: "allowlist",
        allowlist
      }
    };
  }

  if (policyMode === "all") {
    return {
      siteUrl,
      interactive,
      writeToolPolicy: {
        mode: "all",
        allowlist
      }
    };
  }

  return {
    siteUrl,
    interactive,
    writeToolPolicy: {
      mode: "none",
      allowlist
    }
  };
}
