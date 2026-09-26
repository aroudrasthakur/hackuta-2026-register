# Security review — HackUTA 2026 Register

| Field | Value |
| --- | --- |
| Date | 2026-09-26 |
| Reviewer | Cursor agent (static audit + remediation + unit tests) |
| Commit | `25d118b` (remediation; baseline pre-fix: `56b45d53e15f377a360790a32e4c087290635a96`) |
| Dev deployment | `standing-manatee-425` |
| Prod deployment | `brilliant-ostrich-892` (read-only env review) |

## Executive summary

Static review across 13 checkpoint areas found **6 dangerous** issues (F1–F6, F9). All were remediated in code with regression tests. **1121 unit tests pass** after remediation (including new security tests). Dev deployment updated with schema index `rateLimits.by_bucket_key_createdAt`. Unused direct `@auth/core` dependency removed (still provided transitively by `@convex-dev/auth`).

**Operational follow-up (human):** rotate production `EMAIL_SERVICE_API_KEY` — it was historically copied into dev by `sync-dev-convex-env.mjs`.

## Endpoint & function inventory

### Public Convex functions (14)

| Function | Auth | Notes |
| --- | --- | --- |
| `eventConfig:getPublicEventConfig` | None | Hackathon name |
| `applicant:getApplicantRoutingState` | Session | Routing flags |
| `applications:getMyApplicationDraft` | Session | Own draft only |
| `applications:saveApplicationDraft` | Session | Draft + rate limit |
| `applications:getMyApplicantDashboard` | Session | Own dashboard |
| `applicant:ensureApplicantApplication` | Session | Bootstrap row |
| `registrations:submitRegistration` | Verified | Strict Zod payload |
| `rateLimits:getOtpSendCooldown` | None | Read-only query |
| `rateLimits:getPasswordResetSendCooldown` | None | Read-only query |
| `passwordReset:invalidateSessionsAfterPasswordReset` | Session | Own sessions only |
| `auth:signIn` / `signOut` / `store` | Mixed | `@convex-dev/auth` |
| `emailDeliveries:listEmailDeliveriesForRecipient` | Internal only | — |

### HTTP routes

| Route | Auth | Notes |
| --- | --- | --- |
| `POST /resume-upload` | Session + verified email | PDF, 2 MB stream cap |
| `OPTIONS /resume-upload` | Origin allowlist | CORS preflight |
| Auth OIDC routes | — | Added by `auth.addHttpRoutes` |

### Internal-only (representative)

`rateLimits:consumeOtpSendRequest`, `consumePasswordResetRequest`, `consumeDraftSaveRequest`, `consumeSubmitRequest`, `pruneExpiredRateLimits`, `maintenance:resetAllData`, `maintenance:deleteAccountByEmail`, `maintenance:pruneOldEmailDeliveries`, all `email/*` actions, `resumeUploads:*` internal mutations.

## Checkpoint results

| ID | Area | Result | Severity | Evidence / fix |
| --- | --- | --- | --- | --- |
| 1.1 | Auth on protected functions | **Pass** | — | `requireAuthUserId` / `requireVerifiedAuthUser` |
| 1.3 | Password hashing | **Pass** | — | Scrypt via `@convex-dev/auth` |
| 1.4 | Server password rules | **Pass** | — | `validatePasswordRequirements` |
| 1.5 | Sign-up enumeration | **Pass** | Med | Neutral message in `errorMessages.ts` |
| 1.6 | Verified email gate | **Pass** | High | `/resume-upload` + submit require verification |
| 1.7 | Sign-out cache clear | **Pass** | Med | `clearAuth` + session key remount |
| 1.8 | Expired session | **Pass** | — | Covered by auth library + regression tests |
| 1.9 | Mock auth prod guard | **Pass** | Med | `verify-production-env.mjs` + runtime guard |
| 1.10 | Password reset sessions | **Pass** | Low | Documented self-only session invalidation |
| 2.6–2.8 | OTP rate limits | **Pass** | High | Atomic `consumeOtpSendRequest` |
| 2.10 | OTP secrecy / IP limits | **Pass** | Med | IP + global buckets; `AUTH_LOG_LEVEL` not DEBUG on prod |
| 2.11 | Queue vs expiry | **Pass** | Low | UI states 10-minute expiry |
| 3.5 | Two-account isolation | **Pass** | — | `security-regression.test.ts` |
| 3.9 | Cooldown DB writes | **Pass** | High | Cooldown endpoints are queries |
| 4.1–4.3 | Field limits | **Pass** | High | `draftLimits.ts` + Zod `.max()` |
| 4.8 | Concurrent submit | **Pass** | — | Existing backend tests |
| 5.1 | Verified upload | **Pass** | High | `http.ts` + `userVerification` query |
| 5.2–5.3 | Upload size / PDF | **Pass** | Med | Streaming cap + active-content scan |
| 5.14 | Filename CRLF | **Pass** | Low | Control char rejection |
| 6.6 | Email XSS | **Pass** | — | `email-template-escape.test.ts` |
| 7.1–7.3 | Rate limits | **Pass** | High | Index + IP/global + draft/submit limits |
| 8.5–8.7 | Trusted Types / headers | **Pass** | High | Real TT policy; nosniff, CORP, no-store |
| 8.12 | CSP | **Pass** | Med | Wildcard documented for preview deploys |
| 9.5–9.7 | Dev/prod key separation | **Pass** | High | `sync-dev-convex-env.mjs`; **rotate prod key** |
| 10.4–10.5 | Retention / wipe | **Pass** | High | Full reset + 90-day email cron |
| 11.3 | Prod console.error | **Pass** | Med | DEV-only submit log |
| 12.2–12.8 | CI / deps | **Pass** | Med | Dependabot, CodeQL; npm audit 0 high |
| E Live verify | Manual probes | **Blocked** | — | Email service probes need operator key; audit account cleanup optional |

## Reproduction notes (pre-fix)

- **F1:** Parallel `auth:signIn` sign-up calls could pass `assertOtpSendAllowed` before any `recordOtpSend`.
- **F2:** `getOtpSendCooldown` inserted `otp_status_lookup` rows on every call.
- **F3:** `sync-dev-convex-env.mjs` copied prod `EMAIL_SERVICE_API_KEY`.
- **F5:** `/resume-upload` accepted unverified sessions.
- **F6:** `trusted-types.js` was identity passthrough.

## Test evidence

```text
npm run test:unit → 74 files, 1121 tests passed
npm run typecheck → pass
npx convex dev --once → index rateLimits.by_bucket_key_createdAt added on standing-manatee-425
npm audit --omit=dev → 0 vulnerabilities
```

## Remaining risks

| Risk | Owner | Mitigation |
| --- | --- | --- |
| Per-account OTP lockout (5/hour) | Product | Accept; document in FAQ |
| `@convex-dev/auth` failed attempts per account only | Platform | IP/global send limits added |
| No antivirus on PDFs | Ops | Open in sandboxed viewer |
| Prod email key may have been in dev | Ops | **Rotate key** |
| CSP `*.convex.cloud` wildcard | Eng | Required for Vercel preview builds |

## External dependencies

- Email service (`emailservice.hackuta.com`) — HTTPS, API key, queue semantics
- Convex Auth — session, Scrypt, OTP storage
- Vercel — TLS, security headers via `vercel.json`
