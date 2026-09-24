/**
 * Applicant drafts and dashboard data.
 *
 * Owns draft load/save and the profile page payload. Profile bootstrap and
 * routing state live in applicant.ts.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  HACKATHON_SCHEDULE,
  resolveHackathonTimelineSource,
} from "../shared/hackathon/schedule";
import { getHackathonName } from "./lib/eventConfig";
import { buildHackathonTimeline } from "../shared/hackathon/timeline";
import { profileDraftPatch } from "./profileFields";
import { requireAuthIdentity } from "./lib/auth";
import {
  ensureDraftProfile,
  formatProfileFullName,
  getAuthUser,
  getProfileByUser,
  projectApplicantAnswers,
  syncAuthUserNameFromProfile,
} from "./lib/profiles";
import { replaceProfileWithDraftPatch } from "./lib/draftPatch";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  isClearedDraftValue,
  type DraftPatchPayload,
} from "../shared/registration/draftPatch";
import { profileToDraftForm } from "../shared/registration/draftMapping";

export const getMyProfileDraft = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const profile = await getProfileByUser(ctx, authUser._id);
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
    patch: profileDraftPatch,
  },
  handler: async (ctx, { patch }) => {
    const profile = await ensureDraftProfile(ctx);
    if (profile.status !== "draft") {
      throw new Error("Your application has already been submitted.");
    }

    const authUser = await getAuthUser(ctx);
    const email = normalizeEmail(authUser?.email) ?? profile.email;
    const updatedAt = Date.now();

    await replaceProfileWithDraftPatch(
      ctx,
      profile,
      patch as DraftPatchPayload,
      {
        email,
        emailVerificationTime:
          authUser?.emailVerificationTime ?? profile.emailVerificationTime,
        updatedAt,
      },
    );

    if (authUser) {
      await syncAuthUserNameFromProfile(ctx, authUser._id, {
        firstName: isClearedDraftValue(patch.firstName) ? null : patch.firstName,
        lastName: isClearedDraftValue(patch.lastName) ? null : patch.lastName,
      });
    }

    return { ok: true as const, updatedAt };
  },
});

export const getMyApplicantDashboard = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuthIdentity(ctx);

    const authUser = await getAuthUser(ctx);
    const profile = authUser ? await getProfileByUser(ctx, authUser._id) : null;

    const resumeStatus: "none" | "attached" = profile?.resumeStorageId ? "attached" : "none";
    const applicantAnswers = profile ? projectApplicantAnswers(profile) : null;
    const timelineSource = resolveHackathonTimelineSource(null);
    const timeline = buildHackathonTimeline(timelineSource);
    const hackathonName = await getHackathonName(ctx);

    const displayName =
      (profile ? formatProfileFullName(profile) : null) ??
      authUser?.name ??
      identity.name ??
      null;

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
      hackathon: {
        name: hackathonName,
        startsAt: timelineSource.startsAt,
        endsAt: HACKATHON_SCHEDULE.endsAt,
        registrationOpensAt: timelineSource.registrationOpensAt,
        registrationClosesAt: timelineSource.registrationClosesAt,
        decisionsReleasedAt: timelineSource.decisionsReleasedAt ?? null,
      },
    };
  },
});
