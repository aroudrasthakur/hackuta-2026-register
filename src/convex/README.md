# Convex client (`src/convex/`)

Browser-side Convex wiring. Server functions live in [convex/](../../convex/README.md).

## Overview

| File | Summary |
| --- | --- |
| [client.ts](client.ts) | ConvexReactClient from VITE_CONVEX_URL |
| [api.ts](api.ts) | Typed function refs for queries/mutations used by the React app |

## Function references (`api.ts`)

| Reference | Handler |
| --- | --- |
| getApplicantRoutingStateRef | applicant:getApplicantRoutingState |
| getMyApplicantDashboardRef | profiles:getMyApplicantDashboard |
| getMyProfileDraftRef | profiles:getMyProfileDraft |
| saveProfileDraftRef | profiles:saveProfileDraft |
| ensureApplicantProfileRef | applicant:ensureApplicantProfile |
| getOtpSendCooldownRef | rateLimits:getOtpSendCooldown |
| getPasswordResetSendCooldownRef | rateLimits:getPasswordResetSendCooldown |
| invalidateSessionsAfterPasswordResetRef | passwordReset:invalidateSessionsAfterPasswordReset |

[registerApi.ts](../pages/Register/registerApi.ts) defines refs for registrations:register and resumeUploads:discardUploadSession.

## Related

| Location | Role |
| --- | --- |
| [convex/README.md](../../convex/README.md) | Server-side modules and public API |
| [pages/Register/registerApi.ts](../pages/Register/registerApi.ts) | Submit and resume upload client |
| [pages/SignIn/](../pages/SignIn/) | Sign-in and forgot-password flows |

Parent index: [../README.md](../README.md).
