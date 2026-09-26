import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { applicationRecord } from "./applicationFields";
import { emailDeliveryKind } from "./lib/emailDeliveries";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
  }).index("email", ["email"]),

  eventConfig: defineTable({
    key: v.literal("current"),
    name: v.string(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  applications: defineTable(applicationRecord)
    .index("by_auth_user", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_resume", ["resumeStorageId"]),

  applicationSubmissionLogs: defineTable({
    ...applicationRecord,
    applicationId: v.id("applications"),
  }).index("by_application", ["applicationId"]),

  rateLimits: defineTable({
    bucket: v.string(),
    key: v.string(),
    createdAt: v.number(),
  })
    .index("by_bucket_createdAt", ["bucket", "createdAt"])
    .index("by_bucket_key_createdAt", ["bucket", "key", "createdAt"]),

  resumeUploadSessions: defineTable({
    token: v.string(),
    authUserId: v.id("users"),
    createdAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    verifiedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_storage", ["storageId"])
    .index("by_auth_user", ["authUserId"])
    .index("by_createdAt", ["createdAt"]),

  emailDeliveries: defineTable({
    serviceId: v.string(),
    kind: emailDeliveryKind,
    recipient: v.string(),
    createdAt: v.number(),
  }).index("by_recipient", ["recipient"]),

  /** Queued emails whose emailDeliveries row could not be written (support lookup). */
  emailDeliveryRecordingFailures: defineTable({
    serviceId: v.string(),
    kind: emailDeliveryKind,
    recipient: v.string(),
    errorMessage: v.string(),
    createdAt: v.number(),
  })
    .index("by_serviceId", ["serviceId"])
    .index("by_recipient", ["recipient"]),
});
