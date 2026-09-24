# Convex backend (`convex/`)

Server functions, schema, HTTP routes, and auth for HackUTA registration. Client refs: [src/convex/](../src/convex/README.md).

Generated Convex types and the server entry stub live in [_generated/](_generated/) — produced by `npx convex dev` or `npx convex deploy`, not edited by hand. Local typecheck uses a stub from [scripts/ensure-convex-server-stub.mjs](../scripts/ensure-convex-server-stub.mjs).

## Overview

| Path | Summary |
| --- | --- |
| [schema.ts](schema.ts) | Tables: profiles, hackathons, rateLimits, resume uploads, auth |
| [auth.ts](auth.ts) | Convex Auth — password + email OTP verification |
| [auth.config.ts](auth.config.ts) | Auth provider configuration |
| [http.ts](http.ts) | HTTP router — auth routes + POST /resume-upload |
| [applicant.ts](applicant.ts) | Profile bootstrap and routing state |
| [profiles.ts](profiles.ts) | Draft load/save and applicant dashboard |
| [registrations.ts](registrations.ts) | Application submission |
| [resumeUploads.ts](resumeUploads.ts) | Upload rate limits, sessions, discard, scheduled cleanup |
| [hackathons.ts](hackathons.ts) | Hackathon seed/sync helpers and getHackathonBySlug |
| [rateLimits.ts](rateLimits.ts) | OTP send cooldown and internal rate-limit mutations |
| [profileFields.ts](profileFields.ts) | Convex validators built from shared field registry |
| [resumeUploadSecurity.ts](resumeUploadSecurity.ts) | Resume upload origin allowlist |
| [pdfValidation.ts](pdfValidation.ts) | PDF magic-byte validation for uploads |
| [seed.ts](seed.ts) | Internal seedHackathon mutation |
| [maintenance.ts](maintenance.ts) | Internal resetAllData (**destructive**) |
| [crons.ts](crons.ts) | Scheduled resume-session cleanup |
| [lib/](lib/README.md) | Shared server helpers |
| [email/](email/README.md) | SMTP + transactional email actions |

### Module boundaries

- **applicant.ts** — Ensures a draft profile exists after sign-in and exposes routing queries for guards. Does not load or save form field drafts.
- **profiles.ts** — Draft autosave hydration, draft patches, and the profile-page dashboard query.

## Public API (client-facing)

| Function | Auth | Used by |
| --- | --- | --- |
| applicant:getApplicantRoutingState | Optional session | [useApplicantRouting](../src/hooks/useApplicantRouting.ts) |
| applicant:ensureApplicantProfile | Required | [SignInPage](../src/pages/SignIn/SignInPage.tsx) |
| profiles:getMyProfileDraft | Required | [ApplicationForm](../src/pages/Register/ApplicationForm.tsx) |
| profiles:saveProfileDraft | Required | [ApplicationForm](../src/pages/Register/ApplicationForm.tsx) |
| profiles:getMyApplicantDashboard | Required | [ProfilePage](../src/pages/Profile/ProfilePage.tsx) |
| registrations:register | Required, verified email | [registerApi.ts](../src/pages/Register/registerApi.ts) |
| registrations:submitRegistration | Required, verified email | Alias of register |
| resumeUploads:discardUploadSession | Capability token only | [registerApi.ts](../src/pages/Register/registerApi.ts) |
| rateLimits:getOtpSendCooldown | None | [SignInPage](../src/pages/SignIn/SignInPage.tsx) |
| hackathons:getHackathonBySlug | None | [verify-convex-deployment.mjs](../scripts/verify-convex-deployment.mjs) |

HTTP: POST /resume-upload on the Convex site URL (origin allowlist, no JWT). See [http.ts](http.ts) and [docs/API.md](../docs/API.md).

## Configuration and operations

| Topic | Location |
| --- | --- |
| Environment variables | [README — Environment variables](../README.md#environment-variables), [.env.example](../.env.example) |
| Backend unit tests | npm run test:unit — [convex.test.ts](../tests/unit/convex.test.ts), [resume-upload-security.test.ts](../tests/unit/resume-upload-security.test.ts) |
| Deployment verification | npm run convex:verify — [verify-convex-deployment.mjs](../scripts/verify-convex-deployment.mjs) |
| Resume session cleanup | Cron every 15 min — resumeUploads:cleanupExpiredUploadSessions in [crons.ts](crons.ts) |
| Seed hackathon | npx convex run seed:seedHackathon |
| Wipe deployment (**destructive**) | Convex dashboard → internal maintenance:resetAllData |

See [docs/OPERATIONS.md](../docs/OPERATIONS.md) and [docs/API.md](../docs/API.md).

## Related

| Location | Role |
| --- | --- |
| [shared/README.md](../shared/README.md) | Validation, field registry, auth helpers |
| [scripts/README.md](../scripts/README.md) | Codegen stub and deployment verification |
| [tests/README.md](../tests/README.md) | Backend unit test map |
| [docs/SECURITY.md](../docs/SECURITY.md) | Threat model and upload hardening |

Parent index: [README.md](../README.md).
