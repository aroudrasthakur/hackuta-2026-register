import { query } from "./_generated/server";
import { v } from "convex/values";
import { HACKATHON_ID } from "../shared/registration/constants";
import { getAuthUser, getProfileByUserAndHackathon } from "./lib/profiles";
import { isRegistrationAdmin } from "./registrationSecurity";

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

export const getApplicationsByHackathon = query({
  args: { hackathonId: v.string() },
  handler: async (ctx, { hackathonId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }
    if (!isRegistrationAdmin(identity.tokenIdentifier)) {
      throw new Error("Not authorized to access hackathon registrations.");
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_hackathon_status", (q) => q.eq("hackathonId", hackathonId))
      .filter((q) => q.eq(q.field("status"), "submitted"))
      .collect();

    const results = profiles.map((profile) => ({
      profileId: profile._id,
      authUserId: profile.authUserId,
      email: profile.email,
      application: profile,
    }));

    console.log(
      JSON.stringify({
        event: "admin_applications_access",
        identityKey: identity.tokenIdentifier,
        hackathonId,
        resultCount: results.length,
        at: Date.now(),
      }),
    );

    return results;
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
