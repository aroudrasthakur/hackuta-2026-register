import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    env: {
      REGISTRATION_ALLOWED_ORIGINS: "https://hackuta.test",
      REGISTRATION_ADMIN_IDENTITY_KEYS: "provider-user",
    },
    coverage: {
      provider: "istanbul",
      include: [
        "src/**/*.{ts,tsx}",
        "shared/**/*.ts",
        "convex/**/*.ts",
        "security/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "src/main.tsx",
        "convex/_generated/**",
        "convex/crons.ts",
        "convex/auth.ts",
        // Thin UI shells and the Convex client wrapper; covered by Playwright e2e.
        "src/components/**",
        "src/constants/**",
        "src/convex/client.ts",
        "src/pages/Register/RegisterPage.tsx",
        "src/pages/SignIn/SignInPage.tsx",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
      reportsDirectory: "./.nyc_output",
      reporter: ["text", "json", "json-summary"],
    },
  },
});
