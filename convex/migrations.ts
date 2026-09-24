import { internalMutation } from "./_generated/server";

const MIGRATION_PAGE_SIZE = 100;

/** One-time cleanup after removing hackathonId from the profiles schema. */
export const stripLegacyProfileHackathonIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db.query("profiles").paginate({
        numItems: MIGRATION_PAGE_SIZE,
        cursor,
      });

      for (const profile of page.page) {
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

      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    return { ok: true as const, updated };
  },
});
