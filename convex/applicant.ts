import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { HACKATHON_ID } from "../shared/registration/constants";
import {
  HACKATHON_SCHEDULE,
  resolveHackathonTimelineSource,
} from "../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../shared/hackathon/timeline";
import { ensureDraftProfile, getAuthUser, getProfileByUserAndHackathon } from "./lib/profiles";
import { normalizeEmail } from "./lib/normalizeEmail";

export const ensureApplicantProfile = mutation({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const profile = await ensureDraftProfile(ctx, hackathonId);
    return { profileId: profile._id, status: profile.status };
  },
});

export const getApplicantRoutingState = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return {
        authenticated: false as const,
        verifiedEmail: null,
        emailVerified: false,
        hasRegistration: false,
        hasSubmittedRegistration: false,
        registrationStatus: null,
      };
    }

    const profile = await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
    const verifiedEmail = normalizeEmail(authUser.email);
    const emailVerified = Boolean(authUser.emailVerificationTime);

    const hasSubmittedRegistration =
      profile !== null && profile.status === "submitted";

    return {
      authenticated: true as const,
      verifiedEmail,
      emailVerified,
      hasRegistration: profile !== null,
      hasSubmittedRegistration,
      registrationStatus: profile?.status ?? null,
    };
  },
});

export const getMyApplicantTimeline = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return null;

    const source = resolveHackathonTimelineSource(HACKATHON_SCHEDULE);
    return buildHackathonTimeline(source);
  },
});
