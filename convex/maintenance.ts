import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./lib/dataModel";
import { normalizeEmail } from "./lib/normalizeEmail";
import { getApplicationByUser } from "./lib/applications";
import { invalidateAllSessionsForUser } from "./lib/invalidateAuthSessions";

type ResettableTable =
  | "applications"
  | "applicationSubmissionLogs"
  | "resumeUploadSessions"
  | "rateLimits"
  | "emailDeliveries"
  | "emailDeliveryRecordingFailures"
  | "authRefreshTokens"
  | "authVerificationCodes"
  | "authVerifiers"
  | "authSessions"
  | "authAccounts"
  | "authRateLimits"
  | "users";

const CLEANUP_PAGE_SIZE = 100;
export const EMAIL_DELIVERY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const pruneOldEmailDeliveriesRef = makeFunctionReference<"mutation">(
  "maintenance:pruneOldEmailDeliveries",
);

async function deleteAllFromTable(ctx: MutationCtx, table: ResettableTable) {
  let deleted = CLEANUP_PAGE_SIZE;
  while (deleted === CLEANUP_PAGE_SIZE) {
    const rows = await ctx.db.query(table).take(CLEANUP_PAGE_SIZE);
    deleted = rows.length;
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
}

async function deleteAllStorage(ctx: MutationCtx) {
  let deleted = CLEANUP_PAGE_SIZE;
  while (deleted === CLEANUP_PAGE_SIZE) {
    const files = await ctx.db.system
      .query("_storage")
      .take(CLEANUP_PAGE_SIZE);
    deleted = files.length;
    for (const file of files) {
      await ctx.storage.delete(file._id);
    }
  }
}

/**
 * Wipes all application and auth data from the deployment.
 * Run from Convex dashboard (internal) or: npx convex run maintenance:resetAllData --prod
 */
export const resetAllData = internalMutation({
  args: {},
  handler: async (ctx) => {
    await deleteAllStorage(ctx);

    await deleteAllFromTable(ctx, "applicationSubmissionLogs");
    await deleteAllFromTable(ctx, "applications");
    await deleteAllFromTable(ctx, "resumeUploadSessions");
    await deleteAllFromTable(ctx, "rateLimits");
    await deleteAllFromTable(ctx, "emailDeliveries");
    await deleteAllFromTable(ctx, "emailDeliveryRecordingFailures");

    await deleteAllFromTable(ctx, "authRefreshTokens");
    await deleteAllFromTable(ctx, "authVerificationCodes");
    await deleteAllFromTable(ctx, "authVerifiers");
    await deleteAllFromTable(ctx, "authSessions");
    await deleteAllFromTable(ctx, "authAccounts");
    await deleteAllFromTable(ctx, "authRateLimits");
    await deleteAllFromTable(ctx, "users");

    return { ok: true as const };
  },
});

/** Deletes email delivery audit rows older than the retention window. */
export const pruneOldEmailDeliveries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - EMAIL_DELIVERY_RETENTION_MS;
    const stale = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_PAGE_SIZE);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    const failureStale = await ctx.db
      .query("emailDeliveryRecordingFailures")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_PAGE_SIZE);

    for (const row of failureStale) {
      await ctx.db.delete(row._id);
    }

    const shouldReschedule =
      stale.length === CLEANUP_PAGE_SIZE || failureStale.length === CLEANUP_PAGE_SIZE;
    if (shouldReschedule) {
      await ctx.scheduler.runAfter(0, pruneOldEmailDeliveriesRef, {});
    }

    return {
      ok: true as const,
      deletedDeliveries: stale.length,
      deletedFailures: failureStale.length,
      rescheduled: shouldReschedule,
    };
  },
});

/** Removes one account and its application data by email (audit/test cleanup). */
export const deleteAccountByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return { ok: false as const, reason: "invalid_email" as const };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (!user) {
      return { ok: true as const, deleted: 0 };
    }

    const application = await getApplicationByUser(ctx, user._id);
    if (application?.resumeStorageId) {
      await ctx.storage.delete(application.resumeStorageId);
    }
    if (application) {
      const logs = await ctx.db
        .query("applicationSubmissionLogs")
        .withIndex("by_application", (q) => q.eq("applicationId", application._id))
        .collect();
      for (const log of logs) {
        await ctx.db.delete(log._id);
      }
      await ctx.db.delete(application._id);
    }

    const uploadSessions = await ctx.db
      .query("resumeUploadSessions")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", user._id))
      .collect();
    for (const session of uploadSessions) {
      if (session.storageId) {
        await ctx.storage.delete(session.storageId);
      }
      await ctx.db.delete(session._id);
    }

    const deliveries = await ctx.db
      .query("emailDeliveries")
      .withIndex("by_recipient", (q) => q.eq("recipient", normalized))
      .collect();
    for (const row of deliveries) {
      await ctx.db.delete(row._id);
    }

    const deliveryFailures = await ctx.db
      .query("emailDeliveryRecordingFailures")
      .withIndex("by_recipient", (q) => q.eq("recipient", normalized))
      .collect();
    for (const row of deliveryFailures) {
      await ctx.db.delete(row._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .filter((q) => q.eq(q.field("accountId"), account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
    }

    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
    for (const session of sessions) {
      const verifiers = await ctx.db
        .query("authVerifiers")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();
      for (const verifier of verifiers) {
        await ctx.db.delete(verifier._id);
      }
    }

    await invalidateAllSessionsForUser(ctx, user._id);

    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    for (const account of accounts) {
      const limitsForAccount = await ctx.db
        .query("authRateLimits")
        .withIndex("identifier", (q) => q.eq("identifier", account._id))
        .collect();
      for (const row of limitsForAccount) {
        await ctx.db.delete(row._id);
      }
    }

    const limitsForEmail = await ctx.db
      .query("authRateLimits")
      .filter((q) => q.eq(q.field("identifier"), normalized))
      .collect();
    for (const row of limitsForEmail) {
      await ctx.db.delete(row._id);
    }

    let deletedRateLimits = CLEANUP_PAGE_SIZE;
    while (deletedRateLimits === CLEANUP_PAGE_SIZE) {
      const rows = await ctx.db
        .query("rateLimits")
        .filter((q) =>
          q.or(q.eq(q.field("key"), normalized), q.eq(q.field("key"), user._id)),
        )
        .take(CLEANUP_PAGE_SIZE);
      deletedRateLimits = rows.length;
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    await ctx.db.delete(user._id);

    return { ok: true as const, deleted: 1 };
  },
});
