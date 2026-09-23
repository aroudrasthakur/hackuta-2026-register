import { query } from "./_generated/server";
import { v } from "convex/values";
import { HACKATHON_ID } from "../shared/registration/constants";
import { getAuthUser, getProfileByUserAndHackathon } from "./lib/profiles";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) {
      throw new Error("Authentication required.");
    }
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
      emailVerificationTime: user.emailVerificationTime,
    };
  },
});

export const getMyApplication = query({
  args: { hackathonId: v.optional(v.string()) },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;
    return getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
  },
});

export const getHackathonBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return (
      (await ctx.db
        .query("hackathons")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()) ?? null
    );
  },
});
