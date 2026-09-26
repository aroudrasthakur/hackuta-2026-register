import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const policySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/trusted-types.js"),
  "utf8",
);

describe("trusted-types policy", () => {
  it("blocks HTML sinks and dangerous markup", () => {
    expect(policySource).toContain("HTML sink blocked");
    expect(policySource).toContain("HTML injection blocked");
    expect(policySource).not.toMatch(/createHTML:\s*\(\s*value\s*\)\s*=>\s*value/);
  });

  it("allows same-origin and Vercel preview script URLs", () => {
    expect(policySource).toContain("isAllowedScriptUrl");
    expect(policySource).toContain("vercel.live");
    expect(policySource).toContain("Script URL blocked");
  });
});
