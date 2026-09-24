import type { DataModelFromSchemaDefinition, GenericMutationCtx } from "convex/server";
import type { GenericId } from "convex/values";
import type schema from "../schema";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type MutationCtx = GenericMutationCtx<DataModel>;

/** Remove every session and refresh token for the given auth user. */
export async function invalidateAllSessionsForUser(
  ctx: MutationCtx,
  userId: GenericId<"users">,
) {
  const sessions = await ctx.db
    .query("authSessions")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();

  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .filter((q) => q.eq(q.field("sessionId"), session._id))
      .collect();

    for (const token of refreshTokens) {
      await ctx.db.delete(token._id);
    }

    await ctx.db.delete(session._id);
  }
}
