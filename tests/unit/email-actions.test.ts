import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";

const SMTP_ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"] as const;

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const sendOtpEmail = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");
const sendPasswordResetEmail = makeFunctionReference<"action">(
  "email/sendPasswordResetEmail:sendPasswordResetEmail",
);

describe("email actions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const key of SMTP_ENV_KEYS) {
      delete process.env[key];
    }
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

  it("requires SMTP configuration for password reset email delivery", async () => {
    const test = convexTest(schema, modules);
    await expect(
      test.action(sendPasswordResetEmail, {
        email: "reset@example.com",
        code: "654321",
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
    ).rejects.toThrow("Email is not configured.");
  });
});
