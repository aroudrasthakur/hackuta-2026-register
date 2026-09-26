import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const policySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../public/trusted-types.js"),
  "utf8",
);

describe("trusted-types policy", () => {
  it("blocks dangerous HTML markup but allows framework-safe strings", () => {
    expect(policySource).toContain("HTML injection blocked");
    expect(policySource).toMatch(/return value;/);
    expect(policySource).not.toMatch(/createHTML:\s*\(\s*value\s*\)\s*=>\s*value/);
  });

  it("allows same-origin script URLs only", () => {
    expect(policySource).toContain("isAllowedScriptUrl");
    expect(policySource).not.toContain("vercel.live");
    expect(policySource).toContain("Script URL blocked");
  });
});
