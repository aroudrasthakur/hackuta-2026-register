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
      // convex-test scheduled confirmation emails read process.env in Node actions.
      SMTP_HOST: "mail.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "no-reply@example.com",
      SMTP_PASSWORD: "secret",
      EMAIL_FROM: "no-reply@example.com",
    },
    coverage: {
      provider: "istanbul",
      // Instrument every file in include, even when no test imports it (0%).
      all: true,
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
