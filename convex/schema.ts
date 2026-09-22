import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
import { profileRecord } from "./profileFields";

/**
 * Canonical Convex schema for hackuta-2026-register.
 *
 * Auth identity → `users` (+ Convex Auth tables from authTables).
 * Application data → `profiles` (one row per user per hackathon).
 *
 * Deploy from this repo: npx convex dev | npx convex deploy --prod
 * Field validators: convex/profileFields.ts
 */
export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    /** Event points (admin-managed; optional until points system launches). */
    points: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  profiles: defineTable(profileRecord)
    .index("by_auth_user", ["authUserId"])
    .index("by_auth_user_hackathon", ["authUserId", "hackathonId"])
    .index("by_email", ["email"])
    .index("by_hackathon_status", ["hackathonId", "status"])
    .index("by_resume", ["resumeStorageId"]),

  hackathons: defineTable({
    slug: v.string(),
    name: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    registrationOpensAt: v.number(),
    registrationClosesAt: v.number(),
    decisionsReleasedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  rateLimits: defineTable({
    bucket: v.string(),
    key: v.string(),
    createdAt: v.number(),
  }).index("by_bucket_createdAt", ["bucket", "createdAt"]),

  resumeUploadSessions: defineTable({
    token: v.string(),
    createdAt: v.number(),
    storageId: v.optional(v.id("_storage")),
    verifiedAt: v.optional(v.number()),
    consumedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_storage", ["storageId"])
    .index("by_createdAt", ["createdAt"]),
});
