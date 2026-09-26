import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  path.resolve("scripts/sync-dev-convex-env.mjs"),
  "utf8",
);
const copyMatch = scriptSource.match(
  /export const COPY_FROM_PROD = (\[[^\]]+\])/,
);
const COPY_FROM_PROD: string[] = copyMatch ? JSON.parse(copyMatch[1]!.replace(/'/g, '"')) : [];

describe("sync-dev-convex-env", () => {
  it("does not copy API keys or secrets from production", () => {
    for (const name of COPY_FROM_PROD) {
      expect(name).not.toMatch(/_API_KEY$/);
      expect(name).not.toMatch(/_SECRET$/);
    }
    expect(COPY_FROM_PROD).not.toContain("EMAIL_SERVICE_API_KEY");
  });
});
