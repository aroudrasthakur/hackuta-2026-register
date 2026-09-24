import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { describe, expect, it } from "vitest";
import { invalidateAllSessionsForUser } from "../../convex/lib/invalidateAuthSessions";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const invalidateSessionsAfterPasswordReset = makeFunctionReference<"mutation">(
  "passwordReset:invalidateSessionsAfterPasswordReset",
);

describe("password reset backend", () => {
  it("removes every session and refresh token for the target user", async () => {
    const test = convexTest(schema, modules);

    let userId: GenericId<"users">;
    let otherUserId: GenericId<"users">;

    await test.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        email: "reset-sessions@example.com",
        emailVerificationTime: Date.now(),
      });
      otherUserId = await ctx.db.insert("users", {
        email: "other-sessions@example.com",
        emailVerificationTime: Date.now(),
      });

      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 3_600_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 3_600_000,
      });
      await ctx.db.insert("authSessions", {
        userId: otherUserId,
        expirationTime: Date.now() + 3_600_000,
      });

      await invalidateAllSessionsForUser(ctx, userId);

      const sessions = await ctx.db.query("authSessions").collect();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.userId).toBe(otherUserId);
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
    });
  });

  it("invalidates sessions through the password reset mutation", async () => {
    const test = convexTest(schema, modules);
    const email = "reset-mutation@example.com";

    let userId: GenericId<"users">;

    await test.run(async (ctx) => {
      userId = await ctx.db.insert("users", {
        email,
        emailVerificationTime: Date.now(),
      });
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 3_600_000,
      });
      await ctx.db.insert("authRefreshTokens", {
        sessionId,
        expirationTime: Date.now() + 3_600_000,
      });
    });

    const authed = test.withIdentity({
      subject: userId!,
      email,
      tokenIdentifier: `email|${email}`,
    });

    await authed.mutation(invalidateSessionsAfterPasswordReset, {});

    await test.run(async (ctx) => {
      expect(await ctx.db.query("authSessions").collect()).toHaveLength(0);
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
    });
  });
});
