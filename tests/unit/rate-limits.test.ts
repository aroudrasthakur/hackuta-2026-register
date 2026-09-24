import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import {
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_MAX_PER_HOUR,
  OTP_SEND_WINDOW_MS,
  OTP_STATUS_LOOKUP_MAX_PER_HOUR,
} from "../../convex/rateLimits";
import {
  OTP_SEND_BUCKET,
  OTP_STATUS_LOOKUP_BUCKET,
  PASSWORD_RESET_SEND_BUCKET,
} from "../../convex/lib/rateLimitBuckets";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const getOtpSendCooldown = makeFunctionReference<"mutation">("rateLimits:getOtpSendCooldown");
const getPasswordResetSendCooldown = makeFunctionReference<"mutation">(
  "rateLimits:getPasswordResetSendCooldown",
);
const assertOtpSendAllowed = makeFunctionReference<"mutation">("rateLimits:assertOtpSendAllowed");
const assertPasswordResetSendAllowed = makeFunctionReference<"mutation">(
  "rateLimits:assertPasswordResetSendAllowed",
);
const recordOtpSend = makeFunctionReference<"mutation">("rateLimits:recordOtpSend");
const recordPasswordResetSend = makeFunctionReference<"mutation">(
  "rateLimits:recordPasswordResetSend",
);
const clearOtpSendLimitsForEmail = makeFunctionReference<"mutation">(
  "rateLimits:clearOtpSendLimitsForEmail",
);

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

  it("tracks password reset sends separately from signup OTP sends", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "reset-only@example.com";
      await ctx.runMutation(recordPasswordResetSend, { email });

      const resetAttempts = await ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", PASSWORD_RESET_SEND_BUCKET))
        .filter((q) => q.eq(q.field("key"), email))
        .collect();
      const signupAttempts = await ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
        .filter((q) => q.eq(q.field("key"), email))
        .collect();

      expect(resetAttempts).toHaveLength(1);
      expect(signupAttempts).toHaveLength(0);
      await expect(ctx.runMutation(assertOtpSendAllowed, { email })).resolves.not.toThrow();
    });
  });

  it("blocks password reset sends during cooldown window", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "reset-cooldown@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: PASSWORD_RESET_SEND_BUCKET,
        key: email,
        createdAt: now - 5_000,
      });

      await expect(ctx.runMutation(assertPasswordResetSendAllowed, { email })).rejects.toThrow(
        "Please wait before requesting another code.",
      );
    });
  });

  it("reports password reset cooldown separately from signup OTP cooldown", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "reset-status@example.com";
      const now = Date.now();

      await ctx.db.insert("rateLimits", {
        bucket: PASSWORD_RESET_SEND_BUCKET,
        key: email,
        createdAt: now - 15_000,
      });

      const status = await ctx.runMutation(getPasswordResetSendCooldown, { email });
      expect(status.hourlyLimitReached).toBe(false);
      expect(status.waitSeconds).toBeGreaterThan(0);
    });
  });

  it("blocks password reset sends once the hourly limit is reached", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "reset-limited@example.com";
      const now = Date.now();
      for (let i = 0; i < OTP_SEND_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: PASSWORD_RESET_SEND_BUCKET,
          key: email,
          createdAt: now - OTP_RESEND_COOLDOWN_MS - i * 60_000,
        });
      }

      await expect(ctx.runMutation(assertPasswordResetSendAllowed, { email })).rejects.toThrow(
        "Too many reset requests. Please try again later.",
      );
      const status = await ctx.runMutation(getPasswordResetSendCooldown, { email });
      expect(status.hourlyLimitReached).toBe(true);
    });
  });

  it("returns neutral password reset status after the lookup limit is exceeded", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "reset-probe@example.com";
      const now = Date.now();
      await ctx.db.insert("rateLimits", {
        bucket: PASSWORD_RESET_SEND_BUCKET,
        key: email,
        createdAt: now - 5_000,
      });
      for (let i = 0; i < OTP_STATUS_LOOKUP_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: OTP_STATUS_LOOKUP_BUCKET,
          key: email,
          createdAt: now - i * 1000,
        });
      }

      await expect(ctx.runMutation(getPasswordResetSendCooldown, { email })).resolves.toEqual({
        waitSeconds: 0,
        hourlyLimitReached: false,
      });
    });
  });

  it("ignores lookup probes older than the lookup window", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "old-probes@example.com";
      const now = Date.now();
      await ctx.db.insert("rateLimits", { bucket: OTP_SEND_BUCKET, key: email, createdAt: now - 5_000 });
      for (let i = 0; i < OTP_STATUS_LOOKUP_MAX_PER_HOUR; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: OTP_STATUS_LOOKUP_BUCKET,
          key: email,
          createdAt: now - 2 * 60 * 60 * 1000,
        });
      }
      const status = await ctx.runMutation(getOtpSendCooldown, { email });
      expect(status.waitSeconds).toBeGreaterThan(0);
    });
  });

  it.each([
    ["getOtpSendCooldown", getOtpSendCooldown],
    ["getPasswordResetSendCooldown", getPasswordResetSendCooldown],
  ])("%s returns a neutral status for blank emails without recording a lookup", async (_name, ref) => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await expect(ctx.runMutation(ref, { email: "   " })).resolves.toEqual({
        waitSeconds: 0,
        hourlyLimitReached: false,
      });
      expect(await ctx.db.query("rateLimits").collect()).toHaveLength(0);
    });
  });

  it.each([
    ["assertOtpSendAllowed", assertOtpSendAllowed],
    ["assertPasswordResetSendAllowed", assertPasswordResetSendAllowed],
  ])("%s rejects blank emails", async (_name, ref) => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await expect(ctx.runMutation(ref, { email: "" })).rejects.toThrow("Invalid email.");
    });
  });

  it.each([
    ["recordOtpSend", recordOtpSend],
    ["recordPasswordResetSend", recordPasswordResetSend],
  ])("%s ignores blank emails", async (_name, ref) => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      await ctx.runMutation(ref, { email: " " });
      expect(await ctx.db.query("rateLimits").collect()).toHaveLength(0);
    });
  });

  it.each([
    ["recordOtpSend", recordOtpSend, OTP_SEND_BUCKET],
    ["recordPasswordResetSend", recordPasswordResetSend, PASSWORD_RESET_SEND_BUCKET],
  ])("%s prunes entries older than the send window", async (_name, ref, bucket) => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const email = "prune@example.com";
      const now = Date.now();
      await ctx.db.insert("rateLimits", { bucket, key: email, createdAt: now - OTP_SEND_WINDOW_MS - 1 });
      await ctx.db.insert("rateLimits", { bucket, key: email, createdAt: now - 60_000 });
      await ctx.db.insert("rateLimits", { bucket, key: "other@example.com", createdAt: now - OTP_SEND_WINDOW_MS - 1 });

      await ctx.runMutation(ref, { email });

      const rows = await ctx.db.query("rateLimits").collect();
      const mine = rows.filter((row) => row.key === email);
      expect(mine).toHaveLength(2);
      expect(mine.every((row) => row.createdAt >= now - OTP_SEND_WINDOW_MS)).toBe(true);
      expect(rows.some((row) => row.key === "other@example.com")).toBe(true);
    });
  });

  it("clears OTP send limits for one email only", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("rateLimits", { bucket: OTP_SEND_BUCKET, key: "clear@example.com", createdAt: now });
      await ctx.db.insert("rateLimits", { bucket: OTP_SEND_BUCKET, key: "clear@example.com", createdAt: now - 1 });
      await ctx.db.insert("rateLimits", { bucket: OTP_SEND_BUCKET, key: "keep@example.com", createdAt: now });
      await ctx.db.insert("rateLimits", {
        bucket: PASSWORD_RESET_SEND_BUCKET,
        key: "clear@example.com",
        createdAt: now,
      });

      await expect(
        ctx.runMutation(clearOtpSendLimitsForEmail, { email: " Clear@Example.com " }),
      ).resolves.toEqual({ deleted: 2 });
      await expect(ctx.runMutation(clearOtpSendLimitsForEmail, { email: "" })).resolves.toEqual({
        deleted: 0,
      });

      const remaining = await ctx.db.query("rateLimits").collect();
      expect(remaining.map((row) => `${row.bucket}:${row.key}`).sort()).toEqual(
        [`${OTP_SEND_BUCKET}:keep@example.com`, `${PASSWORD_RESET_SEND_BUCKET}:clear@example.com`].sort(),
      );
    });
  });
});
