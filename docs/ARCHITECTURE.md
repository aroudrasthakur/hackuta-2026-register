# Architecture

High-level structure of the register codebase.

## System context

```
hackuta.com (marketing) ──link──► register.hackuta.com (this app)
                                        │
                                        ├── Vite/React SPA (Vercel)
                                        └── Convex (DB, auth, HTTP, storage, cron)

hackuta-2026-registration (legacy repo) ──contact form only (separate deployment)
```

Related repo: marketing site ([hackuta-2026-repository](https://github.com/aroudrasthakur/hackuta-2026-repository)).

## Repository layout

| Path | README | Role |
| --- | --- | --- |
| convex/ | [convex/README.md](../convex/README.md) | Backend — mutations, actions, HTTP, cron |
| src/ | [src/README.md](../src/README.md) | React SPA |
| shared/ | [shared/README.md](../shared/README.md) | Isomorphic validation and constants |
| public/ | [public/README.md](../public/README.md) | Static fonts, images, trusted-types |
| security/ | [security/README.md](../security/README.md) | CSP + response headers (sync with vercel.json) |
| scripts/ | [scripts/README.md](../scripts/README.md) | Codegen stub, deploy verify, data generators |
| tests/ | [tests/README.md](../tests/README.md) | Vitest unit + Playwright e2e |
| docs/ | [docs/README.md](README.md) | This documentation set |

### Convex (summary)

| Module | Role |
| --- | --- |
| auth.ts | @convex-dev/auth Password + sign-up OTP + password-reset OTP |
| passwordReset.ts | Session invalidation after password reset |
| applicant.ts | Application bootstrap and routing state |
| applications.ts | Draft save/load and applicant dashboard |
| registrations.ts | Application submission |
| resumeUploads.ts | Upload sessions, rate limits, cleanup |
| http.ts | Resume upload + Auth OIDC routes |
| rateLimits.ts | Sign-up and password-reset OTP throttling |
| resumeUploadSecurity.ts | Upload origin allowlist |
| pdfValidation.ts | Server-side PDF parse |
| emailDeliveries.ts | Queue-ID tracking for sent emails |
| email/ | Email service client, email actions, templates |
| lib/ | Auth, applications, draft patch helpers |

## Request flows

### Sign up / sign in

```
/sign-in → Password provider (email + password)
         → email-verification OTP (6 digits via the HackUTA email service)
         → JWT session
         → ensureApplicantApplication
         → route to /register or /profile
```

Sign-in mode skips OTP when the account is already verified.

### Forgot password

```
/sign-in → Forgot password?
         → auth:signIn flow=reset (6-digit email via password-reset provider)
         → enter OTP + new password
         → auth:signIn flow=reset-verification
         → passwordReset:invalidateSessionsAfterPasswordReset + auth:signOut
         → return to sign-in with success message
```

Reset code requests use neutral copy (no account enumeration). Sign-up OTPs and reset OTPs use separate providers and rate-limit buckets. New passwords must differ from the current password ([assertPasswordNotReused](../convex/lib/assertPasswordNotReused.ts)); the hash comparison happens only after a valid reset OTP, without attempting a password sign-in. A reused password consumes the OTP and the newly created reset session is invalidated; the user must request another code.

### Application draft

```
/register form → applications:saveApplicationDraft (debounced ~800ms)
              → applications:getMyApplicationDraft on load (hydrate fields)
```

Draft rows use `status: "draft"`. Users can leave and resume until submit. Autosave sends a full form snapshot (including application questions and `hackathonsAttended`) except resume blob fields, which update only on explicit upload/remove.

### Application submit

```
/register form → client Zod validate
              → POST /resume-upload (optional PDF)
              → registrations:register { data, resumeUploadToken }
              → application status → submitted
              → confirmation email (internal action)
```

Email in `data` is ignored; server uses verified auth email.

### Resume discard

```
/register widget → resumeUploads:discardUploadSession { uploadToken }
                 → removes unconsumed session + orphaned storage
```

## Data model

Auth lives on `users` (Convex Auth). Application data lives in **applications** — one row per auth user.

| Table | Purpose |
| --- | --- |
| users | Convex Auth identity (email, verification time) |
| applications | Form fields as columns + status, draft/submitted timestamps |
| rateLimits | Sliding-window counters (OTP, upload) |
| resumeUploadSessions | Capability tokens linking upload → registration |
| _storage | Resume PDF blobs |
| Auth tables | Sessions, verification codes (@convex-dev/auth) |

Schema: [convex/schema.ts](../convex/schema.ts). Field validators: [convex/applicationFields.ts](../convex/applicationFields.ts).

## Shared validation pattern

Client and server import the same modules under [shared/](../shared/README.md):

- **Registration:** `registrationPayloadSchema` in `schema.ts`; server entry `validateRegistrationPayload()` in `validation.ts`
- **Password:** `validatePasswordRequirements()` in `shared/auth/password.ts`
- **Auth errors:** `mapAuthError()` / `mapPasswordResetError()` in `shared/auth/errorMessages.ts`
- **Sanitization:** `shared/lib/sanitizeInput.ts` inside Zod transforms

Client validation gives immediate field feedback; server validation is authoritative.

## Frontend routing

| Path | Guard | Purpose |
| --- | --- | --- |
| / | routing query | Redirect to sign-in, register, or profile |
| /sign-in | public | Password sign-up / sign-in, OTP verify, forgot-password reset |
| /register | auth, not submitted | Application form with autosave |
| /profile | auth | Applicant dashboard — overview fields, hackathon timeline, sign-out |

Route guards use `applicant:getApplicantRoutingState`.

Contact form lives in **hackuta-2026-registration**, not this repo.

## Deployment split

| Component | Host | Config |
| --- | --- | --- |
| SPA | Vercel | `VITE_*` env vars, vercel.json headers |
| Backend | Convex Cloud | `npx convex env set`, separate dev/prod deployments |

Dev deployment: `standing-manatee-425`. Production: `brilliant-ostrich-892`.

## Key design decisions

1. **Profiles table** — separates auth from application data; enables draft rows without nested objects.
2. **Password + OTP verify** — passwords for return visits; email verification via 6-digit OTP on sign-up; separate OTP flow for password reset.
3. **Capability-token resume upload** — HTTP upload requires an authenticated JWT; uploads are bound to `authUserId`, rate-limited per user/IP, and redeemed with a single-use capability token at registration time.
4. **Duplicate mutation aliases** — `register` and `submitRegistration` share one handler (public API stability).
5. **Mock mode** — `VITE_USE_MOCK_API` for CI/UI dev only; never on production Vercel.

## Related docs

- [API.md](API.md) — endpoint reference
- [SECURITY.md](SECURITY.md)
- [TESTING.md](TESTING.md)
