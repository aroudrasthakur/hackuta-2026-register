# Convex backend (`convex/`)

Server functions, schema, HTTP routes, and auth for HackUTA registration. Client refs: [src/convex/](../src/convex/README.md).

Generated Convex types and the server entry stub live in [_generated/](_generated/) — produced by `npx convex dev` or `npx convex deploy`, not edited by hand. Local typecheck uses a stub from [scripts/ensure-convex-server-stub.mjs](../scripts/ensure-convex-server-stub.mjs).

## Overview

| Path | Summary |
| --- | --- |
| [schema.ts](schema.ts) | Tables: applications, eventConfig, rateLimits, resume uploads, auth |
| [auth.ts](auth.ts) | Convex Auth — password, sign-up OTP, and password-reset OTP |
| [passwordReset.ts](passwordReset.ts) | Post-reset session invalidation mutation |
| [auth.config.ts](auth.config.ts) | Auth provider configuration |
| [http.ts](http.ts) | HTTP router — auth routes + POST /resume-upload |
| [applicant.ts](applicant.ts) | Application bootstrap and routing state |
| [eventConfig.ts](eventConfig.ts) | Server-side hackathon display name |
| [applications.ts](applications.ts) | Draft load/save and applicant dashboard |
| [registrations.ts](registrations.ts) | Application submission |
| [resumeUploads.ts](resumeUploads.ts) | Upload rate limits, sessions, discard, scheduled cleanup |
| [rateLimits.ts](rateLimits.ts) | Sign-up and password-reset OTP cooldowns; internal rate-limit mutations |
| [applicationFields.ts](applicationFields.ts) | Convex validators built from shared field registry |
| [resumeUploadSecurity.ts](resumeUploadSecurity.ts) | Resume upload origin allowlist |
| [pdfValidation.ts](pdfValidation.ts) | PDF magic-byte validation for uploads |
| [maintenance.ts](maintenance.ts) | Internal resetAllData (**destructive**) |
| [migrations.ts](migrations.ts) | One-time data migrations (including `migrateFirstHackathonToHackathonsAttended`, `migrateOtherDietaryToAllergyDetails`) |
| [crons.ts](crons.ts) | Scheduled resume-session cleanup |
| [lib/](lib/README.md) | Shared server helpers |
| [email/](email/README.md) | SMTP + transactional email actions |

### Module boundaries

- **auth.ts** — Configures HackutaPassword with sign-up OTP (`email-verification`) and password-reset OTP (`password-reset`) email providers.
- **applicant.ts** — Ensures a draft application exists after sign-in and exposes routing queries for guards. Does not load or save form field drafts.
- **applications.ts** — Draft autosave hydration, draft patches, and the profile-page dashboard query.
- **passwordReset.ts** — Clears all auth sessions after a successful password reset.

## Public API (client-facing)

| Function | Auth | Used by |
| --- | --- | --- |
| applicant:getApplicantRoutingState | Optional session | [useApplicantRouting](../src/hooks/useApplicantRouting.ts) |
| applicant:ensureApplicantApplication | Required | [SignInPage](../src/pages/SignIn/SignInPage.tsx) |
| applications:getMyApplicationDraft | Required | [ApplicationForm](../src/pages/Register/ApplicationForm.tsx) |
| applications:saveApplicationDraft | Required | [ApplicationForm](../src/pages/Register/ApplicationForm.tsx) |
| applications:getMyApplicantDashboard | Required | [ProfilePage](../src/pages/Profile/ProfilePage.tsx) |
| registrations:register | Required, verified email | [registerApi.ts](../src/pages/Register/registerApi.ts) |
| registrations:submitRegistration | Required, verified email | Alias of register |
| resumeUploads:discardUploadSession | Required; session must belong to caller | [registerApi.ts](../src/pages/Register/registerApi.ts) |
| rateLimits:getOtpSendCooldown | None | [SignInPage](../src/pages/SignIn/SignInPage.tsx) |
| rateLimits:getPasswordResetSendCooldown | None | [ForgotPasswordFlow](../src/pages/SignIn/ForgotPasswordFlow.tsx) |
| passwordReset:invalidateSessionsAfterPasswordReset | Required | [ForgotPasswordFlow](../src/pages/SignIn/ForgotPasswordFlow.tsx) |
HTTP: POST /resume-upload on the Convex site URL (JWT + origin allowlist). See [http.ts](http.ts) and [docs/API.md](../docs/API.md).

## Configuration and operations

| Topic | Location |
| --- | --- |
| Environment variables | [README — Environment variables](../README.md#environment-variables), [.env.example](../.env.example) |
| Backend unit tests | npm run test:unit — [convex.test.ts](../tests/unit/convex.test.ts), [resume-upload-security.test.ts](../tests/unit/resume-upload-security.test.ts) |
| Deployment verification | npm run convex:verify — [verify-convex-deployment.mjs](../scripts/verify-convex-deployment.mjs) |
| Resume session cleanup | Cron every 15 min — resumeUploads:cleanupExpiredUploadSessions in [crons.ts](crons.ts) |
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
