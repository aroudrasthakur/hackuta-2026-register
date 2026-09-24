# Convex lib (`convex/lib/`)

Shared helpers imported by Convex modules (not deployed as standalone functions).

## Overview

| File | Summary |
| --- | --- |
| [auth.ts](auth.ts) | Auth user lookup, verified-user and identity requirements |
| [profiles.ts](profiles.ts) | Profile CRUD helpers, answer projection, draft ensure |
| [resumeUpload.ts](resumeUpload.ts) | Upload session TTL and validation helpers |
| [draftPatch.ts](draftPatch.ts) | Merge/replace profile fields from client draft snapshots |
| [normalizeEmail.ts](normalizeEmail.ts) | Email normalization for storage and rate limits |
| [otpSendStatus.ts](otpSendStatus.ts) | OTP cooldown lookup shared by rateLimits.ts (bucket parameter) |
| [rateLimitBuckets.ts](rateLimitBuckets.ts) | Rate-limit bucket name constants |
| [hackutaPassword.ts](hackutaPassword.ts) | Password provider (extends @convex-dev/auth) with reset reuse check |
| [assertPasswordNotReused.ts](assertPasswordNotReused.ts) | Rejects password reset when new password matches current hash |
| [invalidateAuthSessions.ts](invalidateAuthSessions.ts) | Deletes all authSessions and authRefreshTokens for a user |

## Related

| Location | Role |
| --- | --- |
| [../README.md](../README.md) | Convex backend index |

Parent index: [../README.md](../README.md).
