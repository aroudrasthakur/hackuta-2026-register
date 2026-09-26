# Security review follow-up — HackUTA 2026 Register

| Field | Value |
| --- | --- |
| Date | 2026-09-26 |
| Reviewer | Cursor agent (re-audit + follow-up fixes) |
| Baseline remediation | `25d118b` / `edecd21` |
| Follow-up commit | `cc17a20` on `feat/8-security-update` |
| Dev deployment | `standing-manatee-425` |
| Prod deployment | `brilliant-ostrich-892` (read-only) |

## Executive summary

Re-audit of post-remediation code found **no High regressions**. Seven **Medium** incomplete fixes (R1–R7) and nine **Low/Info** gaps (R8–R16) were closed in this follow-up. **1133 unit tests pass**; typecheck clean; dev Convex deployed with new `by_createdAt` indexes.

Original F1–F27 items remain **Pass** except where R-items reopened partial areas (F2, F7, F9, F10, F24) — all now **Pass** with tests.

**Operational follow-up (unchanged):** rotate production `EMAIL_SERVICE_API_KEY` if not already done.

## Re-audit findings (R1–R16)

| ID | Severity | Status | Evidence / fix | Test |
| --- | --- | --- | --- | --- |
| R1 | Medium | **Fixed** | Rate-limit readers use `bucket`+`key` index prefix via `listRateLimitsForBucketKey` / `countRecentRateLimits` | `rate-limits.test.ts` (500 noise rows) |
| R2 | Medium | **Fixed** | Password-reset IP from `getClientAddressFromMeta(ctx)`; ignores spoofed `params.clientAddress` | `client-address.test.ts`, `auth-send-rate-limits.test.ts` (IP bucket only) |
| R3 | Medium | **Fixed** | PDF hex-name normalization + object-graph active-content walk (partial — nested `/A`/`/AA` completed in R2 follow-up) | `pdf-validation.test.ts` (hex markers; graph walk extended in follow-up-2) |
| R4 | Medium | **Fixed** | Pre-parse object-count cap (`MAX_PDF_OBJECT_COUNT`); post-load elapsed check retained | `pdf-validation.test.ts` |
| R5 | Medium | **Fixed** | `deleteAccountByEmail` removes refresh tokens, verifiers, verification codes, authRateLimits, failures, rateLimits | `maintenance.test.ts` |
| R6 | Medium | **Fixed** | `by_createdAt` indexes; chained prune for email + all rate-limit buckets | `maintenance.test.ts`, `rate-limits.test.ts` |
| R7 | Medium | **Fixed** | GitHub Actions pinned to full commit SHAs | `.github/workflows/ci.yml`, `codeql.yml` |
| R8 | Low | **Fixed** | Test content-length fallback gated on `VITEST` / `CONVEX_TEST_MODE` | existing upload tests |
| R9 | Low | **Fixed** | Draft numeric bounds for age, graduationYear, hackathonsAttended | `draft-limits.test.ts` |
| R10 | Low | **Fixed** | README / scripts README no longer claim prod API key sync | docs review |
| R11 | Low | **Fixed** | `public/README.md`, `convex/README.md`, `OPERATIONS.md` accuracy | docs review |
| R12 | Low | **Superseded** | Trusted Types allowed `vercel.live` script URLs (removed in R2 follow-up S6) | `trusted-types-policy.test.ts` (same-origin only after follow-up-2) |
| R13 | Low | **Fixed** | Default `LANDING_URL` aligned to `https://hackuta.com` | `site.ts` |
| R14 | Info | **Fixed** | `build.sourcemap: false` explicit in Vite config | `vite.config.ts` |
| R15 | Info | **Fixed** | Unverified resume upload returns 403 | `convex.test.ts` |
| R16 | Info | **Fixed** | Unbiased 6-digit OTP via rejection sampling | `auth.ts` |

## Updated F1–F27 status (post follow-up)

| Original | Result | Notes |
| --- | --- | --- |
| F1–F6, F9 | **Pass** | Unchanged from first remediation |
| F2, F7 | **Pass** | R1 index prefix + R2 reset IP complete F2/F7 gaps |
| F9, F10 | **Pass** | R5/R6 retention/delete; R3/R4 PDF hardening |
| F24 | **Pass** | R7 SHA-pinned actions (was Partial in first report) |
| F11–F23, F25–F27 | **Pass** | Unchanged |
| Section E live verify | **Blocked** | Operator key / deployed host probes still manual |

## Test evidence

```text
npm run test:unit → 76 files, 1133 tests passed
npm run typecheck → pass
npx convex dev --once → by_createdAt indexes on emailDeliveries, emailDeliveryRecordingFailures, rateLimits
npm audit --omit=dev → 0 vulnerabilities
```

## Remaining risks

| Risk | Owner | Mitigation |
| --- | --- | --- |
| PDF active content in compressed streams not caught by raw scan alone | Eng | Object-graph walk after parse; no AV |
| Per-account failed sign-in lockout (`@convex-dev/auth`) | Platform | Document; IP/global on sends only |
| Prod email key historical dev exposure | Ops | **Rotate key** |
| CSP `*.convex.cloud` wildcard | Eng | Required for preview deploys |
| Live header / email-service probes | Ops | Manual curl + service checks |

## External dependencies

Unchanged from [SECURITY-REVIEW-2026-09-26.md](./SECURITY-REVIEW-2026-09-26.md).
