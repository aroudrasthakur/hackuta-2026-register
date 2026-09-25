# Convex server helpers (`convex/lib/`)

Shared logic imported by top-level Convex modules. Not exported to the client directly.

| File | Role |
| --- | --- |
| [dataModel.ts](dataModel.ts) | Typed QueryCtx/MutationCtx and document aliases (works around Convex Auth optional-field typing) |
| [auth.ts](auth.ts) | requireAuthUserId, getAuthUser, verified-user guards |
| [applications.ts](applications.ts) | Application CRUD helpers, answer projection, draft ensure |
| [draftPatch.ts](draftPatch.ts) | Applies autosave patches to application rows |
| [emailDeliveries.ts](emailDeliveries.ts) | Email kind validator shared by the schema and email tracking |
| [eventConfig.ts](eventConfig.ts) | Hackathon name seed/read |
| [hackutaPassword.ts](hackutaPassword.ts) | Custom Password provider with reset reuse check |
| [assertPasswordNotReused.ts](assertPasswordNotReused.ts) | Blocks password reset when new password matches current hash |
| [invalidateAuthSessions.ts](invalidateAuthSessions.ts) | Deletes all authSessions and authRefreshTokens for a user |
| [normalizeEmail.ts](normalizeEmail.ts) | Email normalization for auth and applications |
| [otpSendStatus.ts](otpSendStatus.ts) | OTP cooldown/hourly-limit lookup helpers |
| [rateLimitBuckets.ts](rateLimitBuckets.ts) | Bucket name constants |
| [resumeUpload.ts](resumeUpload.ts) | Upload session lookup and ownership checks |

Parent index: [convex/README.md](../README.md).
