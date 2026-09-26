import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { EMERGENCY_CONTACT_FIELDS } from "../shared/registration/emergencyContact";
import { validateRegistrationPayload } from "../shared/registration/validation";
import type { RegistrationPayload } from "../shared/registration/types";
import {
  MAX_RESUME_BYTES,
  RESUME_MISSING_MESSAGE,
  RESUME_SIZE_ERROR_MESSAGE,
} from "../shared/registration/resume";
import type { MutationCtx } from "./lib/dataModel";
import { deleteStorageIfExists } from "./lib/draftResume";
import { getHackathonName } from "./lib/eventConfig";
import { requireVerifiedAuthUser } from "./lib/auth";
import {
  applicationFormWasSubmitted,
  ensureDraftApplication,
  findApplicationByResume,
  getApplicationByUser,
  syncAuthUserNameFromApplication,
} from "./lib/applications";
import { applyAgreementTimestampUpdates } from "../shared/registration/consentTimestamps";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  findUploadSessionByToken,
  isVerifiedUploadSessionValid,
  uploadSessionOwnedByUser,
} from "./lib/resumeUpload";

const sendApplicationConfirmationEmailRef = makeFunctionReference<"action">(
  "email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail",
);

const EMERGENCY_CONTACT_STORAGE_FIELDS = [
  ...EMERGENCY_CONTACT_FIELDS,
  "emergencyContactPhoneCountry",
] as const;

/**
 * A cleared emergency contact is omitted from the validated payload. Convex
 * patch leaves missing keys untouched and only unsets keys that are present
 * and undefined, so copy those omissions onto the patch. Otherwise a draft
 * name and relationship survive after the phone is removed.
 */
function withOmittedEmergencyContactCleared(
  fields: RegistrationPayload,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...fields };
  if (next.emergencyContactPhone !== undefined) return next;

  for (const field of EMERGENCY_CONTACT_STORAGE_FIELDS) {
    next[field] = undefined;
  }
  return next;
}

async function upsertRegistration(
  ctx: MutationCtx,
  data: RegistrationPayload,
  resumeUploadToken?: string,
) {
  const authUser = await requireVerifiedAuthUser(ctx);

  const verifiedEmail = normalizeEmail(authUser.email);
  if (!verifiedEmail) {
    throw new Error("Authentication required.");
  }

  const { resumeStorageId: rawStorageId, ...fields } = data;

  const existing = await getApplicationByUser(ctx, authUser._id);
  const draftApplication = existing ?? (await ensureDraftApplication(ctx));

  if (applicationFormWasSubmitted(draftApplication)) {
    throw new Error("You have already submitted an application.");
  }

  const resumeStorageId = rawStorageId
    ? ctx.db.system.normalizeId("_storage", rawStorageId)
    : undefined;

  if (rawStorageId) {
    const now = Date.now();
    const metadata = resumeStorageId
      ? await ctx.db.system.get("_storage", resumeStorageId)
      : null;
    const attachment = resumeStorageId
      ? await findApplicationByResume(ctx, resumeStorageId)
      : null;

    if (attachment && attachment._id !== draftApplication._id) {
      throw new Error("This resume is already attached to another application.");
    }

    const retainingOwnResume = attachment?._id === draftApplication._id;
    const session = resumeUploadToken
      ? await findUploadSessionByToken(ctx, resumeUploadToken)
      : null;
    const validSession =
      isVerifiedUploadSessionValid(session, resumeStorageId!, now) &&
      uploadSessionOwnedByUser(session, authUser._id);

    if (retainingOwnResume && !metadata) {
      throw new Error(RESUME_MISSING_MESSAGE);
    }

    if (metadata?.size != null && metadata.size > MAX_RESUME_BYTES) {
      throw new Error(RESUME_SIZE_ERROR_MESSAGE);
    }

    const resumeInvalid =
      !metadata ||
      metadata.contentType !== "application/pdf" ||
      metadata.size === 0 ||
      (!retainingOwnResume && !validSession);

    if (resumeInvalid) {
      throw new Error("Please upload a valid PDF resume of 2 MB or smaller.");
    }

    if (validSession && session) {
      await ctx.db.patch(session._id, { consumedAt: now });
    }
  }

  const submittedAt = Date.now();
  const previousResume = draftApplication.resumeStorageId;
  const keepsDraftResume = Boolean(resumeStorageId) && resumeStorageId === previousResume;

  const submissionPatch: Record<string, unknown> = {
    ...withOmittedEmergencyContactCleared(fields),
    email: verifiedEmail,
    emailVerificationTime: authUser.emailVerificationTime,
    status: "submitted",
    formSubmitted: true,
    submittedAt,
    updatedAt: submittedAt,
    resumeStorageId: resumeStorageId ?? undefined,
    resumeFilename: keepsDraftResume ? draftApplication.resumeFilename : undefined,
  };
  applyAgreementTimestampUpdates(
    submissionPatch,
    draftApplication,
    fields,
    submittedAt,
  );

  await ctx.db.patch(draftApplication._id, submissionPatch);

  await syncAuthUserNameFromApplication(ctx, authUser._id, data);

  if (previousResume && previousResume !== resumeStorageId) {
    await deleteStorageIfExists(ctx, previousResume);
  }

  await ctx.scheduler.runAfter(0, sendApplicationConfirmationEmailRef, {
    email: verifiedEmail,
    firstName: data.firstName,
    lastName: data.lastName,
    submittedAt,
    hackathonName: await getHackathonName(ctx),
  });

  return {
    registrationId: draftApplication._id,
    isNew: !existing,
    ok: true as const,
  };
}

function parseRegistrationData(data: unknown): RegistrationPayload {
  const result = validateRegistrationPayload(data);
  if (!result.success) throw new Error("Invalid registration data.");
  return result.payload;
}

const registrationArgs = {
  data: v.any(),
  resumeUploadToken: v.optional(v.string()),
};

export const submitRegistration = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), resumeUploadToken),
});
