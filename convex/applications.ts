/**
 * Applicant drafts and dashboard data.
 *
 * Owns draft load/save and the profile page payload. Application bootstrap and
 * routing state live in applicant.ts.
 */
import { mutation, query } from "./_generated/server";
import {
  HACKATHON_SCHEDULE,
  resolveHackathonTimelineSource,
} from "../shared/hackathon/schedule";
import { getHackathonName } from "./lib/eventConfig";
import { buildHackathonTimeline } from "../shared/hackathon/timeline";
import { applicationDraftPatch } from "./applicationFields";
import { requireAuthIdentity } from "./lib/auth";
import {
  ensureDraftApplication,
  formatApplicantFullName,
  getAuthUser,
  getApplicationByUser,
  projectApplicantAnswers,
  syncAuthUserNameFromApplication,
} from "./lib/applications";
import { replaceApplicationWithDraftPatch } from "./lib/draftPatch";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  isClearedDraftValue,
  type DraftPatchPayload,
} from "../shared/registration/draftPatch";
import { stripAgreementTimestamps } from "../shared/registration/consentTimestamps";
import {
  applicationToDraftForm,
  savedResumeFromStoredApplication,
} from "../shared/registration/draftMapping";

export const getMyApplicationDraft = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return null;
    }

    const application = await getApplicationByUser(ctx, authUser._id);
    if (!application || application.status !== "draft") {
      return application
        ? {
            status: application.status,
            draft: null,
          }
        : null;
    }

    const storedResume = savedResumeFromStoredApplication(application);
    const resumeFileExists =
      storedResume !== null &&
      application.resumeStorageId !== undefined &&
      (await ctx.db.system.get("_storage", application.resumeStorageId)) !== null;

    return {
      status: application.status,
      draft: applicationToDraftForm(application),
      savedResume: resumeFileExists ? storedResume : null,
      resumeMissing: storedResume !== null && !resumeFileExists,
      updatedAt: application.updatedAt,
    };
  },
});

export const saveApplicationDraft = mutation({
  args: {
    patch: applicationDraftPatch,
  },
  handler: async (ctx, { patch }) => {
    const application = await ensureDraftApplication(ctx);
    if (application.status !== "draft") {
      throw new Error("Your application has already been submitted.");
    }

    const normalizedPatch = stripAgreementTimestamps(patch);

    const authUser = await getAuthUser(ctx);
    const email = normalizeEmail(authUser?.email) ?? application.email;
    const updatedAt = Date.now();

    await replaceApplicationWithDraftPatch(
      ctx,
      application,
      normalizedPatch as DraftPatchPayload,
      {
        email,
        emailVerificationTime:
          authUser?.emailVerificationTime ?? application.emailVerificationTime,
        updatedAt,
      },
    );

    if (authUser) {
      await syncAuthUserNameFromApplication(ctx, authUser._id, {
        firstName: isClearedDraftValue(normalizedPatch.firstName)
          ? null
          : normalizedPatch.firstName,
        lastName: isClearedDraftValue(normalizedPatch.lastName)
          ? null
          : normalizedPatch.lastName,
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
    const application = authUser ? await getApplicationByUser(ctx, authUser._id) : null;

    const resumeStatus: "none" | "attached" = application?.resumeStorageId ? "attached" : "none";
    const applicantAnswers = application ? projectApplicantAnswers(application) : null;
    const timelineSource = resolveHackathonTimelineSource(null);
    const timeline = buildHackathonTimeline(timelineSource);
    const hackathonName = await getHackathonName(ctx);

    const displayName =
      (application ? formatApplicantFullName(application) : null) ??
      authUser?.name ??
      identity.name ??
      null;

    return {
      profile: {
        displayName,
        verifiedEmail: normalizeEmail(authUser?.email ?? identity.email) ?? null,
      },
      registration: application
        ? {
            id: application._id,
            status: application.status,
            submittedAt: application.submittedAt ?? null,
            updatedAt: application.updatedAt,
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
