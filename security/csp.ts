/**
 * Production CSP — keep vercel.json Content-Security-Policy in sync.
 * Convex hosts use wildcards so Vercel preview builds can point at any deployment
 * without rebuilding headers; production sets VITE_CONVEX_URL to the prod deployment.
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https://vercel.com data: blob:",
  "font-src 'self' https://assets.vercel.com",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site",
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  "require-trusted-types-for 'script'",
  "trusted-types default",
].join("; ");
