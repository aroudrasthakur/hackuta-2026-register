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

Related repos: marketing site (`hackuta-2026-repository`), applicant profile split (`hackuta-2026-profile`).

## Repository layout

```
convex/                     Backend — queries, mutations, actions, HTTP, cron
  auth.ts                   @convex-dev/auth Password + email OTP verification
  http.ts                   Resume upload + Auth OIDC routes
  profiles.ts               Draft save/load, applicant dashboard
  registrations.ts          Submit application, resume sessions
  applicant.ts              Routing, ensureApplicantProfile
  rateLimits.ts             OTP and upload throttling
  pdfValidation.ts          Server-side PDF parse
  registrationSecurity.ts   Origin allowlist
  profileFields.ts          Profile schema validators
  email/                    SMTP actions + HTML templates
  lib/                      Shared Convex helpers

shared/                     Isomorphic code (client + Convex)
  registration/             Zod schema, types, validation, resume policy, draftPatch
  auth/                     Password rules, OTP rate-limit helpers
  lib/                      sanitizeInput, normalizeEmail
  hackathon/                Schedule/timeline constants

src/                        React SPA
  pages/SignIn|Register|Profile
  convex/client.ts          ConvexReactClient wiring
  hooks/                    Auth, routing, applicant state

security/                   CSP + response headers (sync with vercel.json)
tests/                      Vitest unit + Playwright e2e
docs/                       This documentation set
```

## Request flows

### Sign up / sign in

```
/sign-in → Password provider (email + password)
         → email-verification OTP (6 digits via SMTP)
         → JWT session
         → ensureApplicantProfile
         → route to /register or /profile
```

Sign-in mode skips OTP when the account is already verified.

### Application draft

```
/register form → profiles:saveProfileDraft (debounced ~800ms)
              → profiles:getMyProfileDraft on load (hydrate fields)
```

Draft rows use `status: "draft"`. Users can leave and resume until submit.

### Application submit

```
/register form → client Zod validate
              → POST /resume-upload (optional PDF)
              → registrations:register { data, resumeUploadToken }
              → profile status → submitted
              → confirmation email (internal action)
```

Email in `data` is ignored; server uses verified auth email.

## Data model

Auth lives on `users` (Convex Auth). Application data lives in **`profiles`** — one row per auth user per hackathon.

| Table | Purpose |
| --- | --- |
| `users` | Convex Auth identity (email, verification time; no passwords in schema) |
| `profiles` | All form fields as columns + status, draft/submitted timestamps |
| `hackathons` | Event metadata and registration window |
| `rateLimits` | Sliding-window counters (OTP, upload) |
| `resumeUploadSessions` | Capability tokens linking upload → registration |
| `_storage` | Resume PDF blobs |
| Auth tables | Sessions, verification codes (managed by `@convex-dev/auth`) |

Schema: `convex/schema.ts`. Field validators: `convex/profileFields.ts`.

## Shared validation pattern

Client and server import the same modules under `shared/`:

- **Registration:** `registrationPayloadSchema` in `schema.ts`; server entry `validateRegistrationPayload()` in `validation.ts`
- **Password:** `validatePasswordRequirements()` in `shared/auth/password.ts`
- **Sanitization:** `shared/lib/sanitizeInput.ts` used inside Zod transforms

Client validation gives immediate field feedback; server validation is authoritative.

## Frontend routing

| Path | Guard | Purpose |
| --- | --- | --- |
| `/` | routing query | Redirect to sign-in, register, or profile |
| `/sign-in` | public | Password sign-up / sign-in + OTP verify |
| `/register` | auth, not submitted | Application form with autosave |
| `/profile` | auth | Applicant dashboard (read-only) |

Route guards use `applicant:getApplicantRoutingState`.

Contact form lives in **hackuta-2026-registration**, not this repo.

## Deployment split

| Component | Host | Config |
| --- | --- | --- |
| SPA | Vercel | `VITE_*` env vars, `vercel.json` headers |
| Backend | Convex Cloud | `npx convex env set`, separate dev/prod deployments |

Dev deployment: `standing-manatee-425`. Production: `brilliant-ostrich-892`.

## Key design decisions

1. **Profiles table** — separates auth from application data; enables draft rows without nested objects.
2. **Password + OTP verify** — passwords for return visits; email verification via 6-digit OTP on sign-up.
3. **Capability-token resume upload** — HTTP upload is unauthenticated; security is origin allowlist + token redemption at mutation time.
4. **Duplicate mutation aliases** — `register` and `submitRegistration` share one handler (public API stability).
5. **Mock mode** — `VITE_USE_MOCK_API` for CI/UI dev only; never on production Vercel.

## Related docs

- [API.md](API.md) — endpoint reference
- [SECURITY.md](SECURITY.md)
- [TESTING.md](TESTING.md)
