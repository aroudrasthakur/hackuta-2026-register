import { makeFunctionReference } from "convex/server";
import type { DataModelFromSchemaDefinition, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import type schema from "./schema";
import { MAX_RESUME_BYTES } from "../shared/registration/resume";
import { findProfileByResume } from "./lib/profiles";
import { RESUME_UPLOAD_BUCKET } from "./lib/rateLimitBuckets";
import { RESUME_UPLOAD_EXPIRY_MS } from "./lib/resumeUpload";

type MutationCtx = GenericMutationCtx<DataModelFromSchemaDefinition<typeof schema>>;

const RESUME_UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const MAX_RESUME_UPLOADS_PER_WINDOW = 5;
const MAX_GLOBAL_RESUME_UPLOADS_PER_WINDOW = 100;
const CLEANUP_PAGE_SIZE = 100;

const cleanupExpiredUploadSessionsRef = makeFunctionReference<"mutation">(
  "resumeUploads:cleanupExpiredUploadSessions",
);

export const assertUploadRateLimit = internalMutation({
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

export const createVerifiedUploadSession = internalMutation({
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
    await ctx.scheduler.runAfter(RESUME_UPLOAD_EXPIRY_MS, cleanupExpiredUploadSessionsRef, {});
  },
});

export const discardUploadSession = mutation({
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

export const cleanupExpiredUploadSessions = internalMutation({
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
      await ctx.scheduler.runAfter(0, cleanupExpiredUploadSessionsRef, {});
    }
  },
});
