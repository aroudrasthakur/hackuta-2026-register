import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../security/csp";
import {
  crossOriginResourcePolicy,
  htmlCacheControl,
  permissionsPolicy,
  referrerPolicy,
  xContentTypeOptions,
} from "../../security/headers";
import vercelConfig from "../../vercel.json" with { type: "json" };

function deployedHeader(key: string) {
  const catchAll = vercelConfig.headers.find((rule) => rule.source === "/(.*)");
  return catchAll?.headers.find((header) => header.key === key)?.value;
}

describe("contentSecurityPolicy", () => {
  it("allows Convex endpoints required by registration", () => {
    expect(contentSecurityPolicy).toContain("https://*.convex.cloud");
    expect(contentSecurityPolicy).toContain("https://*.convex.site");
    expect(contentSecurityPolicy).toContain("require-trusted-types-for 'script'");
  });
});

describe("response security headers", () => {
  it("keeps vercel.json aligned with the shared header definitions", () => {
    expect(deployedHeader("Content-Security-Policy")).toBe(contentSecurityPolicy);
    expect(deployedHeader("Permissions-Policy")).toBe(permissionsPolicy);
    expect(deployedHeader("Referrer-Policy")).toBe(referrerPolicy);
    expect(deployedHeader("X-Content-Type-Options")).toBe(xContentTypeOptions);
    expect(deployedHeader("Cross-Origin-Resource-Policy")).toBe(crossOriginResourcePolicy);
    expect(deployedHeader("Cache-Control")).toBe(htmlCacheControl);
    expect(deployedHeader("Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
