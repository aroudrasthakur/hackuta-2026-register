import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { EMAIL_DELIVERY_RETENTION_MS } from "../../convex/maintenance";
import { OTP_SEND_BUCKET } from "../../convex/lib/rateLimitBuckets";
import { DRAFT_SAVE_BUCKET } from "../../convex/lib/userRateLimits";
import { RATE_LIMIT_RETENTION_MS } from "../../convex/rateLimits";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const deleteAccountByEmail = makeFunctionReference<"mutation">(
  "maintenance:deleteAccountByEmail",
);
const pruneOldEmailDeliveries = makeFunctionReference<"mutation">(
  "maintenance:pruneOldEmailDeliveries",
);
const pruneExpiredRateLimits = makeFunctionReference<"mutation">(
  "rateLimits:pruneExpiredRateLimits",
);

describe("maintenance", () => {
  it("chains email delivery pruning until stale rows are gone", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 120; index += 1) {
        await ctx.db.insert("emailDeliveries", {
          serviceId: `svc-${index}`,
          kind: "otp",
          recipient: `old-${index}@example.com`,
          createdAt: now - EMAIL_DELIVERY_RETENTION_MS - 1,
        });
      }

      let remaining = 120;
      while (remaining > 0) {
        const result = await ctx.runMutation(pruneOldEmailDeliveries, {});
        remaining = (await ctx.db.query("emailDeliveries").collect()).length;
        if (remaining === 0) break;
        expect(result.rescheduled).toBe(true);
      }

      expect(await ctx.db.query("emailDeliveries").collect()).toHaveLength(0);
    });
  });

  it("prunes stale rows from every rate-limit bucket", async () => {
    const test = convexTest(schema, modules);
    await test.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("rateLimits", {
        bucket: DRAFT_SAVE_BUCKET,
        key: "user-a",
        createdAt: now - RATE_LIMIT_RETENTION_MS - 1,
      });
      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: "user-b",
        createdAt: now - RATE_LIMIT_RETENTION_MS - 1,
      });

      await ctx.runMutation(pruneExpiredRateLimits, {});

      expect(await ctx.db.query("rateLimits").collect()).toHaveLength(0);
    });
  });

  it("deleteAccountByEmail removes all auth and audit rows for one user only", async () => {
    const test = convexTest(schema, modules);
    const { userAId, userBId } = await test.run(async (ctx) => {
      const userAId = await ctx.db.insert("users", {
        email: "audit-a@example.com",
        emailVerificationTime: Date.now(),
      });
      const userBId = await ctx.db.insert("users", {
        email: "audit-b@example.com",
        emailVerificationTime: Date.now(),
      });

      const accountA = await ctx.db.insert("authAccounts", {
        userId: userAId,
        provider: "password",
        providerAccountId: "audit-a@example.com",
      });
      const accountB = await ctx.db.insert("authAccounts", {
        userId: userBId,
        provider: "password",
        providerAccountId: "audit-b@example.com",
      });

      const sessionA = await ctx.db.insert("authSessions", {
        userId: userAId,
        expirationTime: Date.now() + 3_600_000,
      });
      const sessionB = await ctx.db.insert("authSessions", {
        userId: userBId,
        expirationTime: Date.now() + 3_600_000,
      });

      await ctx.db.insert("authRefreshTokens", {
        sessionId: sessionA,
        expirationTime: Date.now() + 3_600_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId: sessionB,
        expirationTime: Date.now() + 3_600_000,
      });
      await ctx.db.insert("authVerificationCodes", {
        accountId: accountA,
        provider: "password-reset",
        code: "123456",
        expirationTime: Date.now() + 600_000,
      });
      await ctx.db.insert("authVerifiers", {
        sessionId: sessionA,
        signature: "sig-a",
      });
      await ctx.db.insert("authRateLimits", {
        identifier: accountA,
        lastAttemptTime: Date.now(),
        attemptsLeft: 5,
      });
      await ctx.db.insert("rateLimits", {
        bucket: OTP_SEND_BUCKET,
        key: "audit-a@example.com",
        createdAt: Date.now(),
      });
      await ctx.db.insert("emailDeliveries", {
        serviceId: "delivery-a",
        kind: "otp",
        recipient: "audit-a@example.com",
        createdAt: Date.now(),
      });
      await ctx.db.insert("emailDeliveryRecordingFailures", {
        serviceId: "failure-a",
        kind: "otp",
        recipient: "audit-a@example.com",
        errorMessage: "test",
        createdAt: Date.now(),
      });

      return { userAId, userBId, accountB, sessionB };
    });

    await test.mutation(deleteAccountByEmail, { email: "audit-a@example.com" });

    await test.run(async (ctx) => {
      expect(await ctx.db.get(userAId as GenericId<"users">)).toBeNull();
      expect(await ctx.db.get(userBId as GenericId<"users">)).not.toBeNull();
      expect(await ctx.db.query("authAccounts").collect()).toHaveLength(1);
      expect(await ctx.db.query("authSessions").collect()).toHaveLength(1);
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(1);
      expect(await ctx.db.query("authVerificationCodes").collect()).toHaveLength(0);
      expect(await ctx.db.query("authVerifiers").collect()).toHaveLength(0);
      expect(await ctx.db.query("authRateLimits").collect()).toHaveLength(0);
      expect(await ctx.db.query("rateLimits").collect()).toHaveLength(0);
      expect(await ctx.db.query("emailDeliveries").collect()).toHaveLength(0);
      expect(await ctx.db.query("emailDeliveryRecordingFailures").collect()).toHaveLength(0);
    });
  });
});
