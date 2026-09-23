import { internalMutation } from "./_generated/server";
import { ensureHackathon, HACKATHON_DEFAULT_SLUG } from "./hackathons";

export const seedHackathon = internalMutation({
  args: {},
  handler: async (ctx) => {
    const hackathon = await ensureHackathon(ctx, HACKATHON_DEFAULT_SLUG);
    return hackathon._id;
  },
});
