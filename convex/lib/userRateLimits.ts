import { ConvexError } from "convex/values";
import type { GenericId } from "convex/values";
import type { MutationCtx } from "./dataModel";
import { countRecentRateLimits, pruneStaleRateLimits } from "./rateLimitHelpers";

const DRAFT_SAVE_BUCKET = "draft_save";
const SUBMIT_BUCKET = "registration_submit";

export async function consumeDraftSaveAllowance(
  ctx: MutationCtx,
  authUserId: GenericId<"users">,
) {
  const key = String(authUserId);
  const windowMs = 60 * 1000;
  const maxPerWindow = 60;
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = await countRecentRateLimits(ctx, DRAFT_SAVE_BUCKET, key, windowStart);

  if (recent.length >= maxPerWindow) {
    throw new ConvexError("Too many draft saves. Please wait a moment and try again.");
  }

  await ctx.db.insert("rateLimits", {
    bucket: DRAFT_SAVE_BUCKET,
    key,
    createdAt: now,
  });

  await pruneStaleRateLimits(ctx, DRAFT_SAVE_BUCKET, key, windowStart);
}

export async function consumeSubmitAllowance(
  ctx: MutationCtx,
  authUserId: GenericId<"users">,
) {
  const key = String(authUserId);
  const windowMs = 60 * 60 * 1000;
  const maxPerWindow = 10;
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = await countRecentRateLimits(ctx, SUBMIT_BUCKET, key, windowStart);

  if (recent.length >= maxPerWindow) {
    throw new ConvexError("Too many submission attempts. Please try again later.");
  }

  await ctx.db.insert("rateLimits", {
    bucket: SUBMIT_BUCKET,
    key,
    createdAt: now,
  });

  await pruneStaleRateLimits(ctx, SUBMIT_BUCKET, key, windowStart);
}
