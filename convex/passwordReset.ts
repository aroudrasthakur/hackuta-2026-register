import { mutation } from "./_generated/server";
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
