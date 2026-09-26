import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.resolve("scripts/verify-production-env.mjs");

function run(extraEnv: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

describe("verify-production-env", () => {
  it("blocks mock auth in production builds", () => {
    const result = run({
      NODE_ENV: "production",
      VITE_USE_MOCK_API: "true",
    });
    expect(result.status).toBe(1);
    expect(result.stderr ?? result.stdout).toContain("VITE_USE_MOCK_API");
  });

  it("allows production builds without mock auth", () => {
    const result = run({
      NODE_ENV: "production",
      VITE_USE_MOCK_API: "false",
    });
    expect(result.status).toBe(0);
  });
});
