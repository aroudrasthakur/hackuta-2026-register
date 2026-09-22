import { v } from "convex/values";
import { OTP_SEND_MAX_PER_HOUR } from "../shared/auth/otpRateLimit";
import { internalMutation, mutation } from "./_generated/server";
import { normalizeEmail } from "./lib/normalizeEmail";
import { lookupOtpSendStatus, OTP_SEND_WINDOW_MS } from "./lib/otpSendStatus";
import {
  CONTACT_FORM_BUCKET,
  CONTACT_FORM_EMAIL_BUCKET,
  OTP_SEND_BUCKET,
  OTP_STATUS_LOOKUP_BUCKET,
} from "./lib/rateLimitBuckets";

export { OTP_RESEND_COOLDOWN_MS, OTP_SEND_WINDOW_MS } from "./lib/otpSendStatus";
export { OTP_SEND_MAX_PER_HOUR };

export const CONTACT_FORM_WINDOW_MS = 10 * 60 * 1000;
export const CONTACT_FORM_MAX_PER_WINDOW = 5;
export const CONTACT_FORM_EMAIL_MAX_PER_WINDOW = 3;
export const OTP_STATUS_LOOKUP_MAX_PER_HOUR = 30;
export const OTP_STATUS_LOOKUP_WINDOW_MS = 60 * 60 * 1000;

const NEUTRAL_OTP_STATUS = { waitSeconds: 0, hourlyLimitReached: false } as const;

async function countRecentRateLimits(
  ctx: { db: Parameters<typeof lookupOtpSendStatus>[0]["db"] },
  bucket: string,
  key: string,
  windowStart: number,
) {
  return ctx.db
    .query("rateLimits")
    .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", bucket))
    .filter((q) =>
      q.and(
        q.eq(q.field("key"), key),
        q.gte(q.field("createdAt"), windowStart),
      ),
    )
    .collect();
}

export const getOtpSendCooldown = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return NEUTRAL_OTP_STATUS;
    }

    const now = Date.now();
    const lookupWindowStart = now - OTP_STATUS_LOOKUP_WINDOW_MS;
    const lookups = await countRecentRateLimits(
      ctx,
      OTP_STATUS_LOOKUP_BUCKET,
      normalized,
      lookupWindowStart,
    );

    await ctx.db.insert("rateLimits", {
      bucket: OTP_STATUS_LOOKUP_BUCKET,
      key: normalized,
      createdAt: now,
    });

    if (lookups.length >= OTP_STATUS_LOOKUP_MAX_PER_HOUR) {
      return NEUTRAL_OTP_STATUS;
    }

    return lookupOtpSendStatus(ctx, normalized, now);
  },
});

export const clearOtpSendLimitsForEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return { deleted: 0 };

    const rows = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) => q.eq(q.field("key"), normalized))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length };
  },
});

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

    const cutoff = now - OTP_SEND_WINDOW_MS;
    const stale = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_createdAt", (q) => q.eq("bucket", OTP_SEND_BUCKET))
      .filter((q) => q.eq(q.field("key"), normalized))
      .collect();

    for (const entry of stale) {
      if (entry.createdAt < cutoff) {
        await ctx.db.delete(entry._id);
      }
    }
  },
});

export const assertContactSubmissionAllowed = internalMutation({
  args: {
    clientKey: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { clientKey, email }) => {
    const now = Date.now();
    const windowStart = now - CONTACT_FORM_WINDOW_MS;

    const recent = await countRecentRateLimits(
      ctx,
      CONTACT_FORM_BUCKET,
      clientKey,
      windowStart,
    );

    if (recent.length >= CONTACT_FORM_MAX_PER_WINDOW) {
      throw new Error("Too many contact requests. Please try again later.");
    }

    const normalizedEmail = normalizeEmail(email ?? "");
    if (normalizedEmail) {
      const emailRecent = await countRecentRateLimits(
        ctx,
        CONTACT_FORM_EMAIL_BUCKET,
        normalizedEmail,
        windowStart,
      );

      if (emailRecent.length >= CONTACT_FORM_EMAIL_MAX_PER_WINDOW) {
        throw new Error("Too many contact requests. Please try again later.");
      }
    }
  },
});

export const recordContactSubmission = internalMutation({
  args: {
    clientKey: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { clientKey, email }) => {
    const now = Date.now();
    await ctx.db.insert("rateLimits", {
      bucket: CONTACT_FORM_BUCKET,
      key: clientKey,
      createdAt: now,
    });

    const normalizedEmail = normalizeEmail(email ?? "");
    if (normalizedEmail) {
      await ctx.db.insert("rateLimits", {
        bucket: CONTACT_FORM_EMAIL_BUCKET,
        key: normalizedEmail,
        createdAt: now,
      });
    }
  },
});
