import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const sendOtpEmail = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");

describe("email actions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires SMTP configuration for OTP email delivery", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action(sendOtpEmail, {
        email: "test@example.com",
        code: "123456",
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    ).rejects.toThrow("Email is not configured.");
  });

  it("delivers OTP through the dev mail log when EMAIL_DEV_LOG is enabled", async () => {
    vi.stubEnv("EMAIL_DEV_LOG", "true");
    const test = convexTest(schema, modules);
    await expect(
      test.action(sendOtpEmail, {
        email: "test@example.com",
        code: "123456",
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    ).resolves.toBeNull();
  });
});
