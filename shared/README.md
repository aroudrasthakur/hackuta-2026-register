# Shared code (`shared/`)

Isomorphic TypeScript imported by the React client and Convex backend. Keeps validation, enums, and error copy in one place.

## Overview

| Path | Summary |
| --- | --- |
| [registration/](registration/) | Application form schema, types, draft mapping, resume policy, submit errors |
| [auth/](auth/) | Password rules and OTP rate-limit helpers |
| [hackathon/](hackathon/) | Canonical schedule dates and timeline builders |
| [lib/](lib/) | Email normalization and input sanitization |

## Registration (`registration/`)

| File | Summary |
| --- | --- |
| [applicantFields.ts](registration/applicantFields.ts) | Field registry — names, draft kinds, trimmed vs plain columns |
| [schema.ts](registration/schema.ts) | Zod schema for the full application payload |
| [validation.ts](registration/validation.ts) | Server entry validateRegistrationPayload() |
| [types.ts](registration/types.ts) | Form state types and initial empty form |
| [constants.ts](registration/constants.ts) | MLH enums, `APPLICATION_QUESTIONS` labels, `FIELD_LIMITS`, graduation year and hackathons-attended bounds |
| [draftPatch.ts](registration/draftPatch.ts) | Draft patch shape and cleared-value sentinel |
| [draftMapping.ts](registration/draftMapping.ts) | Profile row ↔ autosave form mapping |
| [resume.ts](registration/resume.ts) | Client resume validation, upload headers, size limits |
| [submitErrors.ts](registration/submitErrors.ts) | User-facing error mapping for Convex and HTTP upload |
| [countries.ts](registration/countries.ts) | Generated country list (United States first) |
| [mlhSchools.ts](registration/mlhSchools.ts) | Generated MLH school list |
| [mlhTexasSchools.ts](registration/mlhTexasSchools.ts) | Texas schools surfaced first in the school picker |
| [data/schools.csv](registration/data/schools.csv) | Source CSV for generate-mlh-schools.mjs |

Convex application validators in [convex/applicationFields.ts](../convex/applicationFields.ts) derive from [applicantFields.ts](registration/applicantFields.ts).

### Application question fields

| Field | Registry group | Notes |
| --- | --- | --- |
| `builtOrWantToBuild` | `TRIMMED_STRING_FIELDS` | Mandatory multiline; trimmed on draft save |
| `shortDeadlineLearning` | `TRIMMED_STRING_FIELDS` | Mandatory multiline; trimmed on draft save |
| `hackathonsAttended` | `OPTIONAL_INT_FIELDS` | Mandatory on submit; stored as integer 0–100 |
| `experienceLevel` | `PLAIN_STRING_FIELDS` | Mandatory select; Beginner through Expert |
| `allergyDetails` | `TRIMMED_STRING_FIELDS` | Required when dietary Allergies is checked; up to 500 characters |
| `otherDietaryRestrictions` | `TRIMMED_STRING_FIELDS` | Optional free-text dietary notes |

Draft hydration maps legacy `firstHackathon: true` → `"0"` and `false` → `"1"` when `hackathonsAttended` is absent, and legacy `otherDietary` → `allergyDetails` when needed ([draftMapping.ts](registration/draftMapping.ts)).

## Auth (`auth/`)

| File | Summary |
| --- | --- |
| [password.ts](auth/password.ts) | Password strength rules (client + server) |
| [otpRateLimit.ts](auth/otpRateLimit.ts) | OTP send cooldown math shared with Convex |
| [passwordResetMessages.ts](auth/passwordResetMessages.ts) | Forgot-password user-facing copy (neutral request, success, reuse, rate limits) |
| [errorMessages.ts](auth/errorMessages.ts) | mapAuthError and mapPasswordResetError — safe sign-in and reset error copy |

## Hackathon (`hackathon/`)

| File | Summary |
| --- | --- |
| [schedule.ts](hackathon/schedule.ts) | Registration window and event timestamps |
| [timeline.ts](hackathon/timeline.ts) | Applicant-facing timeline labels from schedule |

Default schedule in `HACKATHON_SCHEDULE`: applications open **2026-09-25**, applications close **TBA** (`registrationClosesAt: null`), hackathon **2026-11-14 → 2026-11-15**. Timeline shows four milestones (open, close, decisions, event start); null timestamps render as “To be announced”. No RSVP milestone.

Schedule dates used by applications:getMyApplicantDashboard. Display name lives in the `eventConfig` table ([convex/eventConfig.ts](../convex/eventConfig.ts)).

## Lib (`lib/`)

| File | Summary |
| --- | --- |
| [sanitizeInput.ts](lib/sanitizeInput.ts) | Strip control chars; reject HTML/script patterns in Zod transforms |
| [normalizeEmail.ts](lib/normalizeEmail.ts) | Lowercase + trim for storage and rate-limit keys |

Convex re-exports email normalization from [convex/lib/normalizeEmail.ts](../convex/lib/normalizeEmail.ts) for server-only imports.

## Maintenance

| Task | Command |
| --- | --- |
| Refresh countries | node scripts/generate-countries.mjs |
| Refresh MLH schools | node scripts/generate-mlh-schools.mjs |

## Related

| Location | Role |
| --- | --- |
| [convex/README.md](../convex/README.md) | Server functions that consume shared validation |
| [src/pages/Register/](src/pages/Register/) | Primary client consumer of registration modules |
| [docs/API.md](../docs/API.md) | Validation reference |

Parent index: [README.md](../README.md).
