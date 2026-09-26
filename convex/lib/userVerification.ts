import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const isUserEmailVerified = internalQuery({
  args: { authUserId: v.id("users") },
  handler: async (ctx, { authUserId }) => {
    const user = await ctx.db.get(authUserId);
    return Boolean(user?.emailVerificationTime);
  },
});
