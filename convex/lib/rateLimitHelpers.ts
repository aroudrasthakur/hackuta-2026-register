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

/** Deletes every rate-limit row for the given bucket/key pairs (indexed lookups). */
export async function deleteRateLimitsForBucketKeys(
  ctx: RateLimitWriteCtx,
  entries: ReadonlyArray<{ bucket: string; key: string }>,
) {
  for (const { bucket, key } of entries) {
    const rows = await listRateLimitsForBucketKey(ctx, bucket, key);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
}
