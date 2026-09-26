import { ConvexError } from "convex/values";
import { OTP_SEND_MAX_PER_HOUR } from "../../shared/auth/otpRateLimit";
import type { MutationCtx } from "./dataModel";
import { lookupOtpSendStatus, OTP_SEND_WINDOW_MS } from "./otpSendStatus";
import { countRecentRateLimits, pruneStaleRateLimits } from "./rateLimitHelpers";
import {
  OTP_SEND_BUCKET,
  OTP_SEND_GLOBAL_BUCKET,
  OTP_SEND_IP_BUCKET,
  PASSWORD_RESET_SEND_BUCKET,
  PASSWORD_RESET_SEND_GLOBAL_BUCKET,
  PASSWORD_RESET_SEND_IP_BUCKET,
} from "./rateLimitBuckets";

const MAX_SENDS_PER_IP_PER_HOUR = 30;
const MAX_GLOBAL_SENDS_PER_HOUR = 500;

type AuthSendRateLimitCtx = MutationCtx;

function hashClientAddress(address: string) {
  return `ip:${address.trim().toLowerCase()}`;
}

async function assertIpAndGlobalLimits(
  ctx: AuthSendRateLimitCtx,
  now: number,
  ipBucket: string,
  globalBucket: string,
  clientAddress?: string,
) {
  const windowStart = now - OTP_SEND_WINDOW_MS;

  if (clientAddress) {
    const ipKey = hashClientAddress(clientAddress);
    const ipRecent = await countRecentRateLimits(ctx, ipBucket, ipKey, windowStart);
    if (ipRecent.length >= MAX_SENDS_PER_IP_PER_HOUR) {
      throw new ConvexError("Too many verification requests. Please try again later.");
    }
  }

  const globalRecent = await countRecentRateLimits(ctx, globalBucket, "global", windowStart);
  if (globalRecent.length >= MAX_GLOBAL_SENDS_PER_HOUR) {
    throw new ConvexError("Too many verification requests. Please try again later.");
  }
}

async function recordIpAndGlobalLimits(
  ctx: AuthSendRateLimitCtx,
  now: number,
  ipBucket: string,
  globalBucket: string,
  clientAddress?: string,
) {
  const windowStart = now - OTP_SEND_WINDOW_MS;

  if (clientAddress) {
    const ipKey = hashClientAddress(clientAddress);
    await ctx.db.insert("rateLimits", {
      bucket: ipBucket,
      key: ipKey,
      createdAt: now,
    });
    await pruneStaleRateLimits(ctx, ipBucket, ipKey, windowStart);
  }

  await ctx.db.insert("rateLimits", {
    bucket: globalBucket,
    key: "global",
    createdAt: now,
  });
  await pruneStaleRateLimits(ctx, globalBucket, "global", windowStart);
}

export async function consumeOtpSendAllowance(
  ctx: AuthSendRateLimitCtx,
  email: string,
  clientAddress?: string,
) {
  const now = Date.now();
  const status = await lookupOtpSendStatus(ctx, email, now, OTP_SEND_BUCKET);
  if (status.hourlyLimitReached) {
    throw new ConvexError("Too many verification requests. Please try again later.");
  }
  if (status.waitSeconds > 0) {
    throw new ConvexError("Please wait before requesting another code.");
  }

  await assertIpAndGlobalLimits(
    ctx,
    now,
    OTP_SEND_IP_BUCKET,
    OTP_SEND_GLOBAL_BUCKET,
    clientAddress,
  );

  await ctx.db.insert("rateLimits", {
    bucket: OTP_SEND_BUCKET,
    key: email,
    createdAt: now,
  });
  await pruneStaleRateLimits(ctx, OTP_SEND_BUCKET, email, now - OTP_SEND_WINDOW_MS);

  await recordIpAndGlobalLimits(
    ctx,
    now,
    OTP_SEND_IP_BUCKET,
    OTP_SEND_GLOBAL_BUCKET,
    clientAddress,
  );
}

export async function consumePasswordResetAllowance(
  ctx: AuthSendRateLimitCtx,
  email: string,
  clientAddress?: string,
) {
  const now = Date.now();
  const status = await lookupOtpSendStatus(ctx, email, now, PASSWORD_RESET_SEND_BUCKET);
  if (status.hourlyLimitReached) {
    throw new ConvexError("Too many reset requests. Please try again later.");
  }
  if (status.waitSeconds > 0) {
    throw new ConvexError("Please wait before requesting another code.");
  }

  await assertIpAndGlobalLimits(
    ctx,
    now,
    PASSWORD_RESET_SEND_IP_BUCKET,
    PASSWORD_RESET_SEND_GLOBAL_BUCKET,
    clientAddress,
  );

  await ctx.db.insert("rateLimits", {
    bucket: PASSWORD_RESET_SEND_BUCKET,
    key: email,
    createdAt: now,
  });
  await pruneStaleRateLimits(
    ctx,
    PASSWORD_RESET_SEND_BUCKET,
    email,
    now - OTP_SEND_WINDOW_MS,
  );

  await recordIpAndGlobalLimits(
    ctx,
    now,
    PASSWORD_RESET_SEND_IP_BUCKET,
    PASSWORD_RESET_SEND_GLOBAL_BUCKET,
    clientAddress,
  );
}

export const AUTH_SEND_IP_HOURLY_LIMIT = MAX_SENDS_PER_IP_PER_HOUR;
export const AUTH_SEND_GLOBAL_HOURLY_LIMIT = MAX_GLOBAL_SENDS_PER_HOUR;
export const AUTH_SEND_EMAIL_HOURLY_LIMIT = OTP_SEND_MAX_PER_HOUR;
