import { internalMutation } from "./_generated/server";

/** One-time cleanup after removing hackathonId from the profiles schema. */
export const stripLegacyProfileHackathonIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;

    // Stream every profile through one query. Convex allows only a single
    // `.paginate()` per function execution, so a paginate loop fails once the
    // table grows past one page.
    for await (const profile of ctx.db.query("profiles")) {
      if (!("hackathonId" in profile)) {
        continue;
      }
      const { _id, _creationTime, hackathonId: _removed, ...replacement } = profile as typeof profile & {
        hackathonId?: string;
      };
      void _creationTime;
      void _removed;
      await ctx.db.replace(_id, replacement);
      updated += 1;
    }

    return { ok: true as const, updated };
  },
});
