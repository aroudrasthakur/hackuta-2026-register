# HackUTA 2026 Register — API Reference

Backend runs on [Convex](https://convex.dev). The frontend uses:

- **WebSocket client** — queries, mutations, actions at `VITE_CONVEX_URL` (`https://<deployment>.convex.cloud`)
- **HTTP actions** — resume upload and Auth OIDC at `VITE_CONVEX_SITE_URL` (`https://<deployment>.convex.site`)

Function names use Convex `module:function` notation (e.g. `registrations:submitRegistration`).

**See also:** [SECURITY.md](SECURITY.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Authentication

Auth uses [@convex-dev/auth](https://labs.convex.dev/auth) with the **Password** provider (via [HackutaPassword](../convex/lib/hackutaPassword.ts)) plus **email OTP verification** on sign-up and **email OTP password reset**.

Password rules (client + server): min 8 characters, at least one uppercase, one lowercase, and one digit. Password reset rejects a new password that matches the current password.

### Sign up / sign in (action)

**`auth:signIn`** via `@convex-dev/auth/react` `signIn("password", formData)`

| Step | FormData fields | Result |
| --- | --- | --- |
| Sign up | `email`, `password`, `flow=signUp` | Creates account; sends 6-digit verification email; `{ signingIn: false }` → OTP step |
| Verify email | `email`, `code`, `flow=email-verification` | `{ signingIn: true }`; establishes JWT session |
| Sign in | `email`, `password`, `flow=signIn` | `{ signingIn: true }` when email already verified |

Sign-up OTP provider: `email-verification`. Resend cooldown **30 s**; max **5 sends/hour** (bucket `otp_send`); max **5 failed verifications/hour** (Convex Auth `authRateLimits`).

### Forgot password (action)

| Step | FormData fields | Result |
| --- | --- | --- |
| Request reset | `email`, `flow=reset` | Returns `{ tokens: null }` for registered and unregistered emails; client shows the same code-entry screen and neutral confirmation; sends email only when an account exists |
| Reset password | `email`, `code`, `newPassword`, `flow=reset-verification` | Verifies reset OTP, updates password hash, invalidates other sessions; client signs out and returns to sign-in |

Reset OTP provider: `password-reset` (separate from sign-up verification). Request cooldown **30 s**; max **5 accepted requests/hour** (bucket `password_reset_send`). The limit is checked and recorded atomically before account lookup for every normalized email, including unregistered addresses. Missing accounts create no auth or verification state and receive no email; only the rate-limit request is recorded. Operational failures still reject. Sign-up OTPs cannot authorize password reset.

Reset codes: 6 digits, 10-minute expiry, hashed at rest, single-use. Password reuse is checked only after the code is verified, so an invalid code cannot reveal whether a password guess matches. A valid code is consumed if the proposed password is reused; the user must request a new reset code to try again.

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

### `applications:getMyApplicationDraft`

**Auth:** required · no args — draft application fields for autosave hydration (null if none).

### `applications:saveApplicationDraft`

**Auth:** required · `{ patch: ApplicationDraftPatch }` — upserts draft application; only writable while status is `draft`.

### `applications:getMyApplicantDashboard`

**Auth:** required · no args — profile page payload (status, answers, timeline).

### `eventConfig:getPublicEventConfig`

**Auth:** none · no args — public hackathon display name for the registration UI.

### `applicant:getApplicantRoutingState`

**Auth:** optional · no args — routing for guards and `/` redirect.

### `rateLimits:getOtpSendCooldown`

**Type:** mutation · **Auth:** none · `{ email: string }`

```typescript
{ waitSeconds: number; hourlyLimitReached: boolean }
```

Lookup attempts are rate-limited; invalid emails get a neutral response.

### `rateLimits:getPasswordResetSendCooldown`

**Type:** mutation · **Auth:** none · `{ email: string }`

Same response shape as `getOtpSendCooldown`. Tracks accepted requests for all addresses in the `password_reset_send` bucket separately from sign-up OTP sends, so requesting a reset for an unregistered email produces the same cooldown.

---

## Public mutations

### `registrations:submitRegistration`

**Auth:** required

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
| `Please upload a valid PDF resume of 2 MB or smaller.` | Bad/missing resume metadata or token |
| `Your resume exceeds the 2 MB limit. Please upload a smaller PDF.` | Resume exceeds size limit |
| `This resume is already attached to another application.` | Storage ID reuse |
| `Authentication required.` | Missing/invalid session |

### `resumeUploads:discardUploadSession`

**Auth:** required · `{ uploadToken: string }` — deletes an unconsumed session owned by the caller and its storage.

### `applicant:ensureApplicantApplication`

**Auth:** required · `{}` — ensures a draft `applications` row exists after sign-in.

### `passwordReset:invalidateSessionsAfterPasswordReset`

**Auth:** required · `{}` — deletes all `authSessions` and linked `authRefreshTokens` for the current user. Called after a successful `reset-verification` sign-in so the user must sign in again with the new password.

---

## HTTP routes

Base URL: `VITE_CONVEX_SITE_URL`

### `POST /resume-upload`

Upload a PDF resume before form submission.

**Auth:** JWT session (`Authorization: Bearer <token>`) **and** browser origin allowlist (`REGISTRATION_ALLOWED_ORIGINS` + `SITE_URL`).

**Request headers:**

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <convex-auth-jwt>` |
| `Content-Type` | Yes | `application/pdf` |
| `Content-Length` | Yes | 1 – 2,097,152 (2 MB). Rejected **before** body read if missing or too large |
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
| `401` | Missing or invalid auth session |
| `403` | Origin not allowed |
| `411` | Missing Content-Length |
| `413` | Empty, oversize, or length mismatch |
| `415` | Wrong Content-Type or filename |
| `422` | Invalid PDF or too many pages |
| `429` | Rate limit exceeded |
| `500` | Storage failure |

Client maps these to friendly copy via `shared/registration/submitErrors.ts`.

**Rate limits:** 5 uploads / IP / 10 min · 5 uploads / authenticated user / 10 min · 100 global / 10 min.

### `OPTIONS /resume-upload`

CORS preflight. Allowed headers: `Content-Type`, `Authorization`, `X-Resume-Filename`.

---

## Error responses

### HTTP actions

All error bodies:

```json
{ "error": "Human-readable message" }
```

Responses include `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.

### Mutations and actions

Convex throws `Error` with a string message. The client maps known messages through `mapConvexErrorToUserMessage()` / `mapUploadError()` / `mapAuthError()` / `mapPasswordResetError()`; unknown errors become generic copy.

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
| Password reset copy | `shared/auth/passwordResetMessages.ts` | Neutral request confirmation, success, reuse, and rate-limit messages |
| Auth error mapping | `shared/auth/errorMessages.ts` | mapAuthError, mapPasswordResetError |
| Resume (client) | `shared/registration/resume.ts` | `.pdf` only, ≤ 2 MB |
| Resume (server) | `convex/pdfValidation.ts` | Magic bytes, parse, ≤ 25 pages |

Full field list: `shared/registration/schema.ts` and `shared/registration/constants.ts`.

---

## Internal functions

Not callable from the public client.

### Rate limiting (`rateLimits`)

| Function | Purpose |
| --- | --- |
| `assertOtpSendAllowed` | Sign-up OTP cooldown / hourly cap |
| `recordOtpSend` | Bucket `otp_send` |
| `consumePasswordResetRequest` | Atomically checks the reset cooldown / hourly cap and records an accepted request in `password_reset_send` before account lookup |
| `clearOtpSendLimitsForEmail` | Support/testing reset |
### Resume pipeline (`resumeUploads`)

| Function | Purpose |
| --- | --- |
| `assertUploadRateLimit` | Pre-storage rate limit |
| `createVerifiedUploadSession` | Create upload session |
| `cleanupExpiredUploadSessions` | Cron + scheduled cleanup |

### Email (Node actions)

| Function | Purpose |
| --- | --- |
| `email/sendOtpEmail:sendOtpEmail` | Sign-up verification mail |
| `email/sendPasswordResetEmail:sendPasswordResetEmail` | Password reset mail |
| `email/sendApplicationConfirmationEmail:sendApplicationConfirmationEmail` | Post-submit confirmation |
| `email/checkEmailStatus:checkEmailStatus` | Operator tool — `GET /email-status` for a tracked `serviceId` |

All three emails are queued with the HackUTA email service (`POST /send-email`) using the plain-text template, since the service delivers `body` as plain text. HTML templates (with user content escaped via `escapeHtml()`) are kept for future HTML support.

### Email tracking (`emailDeliveries`)

| Function | Purpose |
| --- | --- |
| `recordEmailDelivery` | Store the service's queue ID, email kind, normalized recipient, and time (no content or codes) |
| `listEmailDeliveriesForRecipient` | Support lookup — latest 20 deliveries for an address, newest first |

### Maintenance

| Function | Purpose |
| --- | --- |
| `maintenance:resetAllData` | Internal — wipe all data + storage |

---

## Rate limits summary

| Bucket | Key | Limit | Window |
| --- | --- | --- | --- |
| `otp_send` | normalized email | 5 sends | 1 hour |
| `otp_send` | normalized email | 30 s cooldown | between sends |
| `password_reset_send` | normalized email | 5 accepted requests | 1 hour |
| `password_reset_send` | normalized email | 30 s cooldown | between accepted requests |
| `resume_upload` | client IP hash | 5 uploads | 10 minutes |
| `resume_upload` | global | 100 uploads | 10 minutes |

---

## Data model

Schema: `convex/schema.ts` · Field validators: `convex/applicationFields.ts`.

### `users`

Convex Auth identity only (email, verification timestamps). Password hashes live in auth tables managed by `@convex-dev/auth`.

### `applications`

One row per auth user. All application form fields are top-level columns.

| Field | Notes |
| --- | --- |
| `authUserId` | FK to `users` |
| `email` | Copied from verified auth email |
| `status` | `draft` \| `submitted` \| `accepted` \| `waitlisted` \| `rejected` \| `withdrawn` |
| `resumeStorageId` | PDF in `_storage` |
| Applicant fields | See `shared/registration/schema.ts` and `convex/applicationFields.ts` |
| `builtOrWantToBuild`, `shortDeadlineLearning` | Required multiline answers (max 2,000 chars each) |
| `hackathonsAttended` | Required integer 0–100; replaces legacy boolean `firstHackathon` |

### Other tables

| Table | Purpose |
| --- | --- |
| `eventConfig` | Server-side hackathon display name (single row) |
| `rateLimits` | Throttle counters |
| `resumeUploadSessions` | Upload capability tokens |
| Auth tables | Managed by `@convex-dev/auth` |

---

## Scheduled jobs

| Schedule | Function |
| --- | --- |
| Every 15 minutes | `resumeUploads:cleanupExpiredUploadSessions` |

---

## Frontend → API map

| UI | API |
| --- | --- |
| Sign-in / sign-up | `auth:signIn`, `auth:signOut` |
| Forgot password | `auth:signIn` (`flow=reset`, `flow=reset-verification`), `passwordReset:invalidateSessionsAfterPasswordReset` |
| OTP cooldown | `rateLimits:getOtpSendCooldown`, `rateLimits:getPasswordResetSendCooldown` |
| Ensure application | `applicant:ensureApplicantApplication` |
| Route guards | `applicant:getApplicantRoutingState` |
| Applicant dashboard | `applications:getMyApplicantDashboard` |
| Draft autosave | `applications:getMyApplicationDraft`, `applications:saveApplicationDraft` |
| Resume widget | `POST /resume-upload` |
| Submit form | `registrations:submitRegistration` |
| Discard resume | `resumeUploads:discardUploadSession` |

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
