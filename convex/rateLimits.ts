import { v } from "convex/values";
import { OTP_SEND_MAX_PER_HOUR } from "../shared/auth/otpRateLimit";
import { internalMutation, query } from "./_generated/server";
import { normalizeEmail } from "./lib/normalizeEmail";
import {
  consumeOtpSendAllowance,
  consumePasswordResetAllowance,
} from "./lib/authSendRateLimits";
import { lookupOtpSendStatus, OTP_SEND_WINDOW_MS } from "./lib/otpSendStatus";
import { pruneStaleRateLimits } from "./lib/rateLimitHelpers";
import {
  consumeDraftSaveAllowance,
  consumeSubmitAllowance,
} from "./lib/userRateLimits";
import {
  OTP_SEND_BUCKET,
  PASSWORD_RESET_SEND_BUCKET,
} from "./lib/rateLimitBuckets";

export { OTP_RESEND_COOLDOWN_MS, OTP_SEND_WINDOW_MS } from "./lib/otpSendStatus";
export { OTP_SEND_MAX_PER_HOUR };

const NEUTRAL_OTP_STATUS = { waitSeconds: 0, hourlyLimitReached: false } as const;

const PRUNE_BATCH_SIZE = 100;
/** Keep rows for one hour after their bucket window so lookups stay accurate. */
export const RATE_LIMIT_RETENTION_MS = OTP_SEND_WINDOW_MS + 60 * 60 * 1000;

export const getOtpSendCooldown = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return NEUTRAL_OTP_STATUS;
    }

    return lookupOtpSendStatus(ctx, normalized);
  },
});

export const getPasswordResetSendCooldown = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return NEUTRAL_OTP_STATUS;
    }

    return lookupOtpSendStatus(ctx, normalized, Date.now(), PASSWORD_RESET_SEND_BUCKET);
  },
});

export const clearOtpSendLimitsForEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return { deleted: 0 };

    const rows = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_key_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) => q.eq(q.field("key"), normalized))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length };
  },
});

/** @deprecated Use consumeOtpSendRequest — kept for tests that seed limits directly. */
export const assertOtpSendAllowed = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error("Invalid email.");
    }

    const status = await lookupOtpSendStatus(ctx, normalized);
    if (status.hourlyLimitReached) {
      throw new Error("Too many verification requests. Please try again later.");
    }
    if (status.waitSeconds > 0) {
      throw new Error("Please wait before requesting another code.");
    }
  },
});

/** @deprecated Use consumeOtpSendRequest — kept for tests that seed limits directly. */
export const recordOtpSend = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const now = Date.now();
    await ctx.db.insert("rateLimits", {
      bucket: OTP_SEND_BUCKET,
      key: normalized,
      createdAt: now,
    });

    await pruneStaleRateLimits(ctx, OTP_SEND_BUCKET, normalized, now - OTP_SEND_WINDOW_MS);
  },
});

// Check and record in one mutation to prevent concurrent requests bypassing limits.
export const consumeOtpSendRequest = internalMutation({
  args: {
    email: v.string(),
    clientAddress: v.optional(v.string()),
  },
  handler: async (ctx, { email, clientAddress }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error("Invalid email.");
    }

    await consumeOtpSendAllowance(ctx, normalized, clientAddress);
  },
});

// Count requests for all addresses, including missing accounts. Checking and
// recording in one mutation also prevents concurrent requests bypassing limits.
export const consumePasswordResetRequest = internalMutation({
  args: {
    email: v.string(),
    clientAddress: v.optional(v.string()),
  },
  handler: async (ctx, { email, clientAddress }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new Error("Invalid email.");
    }

    await consumePasswordResetAllowance(ctx, normalized, clientAddress);
  },
});

/** Deletes expired rate-limit rows in batches. Scheduled by cron. */
export const pruneExpiredRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RATE_LIMIT_RETENTION_MS;
    const stale = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(PRUNE_BATCH_SIZE);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    if (stale.length === PRUNE_BATCH_SIZE) {
      return { ok: true as const, deleted: stale.length, rescheduled: true };
    }

    return { ok: true as const, deleted: stale.length, rescheduled: false };
  },
});

/** Per-user draft save throttle — checked and recorded atomically. */
export const consumeDraftSaveRequest = internalMutation({
  args: { authUserId: v.id("users") },
  handler: async (ctx, { authUserId }) => {
    await consumeDraftSaveAllowance(ctx, authUserId);
  },
});

/** Per-user submission throttle — checked and recorded atomically. */
export const consumeSubmitRequest = internalMutation({
  args: { authUserId: v.id("users") },
  handler: async (ctx, { authUserId }) => {
    await consumeSubmitAllowance(ctx, authUserId);
  },
});
