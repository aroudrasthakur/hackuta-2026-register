/**
 * Applicant bootstrap and routing state.
 *
 * Owns profile row creation after sign-in and lightweight routing queries used
 * by route guards. Draft fields and dashboard payloads live in profiles.ts.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  ensureDraftProfile,
  getAuthUser,
  getProfileByUser,
  profileFormWasSubmitted,
} from "./lib/profiles";
import { normalizeEmail } from "./lib/normalizeEmail";

export const ensureApplicantProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await ensureDraftProfile(ctx);
    return { profileId: profile._id, status: profile.status };
  },
});

export const getApplicantRoutingState = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return {
        authenticated: false as const,
        verifiedEmail: null,
        hasSubmittedRegistration: false,
      };
    }

    const profile = await getProfileByUser(ctx, authUser._id);
    const hasSubmittedRegistration =
      profile !== null && profileFormWasSubmitted(profile);

    return {
      authenticated: true as const,
      verifiedEmail: normalizeEmail(authUser.email),
      hasSubmittedRegistration,
    };
  },
});
