/**
 * Applicant bootstrap and routing state.
 *
 * Owns profile row creation after sign-in and lightweight routing queries used
 * by route guards. Draft fields and dashboard payloads live in profiles.ts.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { HACKATHON_ID } from "../shared/registration/constants";
import {
  ensureDraftProfile,
  getAuthUser,
  getProfileByUserAndHackathon,
  profileFormWasSubmitted,
} from "./lib/profiles";
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
        hasSubmittedRegistration: false,
      };
    }

    const profile = await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
    const hasSubmittedRegistration =
      profile !== null && profileFormWasSubmitted(profile);

    return {
      authenticated: true as const,
      verifiedEmail: normalizeEmail(authUser.email),
      hasSubmittedRegistration,
    };
  },
});
