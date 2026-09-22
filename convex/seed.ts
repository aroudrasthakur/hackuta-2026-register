import { internalMutation } from "./_generated/server";
import { HACKATHON_SCHEDULE } from "../shared/hackathon/schedule";
import { syncHackathonScheduleFromCanonical } from "./hackathons";

export const seedHackathon = internalMutation({
  args: {},
  handler: async (ctx) => {
    const slug = "hackuta-2026";
    const existing = await ctx.db
      .query("hackathons")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      await syncHackathonScheduleFromCanonical(ctx, existing);
      return existing._id;
    }

    return ctx.db.insert("hackathons", {
      slug,
      name: "HackUTA 2026",
      ...HACKATHON_SCHEDULE,
    });
  },
});