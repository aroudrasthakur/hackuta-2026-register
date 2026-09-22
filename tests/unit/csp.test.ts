import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "../../security/csp";

describe("CSP header", () => {
  it("builds a valid CSP header string", () => {
    expect(contentSecurityPolicy).toContain("default-src");
    expect(contentSecurityPolicy).toContain("script-src");
    expect(contentSecurityPolicy).toContain("style-src");
    expect(contentSecurityPolicy).toContain("img-src");
  });

  it("includes self in default-src", () => {
    expect(contentSecurityPolicy).toMatch(/default-src[^;]*'self'/);
  });

  it("allows data URIs for images", () => {
    expect(contentSecurityPolicy).toMatch(/img-src[^;]*data:/);
  });

  it("includes connect-src for API calls", () => {
    expect(contentSecurityPolicy).toContain("connect-src");
  });

  it("sets proper font-src", () => {
    expect(contentSecurityPolicy).toContain("font-src");
  });

  it("returns a string", () => {
    expect(typeof contentSecurityPolicy).toBe("string");
    expect(contentSecurityPolicy.length).toBeGreaterThan(0);
  });

  it("separates directives with semicolons", () => {
    const directives = contentSecurityPolicy.split(";").map(d => d.trim()).filter(Boolean);
    expect(directives.length).toBeGreaterThan(0);
  });

  it("includes frame-ancestors directive", () => {
    expect(contentSecurityPolicy).toContain("frame-ancestors");
  });

  it("includes base-uri directive", () => {
    expect(contentSecurityPolicy).toContain("base-uri");
  });

  it("includes object-src none", () => {
    expect(contentSecurityPolicy).toContain("object-src 'none'");
  });

  it("includes upgrade-insecure-requests", () => {
    expect(contentSecurityPolicy).toContain("upgrade-insecure-requests");
  });

  it("includes trusted-types", () => {
    expect(contentSecurityPolicy).toContain("trusted-types");
  });

  it("allows Convex domains in connect-src", () => {
    expect(contentSecurityPolicy).toMatch(/connect-src[^;]*convex\.cloud/);
  });

  it("allows worker-src with blob", () => {
    expect(contentSecurityPolicy).toMatch(/worker-src[^;]*blob:/);
  });
});
