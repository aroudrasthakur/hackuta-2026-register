import { makeFunctionReference } from "convex/server";
import type { DataModelFromSchemaDefinition, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import type schema from "./schema";
import { validateRegistrationPayload } from "../shared/registration/validation";
import type { RegistrationPayload } from "../shared/registration/types";
import { 
  MAX_RESUME_BYTES,
  RESUME_SIZE_ERROR_MESSAGE,
} from "../shared/registration/resume";
import { getHackathonName } from "./lib/eventConfig";
import { requireVerifiedAuthUser } from "./lib/auth";
import {
  ensureDraftProfile,
  findProfileByResume,
  getProfileByUser,
  profileFormWasSubmitted,
  syncAuthUserNameFromProfile,
} from "./lib/profiles";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  findUploadSessionByToken,
  isVerifiedUploadSessionValid,
} from "./lib/resumeUpload";

type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const sendApplicationConfirmationEmailRef = makeFunctionReference<"action">(
  "email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail",
);

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

  const existing = await getProfileByUser(ctx, authUser._id);
  const draftProfile = existing ?? (await ensureDraftProfile(ctx));

  if (profileFormWasSubmitted(draftProfile)) {
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
      ? await findProfileByResume(ctx, resumeStorageId)
      : null;

    if (attachment && attachment._id !== draftProfile._id) {
      throw new Error("This resume is already attached to another application.");
    }

    const retainingOwnResume = attachment?._id === draftProfile._id;
    const session = resumeUploadToken
      ? await findUploadSessionByToken(ctx, resumeUploadToken)
      : null;
    const validSession = isVerifiedUploadSessionValid(
      session,
      resumeStorageId!,
      now,
    );

    if (metadata?.size && metadata.size > MAX_RESUME_BYTES) {
      throw new Error(RESUME_SIZE_ERROR_MESSAGE)
    }
    if (
      !metadata ||
      metadata.contentType !== "application/pdf" ||
      metadata.size === 0 ||
      (!retainingOwnResume && !validSession)
    ) {
      throw new Error("Please upload a valid PDF resume of 2 MB or smaller.");
    }

    if (validSession && session) {
      await ctx.db.patch(session._id, { consumedAt: now });
    }
  }

  const submittedAt = Date.now();
  const previousResume = draftProfile.resumeStorageId;

  await ctx.db.patch(draftProfile._id, {
    ...fields,
    otherSchool: draftProfile.otherSchool,
    otherMajor: draftProfile.otherMajor,
    otherHearAbout: draftProfile.otherHearAbout,
    email: verifiedEmail,
    emailVerificationTime: authUser.emailVerificationTime,
    status: "submitted",
    formSubmitted: true,
    confirmationStatus: "unconfirmed",
    submittedAt,
    updatedAt: submittedAt,
    resumeStorageId: resumeStorageId ?? undefined,
  });

  await syncAuthUserNameFromProfile(ctx, authUser._id, data);

  if (previousResume && previousResume !== resumeStorageId) {
    await ctx.storage.delete(previousResume);
  }

  await ctx.scheduler.runAfter(0, sendApplicationConfirmationEmailRef, {
    email: verifiedEmail,
    firstName: data.firstName,
    lastName: data.lastName,
    submittedAt,
    hackathonName: await getHackathonName(ctx),
  });

  return {
    registrationId: draftProfile._id,
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

export const register = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), resumeUploadToken),
});

export const submitRegistration = mutation({
  args: registrationArgs,
  handler: async (ctx, { data, resumeUploadToken }) =>
    upsertRegistration(ctx, parseRegistrationData(data), resumeUploadToken),
});
