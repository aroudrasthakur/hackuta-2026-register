import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";
import { invalidateAllSessionsForUser } from "./lib/invalidateAuthSessions";

/** Clears every auth session after a successful password reset. */
export const invalidateSessionsAfterPasswordReset = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    await invalidateAllSessionsForUser(ctx, userId);
    return { ok: true as const };
  },
});

export const invalidateResetSession = internalMutation({
  args: { userId: v.id("users"), sessionId: v.id("authSessions") },
  handler: async (ctx, { userId, sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== userId) return;

    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }
    await ctx.db.delete(sessionId);
  },
});
