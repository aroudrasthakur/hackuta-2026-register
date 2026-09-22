# HackUTA 2026 Register — API Reference

Backend runs on [Convex](https://convex.dev). The frontend uses:

- **WebSocket client** — queries, mutations, actions at `VITE_CONVEX_URL` (`https://<deployment>.convex.cloud`)
- **HTTP actions** — resume upload and Auth OIDC at `VITE_CONVEX_SITE_URL` (`https://<deployment>.convex.site`)

Function names use Convex `module:function` notation (e.g. `registrations:register`).

**See also:** [SECURITY.md](SECURITY.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Authentication

Auth uses [@convex-dev/auth](https://labs.convex.dev/auth) with the **Password** provider plus **email OTP verification** on sign-up.

Password rules (client + server): min 8 characters, at least one uppercase, one lowercase, and one digit.

### Sign up / sign in (action)

**`auth:signIn`** via `@convex-dev/auth/react` `signIn("password", formData)`

| Step | FormData fields | Result |
| --- | --- | --- |
| Sign up | `email`, `password`, `flow=signUp` | Creates account; sends 6-digit verification email; `{ signingIn: false }` → OTP step |
| Verify email | `email`, `code`, `flow=email-verification` | `{ signingIn: true }`; establishes JWT session |
| Sign in | `email`, `password`, `flow=signIn` | `{ signingIn: true }` when email already verified |

OTP: 6 digits, 10-minute expiry, hashed at rest, never returned in responses. Resend cooldown **30 s**; max **5 sends/hour**; max **5 failed verifications/hour**.

### Sign out (action)

**`auth:signOut`** — `{}` — invalidates session.

### Session check (query)

**`auth:isAuthenticated`** — `{}` — returns whether the client has a valid JWT.

### HTTP — OIDC discovery

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/.well-known/openid-configuration` | OIDC discovery |
| `GET` | `/.well-known/jwks.json` | Public JWKS |

---

## Public queries

### `queries:getCurrentUser`

**Auth:** required · `{}` — user profile (id, email, displayName, `hasApplication`, …).

### `queries:getMyApplication`

**Auth:** required · `{ hackathonId?: string }` — profile row for the current user (default hackathon: `hackuta-2026`).

### `profiles:getMyProfileDraft`

**Auth:** required · `{ hackathonId?: string }` — draft profile fields for autosave hydration (null if none).

### `profiles:saveProfileDraft`

**Auth:** required · `{ hackathonId?: string, patch: ProfileDraftPatch }` — upserts draft profile; only writable while status is `draft`.

### `queries:getHackathonBySlug`

**Auth:** none · `{ slug: string }` — public hackathon metadata.

### `applicant:getApplicantRoutingState`

**Auth:** optional · `{ hackathonId?: string }` — routing for guards and `/` redirect.

### `applicant:getMyApplicantDashboard`

**Auth:** required · `{ hackathonId?: string }` — profile page payload (status, answers, timeline).

### `rateLimits:getOtpSendCooldown`

**Type:** mutation · **Auth:** none · `{ email: string }`

```typescript
{ waitSeconds: number; hourlyLimitReached: boolean }
```

Lookup attempts are rate-limited; invalid emails get a neutral response.

---

## Public mutations

### `registrations:register` / `registrations:submitRegistration`

**Auth:** required · Aliases sharing one handler.

```typescript
{
  data: RegistrationPayload;
  resumeUploadToken?: string;
}
```

Validates payload (Zod + sanitization), binds resume via token, sets status `submitted`, sends confirmation email. **Email in `data` is ignored** — server uses verified auth email.

First submit creates the applicant record; sign-in alone does not write application data.

**Common errors (thrown as mutation errors):**

| Message | Cause |
| --- | --- |
| `You have already submitted an application.` | Duplicate submit |
| `Please upload a valid PDF resume of 5 MB or smaller.` | Bad/missing resume metadata or token |
| `This resume is already attached to another application.` | Storage ID reuse |
| `Authentication required.` | Missing/invalid session |

### `registrations:deleteResumeUpload`

**Auth:** none (capability token) · `{ uploadToken: string }` — deletes unconsumed session + storage.

### `applicant:ensureApplicantProfile`

**Auth:** required · `{}` — ensures a draft `profiles` row exists after sign-in.

---

## HTTP routes

Base URL: `VITE_CONVEX_SITE_URL`

### `POST /resume-upload`

Upload a PDF resume before form submission.

**Auth:** browser origin allowlist (`REGISTRATION_ALLOWED_ORIGINS` + `SITE_URL`). No JWT.

**Request headers:**

| Header | Required | Value |
| --- | --- | --- |
| `Content-Type` | Yes | `application/pdf` |
| `Content-Length` | Yes | 1 – 5,242,880 (5 MB). Rejected **before** body read if missing or too large |
| `Origin` | Yes | Must match allowlist |
| `X-Resume-Filename` | Yes | Must end in `.pdf`; no `/` or `\` |

**Body:** raw PDF bytes

**Validation pipeline:**

1. Origin → Content-Type → Content-Length → filename allowlist
2. Rate limit (IP + global)
3. Read body; verify size matches header
4. PDF magic bytes (`%PDF-`)
5. `pdf-lib` structural parse; 1–25 pages
6. Store in Convex `_storage` (not web server disk)
7. Return capability token (30 min TTL, single-use at register)

**Success `201`:**

```json
{
  "storageId": "<convex-storage-id>",
  "uploadToken": "<64-char-hex>"
}
```

**Error responses:** JSON `{ "error": "<message>" }`

| Status | Condition |
| --- | --- |
| `400` | Invalid Content-Length format |
| `403` | Origin not allowed |
| `411` | Missing Content-Length |
| `413` | Empty, oversize, or length mismatch |
| `415` | Wrong Content-Type or filename |
| `422` | Invalid PDF or too many pages |
| `429` | Rate limit exceeded |
| `500` | Storage failure |

Client maps these to friendly copy via `shared/registration/submitErrors.ts`.

**Rate limits:** 5 uploads / IP / 10 min · 100 global / 10 min.

### `OPTIONS /resume-upload`

CORS preflight. Allowed headers: `Content-Type`, `X-Resume-Filename`.

---

## Error responses

### HTTP actions

All error bodies:

```json
{ "error": "Human-readable message" }
```

Responses include `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.

### Mutations and actions

Convex throws `Error` with a string message. The client maps known messages through `mapConvexErrorToUserMessage()` / `mapUploadError()`; unknown errors become generic copy.

### Registration field validation

Client-side Zod errors return per-field messages from `shared/registration/schema.ts`. Server-side validation failures on `register` return a generic failure (no field breakdown) to avoid leaking validation internals to API callers.

---

## Validation reference

| Input | Module | Rules (summary) |
| --- | --- | --- |
| Registration | `shared/registration/schema.ts` | Strict Zod; enums for MLH fields; phone/URL formats; HTML/script rejected |
| Registration server | `shared/registration/validation.ts` | `validateRegistrationPayload()` |
| Sanitization | `shared/lib/sanitizeInput.ts` | Control chars stripped; markup patterns rejected |
| Password | `shared/auth/password.ts` | Length, upper/lower/digit |
| Resume (client) | `shared/registration/resume.ts` | `.pdf` only, ≤ 5 MB |
| Resume (server) | `convex/pdfValidation.ts` | Magic bytes, parse, ≤ 25 pages |

Full field list: `shared/registration/schema.ts` and `shared/registration/constants.ts`.

---

## Internal functions

Not callable from the public client.

### Rate limiting (`rateLimits`)

| Function | Purpose |
| --- | --- |
| `assertOtpSendAllowed` | OTP cooldown / hourly cap |
| `recordOtpSend` | Bucket `otp_send` |
| `clearOtpSendLimitsForEmail` | Support/testing reset |
### Resume pipeline (`registrations`)

| Function | Purpose |
| --- | --- |
| `reserveResumeUpload` | Pre-storage rate limit |
| `recordVerifiedResumeUpload` | Create upload session |
| `cleanupExpiredResumeUploads` | Cron + scheduled cleanup |

### Email (Node actions)

| Function | Purpose |
| --- | --- |
| `email/sendOtpEmail:sendOtpEmail` | OTP / verification mail |
| `email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail` | Post-submit confirmation |

User content in HTML emails is escaped via `escapeHtml()`.

### Admin / seed

| Function | Purpose |
| --- | --- |
| `admin:resetAllData` | Wipe all data + storage |
| `seed:seedHackathon` | Insert `hackuta-2026` if missing |

---

## Admin queries

### `queries:getApplicationsByHackathon`

**Auth:** admin — `tokenIdentifier` in `REGISTRATION_ADMIN_IDENTITY_KEYS`.

`{ hackathonId: string }` — lists submitted profiles for a hackathon.

---

## Rate limits summary

| Bucket | Key | Limit | Window |
| --- | --- | --- | --- |
| `otp_send` | normalized email | 5 sends | 1 hour |
| `otp_send` | normalized email | 30 s cooldown | between sends |
| `resume_upload` | client IP hash | 5 uploads | 10 minutes |
| `resume_upload` | global | 100 uploads | 10 minutes |

---

## Data model

Schema: `convex/schema.ts` · Field validators: `convex/profileFields.ts`.

### `users`

Convex Auth identity only (email, verification timestamps). Password hashes live in auth tables managed by `@convex-dev/auth`.

### `profiles`

One row per auth user per hackathon. All application form fields are top-level columns.

| Field | Notes |
| --- | --- |
| `authUserId` | FK to `users` |
| `hackathonId` | `"hackuta-2026"` |
| `email` | Copied from verified auth email |
| `status` | `draft` \| `submitted` \| `accepted` \| `waitlisted` \| `rejected` \| `withdrawn` |
| `eligibilityStatus` | `unreviewed` \| `eligible` \| `ineligible` |
| `resumeStorageId` | PDF in `_storage` |
| Applicant fields | See `shared/registration/schema.ts` and `convex/profileFields.ts` |

### Other tables

| Table | Purpose |
| --- | --- |
| `hackathons` | Event dates and registration window |
| `rateLimits` | Throttle counters |
| `resumeUploadSessions` | Upload capability tokens |
| Auth tables | Managed by `@convex-dev/auth` |

---

## Scheduled jobs

| Schedule | Function |
| --- | --- |
| Every 15 minutes | `registrations:cleanupExpiredResumeUploads` |

---

## Frontend → API map

| UI | API |
| --- | --- |
| Sign-in / sign-up | `auth:signIn`, `auth:signOut` |
| OTP cooldown | `rateLimits:getOtpSendCooldown` |
| Ensure profile | `applicant:ensureApplicantProfile` |
| Route guards | `applicant:getApplicantRoutingState` |
| Applicant dashboard | `profiles:getMyApplicantDashboard` |
| Draft autosave | `profiles:getMyProfileDraft`, `profiles:saveProfileDraft` |
| Resume widget | `POST /resume-upload` |
| Submit form | `registrations:register` |
| Discard resume | `registrations:deleteResumeUpload` |

---

## Response headers (frontend)

Production SPA headers from `vercel.json` (source of truth: `security/csp.ts`, `security/headers.ts`):

- `Content-Security-Policy` — strict allowlist; Convex in `connect-src`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `Permissions-Policy`
- `Referrer-Policy`
- `X-Robots-Tag: noindex`

Tests: `tests/unit/security.test.ts`.
