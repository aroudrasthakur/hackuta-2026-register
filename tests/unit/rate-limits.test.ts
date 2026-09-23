import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import {
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_MAX_PER_HOUR,
  OTP_STATUS_LOOKUP_MAX_PER_HOUR,
} from "../../convex/rateLimits";
import {
  OTP_SEND_BUCKET,
  OTP_STATUS_LOOKUP_BUCKET,
} from "../../convex/lib/rateLimitBuckets";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const getOtpSendCooldown = makeFunctionReference<"mutation">("rateLimits:getOtpSendCooldown");
const assertOtpSendAllowed = makeFunctionReference<"mutation">("rateLimits:assertOtpSendAllowed");
const recordOtpSend = makeFunctionReference<"mutation">("rateLimits:recordOtpSend");

describe("rateLimits", () => {
  it("reports remaining OTP cooldown seconds", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "cooldown-status@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - 15_000,
      });

      const status = await ctx.runMutation(getOtpSendCooldown, { email });
      expect(status.hourlyLimitReached).toBe(false);
      expect(status.waitSeconds).toBeGreaterThan(0);
      expect(status.waitSeconds).toBeLessThanOrEqual(30);
    });
  });

  it("blocks OTP sends when hourly limit is reached", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "limited@example.com";
      const now = Date.now();

      for (let i = 0; i < OTP_SEND_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: OTP_SEND_BUCKET,
          key: email,
          createdAt: now - (i * 1000),
        });
      }

      await expect(ctx.runMutation(assertOtpSendAllowed, { email })).rejects.toThrow(
        "Too many verification requests. Please try again later.",
      );
    });
  });

  it("blocks OTP sends during cooldown window", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "cooldown@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - 5_000,
      });

      await expect(ctx.runMutation(assertOtpSendAllowed, { email })).rejects.toThrow(
        "Please wait before requesting another code.",
      );
    });
  });

  it("allows OTP send after cooldown expires", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "expired-cooldown@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - OTP_RESEND_COOLDOWN_MS - 1_000,
      });

      await expect(ctx.runMutation(assertOtpSendAllowed, { email })).resolves.not.toThrow();
    });
  });

  it("records OTP send attempts", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "record@example.com";
      const now = Date.now();

      await ctx.runMutation(recordOtpSend, { email });

      const attempts = await ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
        .filter((q) => q.eq(q.field("key"), email))
        .collect();

      expect(attempts).toHaveLength(1);
      expect(attempts[0]!.createdAt).toBeGreaterThan(now - 1000);
    });
  });

  it("normalizes email addresses for OTP rate limiting", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(recordOtpSend, { email: "Test@Example.COM" });
      const attempts = await ctx.db.query("rateLimits").collect();
      expect(attempts[0]?.key).toBe("test@example.com");
    });
  });

  it("returns neutral OTP cooldown status after lookup rate limit is exceeded", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "probe@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: email,
        createdAt: now - 15_000,
      });

      for (let i = 0; i < OTP_STATUS_LOOKUP_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: OTP_STATUS_LOOKUP_BUCKET,
          key: email,
          createdAt: now - (i * 1000),
        });
      }

      const status = await ctx.runMutation(getOtpSendCooldown, { email });
      expect(status).toEqual({ waitSeconds: 0, hourlyLimitReached: false });
    });
  });
});
