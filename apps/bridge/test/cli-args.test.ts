import { describe, expect, it } from "vitest";

import { parseBridgeCliArgs } from "../src/cli-args";

describe("parseBridgeCliArgs", () => {
  it("parses required --url", () => {
    const result = parseBridgeCliArgs(["--url", "http://localhost:3100"]);

    expect(result.siteUrl).toBe("http://localhost:3100/");
    expect(result.interactive).toBe(false);
    expect(result.writeToolPolicy.mode).toBe("none");
  });

  it("enables interactive mode", () => {
    const result = parseBridgeCliArgs(["--url", "https://example.com", "--interactive"]);

    expect(result.interactive).toBe(true);
  });

  it("supports write tool allowlist", () => {
    const result = parseBridgeCliArgs([
      "--url",
      "http://localhost:3100",
      "--allow-write",
      "addToCart,placeOrder"
    ]);

    expect(result.writeToolPolicy.mode).toBe("allowlist");
    expect(result.writeToolPolicy.allowlist).toEqual(["addToCart", "placeOrder"]);
  });

  it("supports allow all writes", () => {
    const result = parseBridgeCliArgs(["--url", "http://localhost:3100", "--allow-write"]);

    expect(result.writeToolPolicy.mode).toBe("all");
  });

  it("throws when --url is missing", () => {
    expect(() => parseBridgeCliArgs([])).toThrow(/--url/);
  });
});
