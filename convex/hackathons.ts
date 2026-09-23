import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type schema from "./schema";
import { HACKATHON_SCHEDULE } from "../shared/hackathon/schedule";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type HackathonDoc = DocumentByName<DataModel, "hackathons">;
type DbCtx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;

export const HACKATHON_DEFAULT_SLUG = "hackuta-2026" as const;

export const HACKATHON_SEEDS = {
  [HACKATHON_DEFAULT_SLUG]: {
    slug: HACKATHON_DEFAULT_SLUG,
    name: "HackUTA 2026",
    ...HACKATHON_SCHEDULE,
  },
} as const;

function hackathonScheduleOutOfSync(hackathon: {
  registrationOpensAt: number;
  registrationClosesAt: number;
  startsAt: number;
  endsAt: number;
}) {
  return (
    hackathon.registrationOpensAt !== HACKATHON_SCHEDULE.registrationOpensAt
    || hackathon.registrationClosesAt !== HACKATHON_SCHEDULE.registrationClosesAt
    || hackathon.startsAt !== HACKATHON_SCHEDULE.startsAt
    || hackathon.endsAt !== HACKATHON_SCHEDULE.endsAt
  );
}

export async function syncHackathonScheduleFromCanonical(
  ctx: GenericMutationCtx<DataModel>,
  hackathon: HackathonDoc,
): Promise<HackathonDoc> {
  if (!hackathonScheduleOutOfSync(hackathon)) {
    return hackathon;
  }

  await ctx.db.patch(hackathon._id, HACKATHON_SCHEDULE);
  return { ...hackathon, ...HACKATHON_SCHEDULE };
}

export async function ensureHackathon(
  ctx: DbCtx,
  slug: string,
): Promise<HackathonDoc> {
  const existing = await ctx.db
    .query("hackathons")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .first();
  if (existing) {
    if ("runMutation" in ctx) {
      return syncHackathonScheduleFromCanonical(ctx, existing);
    }
    return existing;
  }

  const seed = HACKATHON_SEEDS[slug as keyof typeof HACKATHON_SEEDS];
  if (!seed || !("runMutation" in ctx)) {
    throw new Error("Hackathon not found.");
  }

  const hackathonId = await ctx.db.insert("hackathons", seed);
  const hackathon = await ctx.db.get(hackathonId);
  if (!hackathon) {
    throw new Error("Hackathon could not be initialized.");
  }
  return hackathon;
}

export const getHackathonBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return (
      (await ctx.db
        .query("hackathons")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()) ?? null
    );
  },
});
