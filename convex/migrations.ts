import type { GenericMutationCtx } from "convex/server";
import { internalMutation } from "./_generated/server";

const MIGRATION_PAGE_SIZE = 100;

/** Wide db for one-time reads of legacy tables removed from the schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy migration only
type LegacyMigrationDb = GenericMutationCtx<any>["db"];

/** One-time cleanup after removing image and points from the users schema. */
export const stripLegacyUserImageAndPoints = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db.query("users").paginate({
        numItems: MIGRATION_PAGE_SIZE,
        cursor,
      });

      for (const user of page.page) {
        if (!("image" in user) && !("points" in user)) {
          continue;
        }
        const { _id, _creationTime, image: _image, points: _points, ...replacement } = user as typeof user & {
          image?: string;
          points?: number;
        };
        void _creationTime;
        void _image;
        void _points;
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

/** One-time copy from legacy `profiles` rows into `applications`, then delete the source rows. */
export const migrateProfilesToApplications = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let skipped = 0;
    let cursor: string | null = null;

    const db = ctx.db as LegacyMigrationDb;

    while (true) {
      const page = await db.query("profiles").paginate({
        numItems: MIGRATION_PAGE_SIZE,
        cursor,
      });

      for (const profile of page.page) {
        const existing = await ctx.db
          .query("applications")
          .withIndex("by_auth_user", (q) => q.eq("authUserId", profile.authUserId))
          .first();

        if (!existing) {
          const { _id, _creationTime, ...rest } = profile;
          void _id;
          void _creationTime;
          await ctx.db.insert("applications", rest);
          migrated += 1;
        } else {
          skipped += 1;
        }

        await db.delete(profile._id);
      }

      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }

    return { ok: true as const, migrated, skipped };
  },
});

/** One-time cleanup after removing hackathonId from the applications schema. */
export const stripLegacyApplicationHackathonIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let cursor: string | null = null;

    while (true) {
      const page = await ctx.db.query("applications").paginate({
        numItems: MIGRATION_PAGE_SIZE,
        cursor,
      });

      for (const application of page.page) {
        if (!("hackathonId" in application)) {
          continue;
        }
        const { _id, _creationTime, hackathonId: _removed, ...replacement } = application as typeof application & {
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
