import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "../_generated/server";
import type { QueryCtx } from "../lib/dataModel";

export type OrganizerRole = "admin" | "reviewer";

export function configuredRole(userId: string, admins = "", reviewers = ""): OrganizerRole | null {
  const includes = (list: string) => list.split(",").map((id) => id.trim()).filter(Boolean).includes(userId);
  if (includes(admins)) return "admin";
  return includes(reviewers) ? "reviewer" : null;
}

export async function getOrganizerRole(ctx: QueryCtx): Promise<OrganizerRole | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user?.emailVerificationTime) return null;
  return configuredRole(userId, process.env.ADMIN_USER_IDS, process.env.REVIEWER_USER_IDS);
}

export const getAccess = query({
  args: {},
  handler: async (ctx) => ({ role: await getOrganizerRole(ctx) }),
});
