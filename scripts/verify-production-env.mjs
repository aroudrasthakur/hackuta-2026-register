const isVercelProduction = process.env.VERCEL_ENV === "production";

if (isVercelProduction && process.env.VITE_USE_MOCK_API === "true") {
  console.error(
    "Production build blocked: VITE_USE_MOCK_API must not be true when VERCEL_ENV=production.",
  );
  process.exit(1);
}
