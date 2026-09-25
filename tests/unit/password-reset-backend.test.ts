import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { GenericId } from "convex/values";
import { exportPKCS8, generateKeyPair } from "jose";
import { Scrypt } from "lucia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_REUSE_MESSAGE } from "../../shared/auth/passwordResetMessages";
import { invalidateAllSessionsForUser } from "../../convex/lib/invalidateAuthSessions";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts", { eager: false });

const signIn = makeFunctionReference<"action">("auth:signIn");
const invalidateSessionsAfterPasswordReset = makeFunctionReference<"mutation">(
  "passwordReset:invalidateSessionsAfterPasswordReset",
);
const invalidateResetSession = makeFunctionReference<"mutation">(
  "passwordReset:invalidateResetSession",
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

  it("removes only the failed reset session and its refresh token", async () => {
    const test = convexTest(schema, modules);
    const { userId, resetSessionId, otherSessionId, otherUserId, otherUserSessionId } =
      await test.run(async (ctx) => {
        const userId = await ctx.db.insert("users", { email: "reset@example.com" });
        const otherUserId = await ctx.db.insert("users", { email: "other@example.com" });
        const expirationTime = Date.now() + 3_600_000;
        const resetSessionId = await ctx.db.insert("authSessions", { userId, expirationTime });
        const otherSessionId = await ctx.db.insert("authSessions", { userId, expirationTime });
        const otherUserSessionId = await ctx.db.insert("authSessions", {
          userId: otherUserId, expirationTime,
        });
        for (const sessionId of [resetSessionId, otherSessionId, otherUserSessionId]) {
          await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime });
        }
        return { userId, resetSessionId, otherSessionId, otherUserId, otherUserSessionId };
      });

    await test.mutation(invalidateResetSession, { userId, sessionId: otherUserSessionId });
    await test.run(async (ctx) => {
      expect(await ctx.db.get(otherUserSessionId)).not.toBeNull();
      expect(await ctx.db.get(resetSessionId)).not.toBeNull();
    });

    await test.mutation(invalidateResetSession, { userId, sessionId: resetSessionId });
    await test.mutation(invalidateResetSession, { userId, sessionId: resetSessionId });
    await test.run(async (ctx) => {
      expect(await ctx.db.get(resetSessionId)).toBeNull();
      expect(await ctx.db.get(otherSessionId)).not.toBeNull();
      expect(await ctx.db.get(otherUserSessionId)).not.toBeNull();
      expect((await ctx.db.query("authRefreshTokens").collect()).map((token) => token.sessionId))
        .toEqual(expect.arrayContaining([otherSessionId, otherUserSessionId]));
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(2);
      expect(await ctx.db.get(otherUserId)).not.toBeNull();
    });
  });
});

describe("password reset with the real auth provider", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function setupReset() {
    vi.stubEnv("SITE_URL", "http://127.0.0.1:5273");
    vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
    const keys = await generateKeyPair("RS256", { extractable: true });
    vi.stubEnv("JWT_PRIVATE_KEY", (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " "));
    let deliveredCode = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url) !== `${process.env.EMAIL_SERVICE_URL}/send-email`) {
        throw new Error("Unexpected network request");
      }
      const { body } = JSON.parse(String(init?.body)) as { body: string };
      deliveredCode = body.split("\n").find((line) => /^\d{6}$/.test(line)) ?? "";
      return new Response(JSON.stringify({ id: "test-email-id" }), { status: 201 });
    });

    const test = convexTest(schema, modules);
    const email = "real-reset@example.com";
    await test.action(signIn, {
      provider: "password", params: { flow: "signUp", email, password: "OldPass1" },
    });
    await test.action(signIn, { provider: "password", params: { flow: "reset", email } });
    expect(deliveredCode).toMatch(/^\d{6}$/);
    return { test, email, code: deliveredCode };
  }

  it("changes a different password without counting a failed sign-in", async () => {
    const { test, email, code } = await setupReset();
    await test.action(signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code, newPassword: "NewPass1" },
    });
    await test.run(async (ctx) => {
      const account = await ctx.db.query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
        .unique();
      if (typeof account?.secret !== "string") throw new Error("Missing password hash");
      expect(await new Scrypt().verify(account.secret, "NewPass1")).toBe(true);
      expect(await new Scrypt().verify(account.secret, "OldPass1")).toBe(false);
      expect(await ctx.db.query("authRateLimits").collect()).toHaveLength(0);
    });
    await expect(test.action(signIn, {
      provider: "password", params: { flow: "signIn", email, password: "OldPass1" },
    })).rejects.toThrow("InvalidSecret");
    await expect(test.action(signIn, {
      provider: "password", params: { flow: "signIn", email, password: "NewPass1" },
    })).resolves.toMatchObject({ tokens: expect.anything() });
  });

  it("does not reveal reuse without a valid code and removes the consumed-code session", async () => {
    const { test, email, code } = await setupReset();
    const wrongCode = code === "000000" ? "999999" : "000000";
    await expect(test.action(signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code: wrongCode, newPassword: "OldPass1" },
    })).rejects.toThrow("Could not verify code");
    await expect(test.action(signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code, newPassword: "OldPass1" },
    })).rejects.toThrow(PASSWORD_REUSE_MESSAGE);
    await test.run(async (ctx) => {
      expect(await ctx.db.query("authSessions").collect()).toHaveLength(0);
      expect(await ctx.db.query("authRefreshTokens").collect()).toHaveLength(0);
      expect((await ctx.db.query("authVerificationCodes").collect())
        .some((entry) => entry.provider === "password-reset")).toBe(false);
    });
  });

  it("resets when password sign-in attempts are exhausted", async () => {
    const { test, email, code } = await setupReset();
    const accountId = await test.run(async (ctx) => {
      const account = await ctx.db.query("authAccounts")
        .withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", email))
        .unique();
      if (!account) throw new Error("Missing password account");
      await ctx.db.insert("authRateLimits", {
        identifier: account._id, attemptsLeft: 0, lastAttemptTime: Date.now(),
      });
      return account._id;
    });
    await expect(test.action(signIn, {
      provider: "password",
      params: { flow: "reset-verification", email, code, newPassword: "NewPass1" },
    })).resolves.toMatchObject({ tokens: expect.anything() });
    await test.run(async (ctx) => {
      const limit = await ctx.db.query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", accountId)).unique();
      expect(limit?.attemptsLeft).toBe(0);
    });
  });
});
