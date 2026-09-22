import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { HACKATHON_ID } from "../shared/registration/constants";
import {
  HACKATHON_SCHEDULE,
  resolveHackathonTimelineSource,
} from "../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../shared/hackathon/timeline";
import { profileDraftPatch } from "./profileFields";
import {
  ensureDraftProfile,
  getAuthUser,
  getProfileByUserAndHackathon,
  profileToDraftForm,
  projectApplicantAnswers,
} from "./lib/profiles";
import { normalizeEmail } from "./lib/normalizeEmail";

export const getMyProfileDraft = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const profile = await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
    if (!profile || profile.status !== "draft") {
      return profile
        ? {
            status: profile.status,
            draft: null,
          }
        : null;
    }

    return {
      status: profile.status,
      draft: profileToDraftForm(profile),
      updatedAt: profile.updatedAt,
    };
  },
});

export const saveProfileDraft = mutation({
  args: {
    hackathonId: v.optional(v.string()),
    patch: profileDraftPatch,
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID, patch }) => {
    const profile = await ensureDraftProfile(ctx, hackathonId);
    if (profile.status !== "draft") {
      throw new Error("Your application has already been submitted.");
    }

    const authUser = await getAuthUser(ctx);
    const email = normalizeEmail(authUser?.email) ?? profile.email;

    await ctx.db.patch(profile._id, {
      ...patch,
      email,
      emailVerificationTime:
        authUser?.emailVerificationTime ?? profile.emailVerificationTime,
      updatedAt: Date.now(),
    });

    return { ok: true as const, updatedAt: Date.now() };
  },
});

export const getMyApplicantDashboard = query({
  args: {
    hackathonId: v.optional(v.string()),
  },
  handler: async (ctx, { hackathonId = HACKATHON_ID }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required.");
    }

    const authUser = await getAuthUser(ctx);
    const profile = authUser
      ? await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId)
      : null;

    const hackathon = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", hackathonId))
      .first();

    const resumeStatus: "none" | "attached" = profile?.resumeStorageId ? "attached" : "none";
    const applicantAnswers = profile ? projectApplicantAnswers(profile) : null;
    const timelineSource = resolveHackathonTimelineSource(hackathon);
    const timeline = buildHackathonTimeline(timelineSource);

    const displayName =
      profile?.firstName && profile?.lastName
        ? `${profile.firstName} ${profile.lastName}`
        : authUser?.name ?? identity.name ?? null;

    return {
      profile: {
        displayName,
        verifiedEmail: normalizeEmail(authUser?.email ?? identity.email) ?? null,
      },
      registration: profile
        ? {
            id: profile._id,
            status: profile.status,
            eligibilityStatus: profile.eligibilityStatus,
            submittedAt: profile.submittedAt ?? null,
            updatedAt: profile.updatedAt,
            answers: applicantAnswers,
            resumeStatus,
          }
        : null,
      timeline,
      hackathon: hackathon
        ? {
            name: hackathon.name,
            startsAt: timelineSource.startsAt,
            endsAt: HACKATHON_SCHEDULE.endsAt,
            registrationOpensAt: timelineSource.registrationOpensAt,
            registrationClosesAt: timelineSource.registrationClosesAt,
            decisionsReleasedAt: timelineSource.decisionsReleasedAt ?? null,
          }
        : null,
    };
  },
});
