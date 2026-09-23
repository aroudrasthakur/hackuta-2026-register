import { makeFunctionReference } from "convex/server";
import type { DataModelFromSchemaDefinition, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type schema from "./schema";
import { validateRegistrationPayload } from "../shared/registration/validation";
import type { RegistrationPayload } from "../shared/registration/types";
import { MAX_RESUME_BYTES } from "../shared/registration/resume";
import { ensureHackathon } from "./hackathons";
import {
  ensureDraftProfile,
  findProfileByResume,
  getProfileByUserAndHackathon,
  profileFormWasSubmitted,
  requireAuthUser,
  syncAuthUserNameFromProfile,
} from "./lib/profiles";
import { normalizeEmail } from "./lib/normalizeEmail";
import { RESUME_UPLOAD_BUCKET } from "./lib/rateLimitBuckets";

type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const RESUME_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESUME_UPLOADS_PER_WINDOW = 5;
const MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW = 100;
const RESUME_UPLOAD_EXPIRY_MS = 30 * 60 * 1000;
const CLEANUP_PAGE_SIZE = 100;

const cleanupExpiredResumeUploadsRef = makeFunctionReference<"mutation">(
  "registrations:cleanupExpiredResumeUploads",
);
const sendApplicationConfirmationEmailRef = makeFunctionReference<"action">(
  "email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail",
);

export const reserveResumeUpload = internalMutation({
  args: {
    requestKey: v.string(),
  },
  handler: async (ctx: MutationCtx, { requestKey }) => {
    const now = Date.now();
    const windowStart = now - RESUME_UPLOAD_WINDOW_MS;
    const [recentClientRequests, recentGlobalRequests] = await Promise.all([
      ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", RESUME_UPLOAD_BUCKET))
        .filter((q) =>
          q.and(
            q.eq(q.field("key"), requestKey),
            q.gte(q.field("createdAt"), windowStart),
          ),
        )
        .collect(),
      ctx.db
        .query("rateLimits")
        .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", RESUME_UPLOAD_BUCKET))
        .filter((q) => q.gte(q.field("createdAt"), windowStart))
        .take(MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW),
    ]);

    if (
      recentClientRequests.length >= MAX_RESUME_UPLOADS_PER_WINDOW ||
      recentGlobalRequests.length >= MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW
    ) {
      throw new Error("Too many resume upload attempts. Please wait a few minutes and try again.");
    }

    await ctx.db.insert("rateLimits", {
      bucket: RESUME_UPLOAD_BUCKET,
      key: requestKey,
      createdAt: now,
    });
  },
});

export const recordVerifiedResumeUpload = internalMutation({
  args: {
    uploadToken: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx: MutationCtx, { uploadToken, storageId }) => {
    const [existingToken, metadata] = await Promise.all([
      ctx.db
        .query("resumeUploadSessions")
        .withIndex("by_token", (q) => q.eq("token", uploadToken))
        .first(),
      ctx.db.system.get("_storage", storageId),
    ]);
    if (
      existingToken ||
      !metadata ||
      metadata.size === 0 ||
      metadata.size > MAX_RESUME_BYTES
    ) {
      throw new Error("Invalid resume upload.");
    }
    const now = Date.now();
    await ctx.db.insert("resumeUploadSessions", {
      token: uploadToken,
      storageId,
      createdAt: now,
      verifiedAt: now,
    });
    await ctx.scheduler.runAfter(RESUME_UPLOAD_EXPIRY_MS, cleanupExpiredResumeUploadsRef, {});
  },
});

async function upsertRegistration(
  ctx: MutationCtx,
  data: RegistrationPayload,
  resumeUploadToken?: string,
) {
  const authUser = await requireAuthUser(ctx);
  if (!authUser.emailVerificationTime) {
    throw new Error("Verify your email before submitting your application.");
  }

  const verifiedEmail = normalizeEmail(authUser.email);
  if (!verifiedEmail) {
    throw new Error("Authentication required.");
  }

  const { hackathonId, resumeStorageId: rawStorageId, ...fields } = data;
  await ensureHackathon(ctx, hackathonId);

  const existing = await getProfileByUserAndHackathon(ctx, authUser._id, hackathonId);
  const draftProfile = existing ?? (await ensureDraftProfile(ctx, hackathonId));

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
      ? await ctx.db
          .query("resumeUploadSessions")
          .withIndex("by_token", (q) => q.eq("token", resumeUploadToken))
          .first()
      : null;
    const validSession = !!(
      session &&
      !session.consumedAt &&
      session.storageId === resumeStorageId &&
      session.verifiedAt &&
      session.createdAt >= now - RESUME_UPLOAD_EXPIRY_MS
    );

    if (
      !metadata ||
      metadata.contentType !== "application/pdf" ||
      metadata.size === 0 ||
      metadata.size > MAX_RESUME_BYTES ||
      (!retainingOwnResume && !validSession)
    ) {
      throw new Error("Please upload a valid PDF resume of 5 MB or smaller.");
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
    hackathonId,
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

export const deleteResumeUpload = mutation({
  args: { uploadToken: v.string() },
  handler: async (ctx: MutationCtx, { uploadToken }) => {
    const session = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_token", (q) => q.eq("token", uploadToken))
      .first();
    if (!session || session.consumedAt) return { ok: true as const };

    if (session.storageId) {
      const attachment = await findProfileByResume(ctx, session.storageId);
      if (!attachment) await ctx.storage.delete(session.storageId);
    }
    await ctx.db.delete(session._id);
    return { ok: true as const };
  },
});

export const cleanupExpiredResumeUploads = internalMutation({
  args: {},
  handler: async (ctx: MutationCtx) => {
    const cutoff = Date.now() - RESUME_UPLOAD_EXPIRY_MS;
    const expiredSessions = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_PAGE_SIZE);
    for (const session of expiredSessions) {
      if (session.storageId) {
        const attachment = await findProfileByResume(ctx, session.storageId);
        if (!attachment) await ctx.storage.delete(session.storageId);
      }
      await ctx.db.delete(session._id);
    }

    const expiredRateLimits = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", RESUME_UPLOAD_BUCKET))
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(CLEANUP_PAGE_SIZE);
    for (const entry of expiredRateLimits) {
      await ctx.db.delete(entry._id);
    }

    if (
      expiredSessions.length === CLEANUP_PAGE_SIZE ||
      expiredRateLimits.length === CLEANUP_PAGE_SIZE
    ) {
      await ctx.scheduler.runAfter(0, cleanupExpiredResumeUploadsRef, {});
    }
  },
});
