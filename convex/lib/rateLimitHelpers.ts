import type { MutationCtx, QueryCtx } from "./dataModel";

type RateLimitReadCtx = { db: QueryCtx["db"] | MutationCtx["db"] };
type RateLimitWriteCtx = { db: MutationCtx["db"] };

export async function listRateLimitsForBucketKey(
  ctx: RateLimitReadCtx,
  bucket: string,
  key: string,
) {
  return ctx.db
    .query("rateLimits")
    .withIndex("by_bucket_key_createdAt", (q) => q.eq("bucket", bucket).eq("key", key))
    .collect();
}

export async function countRecentRateLimits(
  ctx: RateLimitReadCtx,
  bucket: string,
  key: string,
  windowStart: number,
) {
  return ctx.db
    .query("rateLimits")
    .withIndex("by_bucket_key_createdAt", (q) => q.eq("bucket", bucket).eq("key", key))
    .filter((q) => q.gte(q.field("createdAt"), windowStart))
    .collect();
}

export async function pruneStaleRateLimits(
  ctx: RateLimitWriteCtx,
  bucket: string,
  key: string,
  cutoff: number,
) {
  const stale = await ctx.db
    .query("rateLimits")
    .withIndex("by_bucket_key_createdAt", (q) => q.eq("bucket", bucket).eq("key", key))
    .filter((q) => q.lt(q.field("createdAt"), cutoff))
    .collect();

  for (const entry of stale) {
    await ctx.db.delete(entry._id);
  }
}
