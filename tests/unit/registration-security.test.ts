import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRegistrationAdminIdentityKeys,
  getRegistrationAllowedOrigins,
  isOriginAllowed,
  isRegistrationAdmin,
} from "../../convex/registrationSecurity";

describe("registrationSecurity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows local registration dev origins only when explicitly enabled", () => {
    vi.stubEnv("REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS", "true");
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "");
    vi.stubEnv("SITE_URL", "");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual([
      "http://127.0.0.1:5273",
      "http://localhost:5273",
    ]);
    expect(isOriginAllowed("http://localhost:5273", allowed)).toBe(true);
    expect(isOriginAllowed("https://hackuta.org", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(false);
  });

  it("excludes local dev origins from production configuration", () => {
    vi.stubEnv("REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS", "");
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "https://register.hackuta.com");
    vi.stubEnv("SITE_URL", "https://register.hackuta.com");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual(["https://register.hackuta.com"]);
    expect(isOriginAllowed("http://localhost:5273", allowed)).toBe(false);
    expect(isOriginAllowed("https://register.hackuta.com", allowed)).toBe(true);
  });

  it("ignores localhost entries on production even when misconfigured", () => {
    vi.stubEnv("REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS", "");
    vi.stubEnv(
      "REGISTRATION_ALLOWED_ORIGINS",
      "https://register.hackuta.com,http://localhost:5273",
    );
    vi.stubEnv("SITE_URL", "http://127.0.0.1:5273");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual(["https://register.hackuta.com"]);
    expect(isOriginAllowed("http://localhost:5273", allowed)).toBe(false);
  });

  it("includes local dev origin variants from SITE_URL when local dev is enabled", () => {
    vi.stubEnv("REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS", "true");
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "");
    vi.stubEnv("SITE_URL", "http://127.0.0.1:5273");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual([
      "http://127.0.0.1:5273",
      "http://localhost:5273",
    ]);
    expect(isOriginAllowed("http://localhost:5273", allowed)).toBe(true);
  });

  it("accepts configured production origins alongside local dev when enabled", () => {
    vi.stubEnv("REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS", "true");
    vi.stubEnv("REGISTRATION_ALLOWED_ORIGINS", "https://hackuta.org, https://www.hackuta.org");
    vi.stubEnv("SITE_URL", "");
    const allowed = getRegistrationAllowedOrigins();
    expect(allowed).toEqual([
      "http://127.0.0.1:5273",
      "http://localhost:5273",
      "https://hackuta.org",
      "https://www.hackuta.org",
    ]);
    expect(isOriginAllowed("https://hackuta.org", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
  });

  it("rejects admin access when the allowlist is empty", () => {
    vi.stubEnv("REGISTRATION_ADMIN_IDENTITY_KEYS", "");
    expect(getRegistrationAdminIdentityKeys()).toEqual([]);
    expect(isRegistrationAdmin("provider-user")).toBe(false);
  });

  it("accepts only configured organizer identity keys", () => {
    vi.stubEnv("REGISTRATION_ADMIN_IDENTITY_KEYS", "provider-user, organizer-two");
    const admins = getRegistrationAdminIdentityKeys();
    expect(admins).toEqual(["provider-user", "organizer-two"]);
    expect(isRegistrationAdmin("provider-user")).toBe(true);
    expect(isRegistrationAdmin("foreign-user")).toBe(false);
  });
});
