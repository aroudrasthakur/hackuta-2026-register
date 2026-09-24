import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../../convex/schema";

const EMAIL_SERVICE_ENV_KEYS = ["EMAIL_SERVICE_URL", "EMAIL_SERVICE_API_KEY"] as const;

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const sendOtpEmail = makeFunctionReference<"action">("email/sendOtpEmail:sendOtpEmail");
const sendPasswordResetEmail = makeFunctionReference<"action">(
  "email/sendPasswordResetEmail:sendPasswordResetEmail",
);

const createTest = () => convexTest(schema, modules);

const expiresAt = () => Date.now() + 10 * 60 * 1000;

describe("email actions without configuration", () => {
  beforeEach(() => {
    for (const key of EMAIL_SERVICE_ENV_KEYS) {
      vi.stubEnv(key, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires email service configuration for OTP email delivery", async () => {
    const test = createTest();
    await expect(
      test.action(sendOtpEmail, {
        email: "test@example.com",
        code: "123456",
        expiresAt: expiresAt(),
      }),
    ).rejects.toThrow("Email is not configured.");
  });

  it("requires email service configuration for password reset email delivery", async () => {
    const test = createTest();
    await expect(
      test.action(sendPasswordResetEmail, {
        email: "reset@example.com",
        code: "654321",
        expiresAt: expiresAt(),
      }),
    ).rejects.toThrow("Email is not configured.");
  });
});
