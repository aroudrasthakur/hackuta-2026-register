import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import {
  ensureEventConfig,
  getEventConfigRow,
  getHackathonName,
} from "./lib/eventConfig";

/** Public event metadata for the registration UI (no auth required). */
export const getPublicEventConfig = query({
  args: {},
  handler: async (ctx) => {
    const row = await getEventConfigRow(ctx);
    if (!row) {
      return { name: await getHackathonName(ctx) };
    }
    return { name: row.name };
  },
});

export const getHackathonNameInternal = internalQuery({
  args: {},
  handler: async (ctx) => getHackathonName(ctx),
});

/** Update the displayed hackathon name without redeploying the client. */
export const setHackathonName = internalMutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, { name }) => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Hackathon name is required.");
    }

    const existing = await ensureEventConfig(ctx);
    const updatedAt = Date.now();
    await ctx.db.patch(existing._id, { name: trimmed, updatedAt });
    return { ok: true as const, name: trimmed, updatedAt };
  },
});
