const isVercelProduction = process.env.VERCEL_ENV === "production";
const isNodeProduction = process.env.NODE_ENV === "production";
const isModeProduction = process.env.MODE === "production";
const mockEnabled = process.env.VITE_USE_MOCK_API === "true";
const allowMockForCiE2e = process.env.CI === "true" && process.env.GITHUB_ACTIONS === "true";

if (mockEnabled && !allowMockForCiE2e && (isVercelProduction || isNodeProduction || isModeProduction)) {
  console.error(
    "Production build blocked: VITE_USE_MOCK_API must not be true when building for production.",
  );
  process.exit(1);
}
