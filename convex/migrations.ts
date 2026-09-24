import type { GenericMutationCtx } from "convex/server";
import { internalMutation } from "./_generated/server";

/** Wide db for one-time reads of legacy tables removed from the schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy migration only
type LegacyMigrationDb = GenericMutationCtx<any>["db"];

/** One-time cleanup after removing image and points from the users schema. */
export const stripLegacyUserImageAndPoints = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;

    for await (const user of ctx.db.query("users")) {
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

    return { ok: true as const, updated };
  },
});

/** One-time copy from legacy `profiles` rows into `applications`, then delete the source rows. */
export const migrateProfilesToApplications = internalMutation({
  args: {},
  handler: async (ctx) => {
    let migrated = 0;
    let skipped = 0;
    const db = ctx.db as LegacyMigrationDb;

    for await (const profile of db.query("profiles")) {
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

    return { ok: true as const, migrated, skipped };
  },
});

/** One-time cleanup after removing hackathonId from the applications schema. */
export const stripLegacyApplicationHackathonIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;

    // Stream every application through one query. Convex allows only a single
    // `.paginate()` per function execution, so a paginate loop fails once the
    // table grows past one page.
    for await (const application of ctx.db.query("applications")) {
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

    return { ok: true as const, updated };
  },
});
