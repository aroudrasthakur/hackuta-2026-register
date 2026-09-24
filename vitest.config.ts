import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import {
  COVERAGE_EXCLUDE,
  COVERAGE_INCLUDE,
  VITEST_THRESHOLDS,
} from "./scripts/coverage-policy.mjs";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    env: {
      REGISTRATION_ALLOWED_ORIGINS: "https://hackuta.test",
    },
    coverage: {
      provider: "istanbul",
      // Scope, documented exclusions, and per-area thresholds live in
      // scripts/coverage-policy.mjs so CI and local checks stay in sync.
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
      thresholds: VITEST_THRESHOLDS,
      reportsDirectory: "./coverage/unit",
      reporter: ["text", "text-summary", "json", "json-summary", "lcov", "html"],
    },
  },
});
