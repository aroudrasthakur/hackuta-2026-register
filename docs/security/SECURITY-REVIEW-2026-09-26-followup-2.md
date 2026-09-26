# Security review follow-up 2 — HackUTA 2026 Register

| Field | Value |
| --- | --- |
| Date | 2026-09-26 |
| Reviewer | Cursor agent (re-audit R2 + fixes) |
| Baseline | `cc17a20` / `e72f0fd` (R1–R16 follow-up) |
| Prior report | [SECURITY-REVIEW-2026-09-26-followup.md](./SECURITY-REVIEW-2026-09-26-followup.md) |
| Branch | `feat/8-security-update` |

## Executive summary

Third-pass static re-audit after R1–R16 found **no High regressions**. Ten **Medium/Low** incomplete fixes (S1–S10) were closed in this pass. **`vercel.live` was removed** from production CSP and Trusted Types (preview app still works; Vercel comments toolbar may fail).

Original F1–F27 and R1–R16 items remain **Pass** with the gaps below now addressed.

**Operational follow-up (unchanged):** rotate production `EMAIL_SERVICE_API_KEY` if not already done.

## Re-audit R2 findings (S1–S10)

| ID | Severity | Status | Evidence / fix | Test |
| --- | --- | --- | --- | --- |
| S1 | Medium | **Fixed** | Auth cleanup uses `@convex-dev/auth` indexes: `authSessions.userId`, `authAccounts.userIdAndProvider`, `authRefreshTokens.sessionId`, `authVerificationCodes.accountId`, `authRateLimits.identifier`. `authVerifiers` has no sessionId index — bounded per-session filter retained. | `maintenance.test.ts`, `password-reset-backend.test.ts` |
| S2 | Medium | **Fixed** | `deleteAccountByEmail` deletes rate limits by known keys (`normalized` email, `String(userId)`, `user:${userId}`) via `by_bucket_key_createdAt` through `deleteRateLimitsForBucketKeys` | `maintenance.test.ts` (A vs B isolation for draft/submit/resume/otp rows) |
| S3 | Low | **Fixed** | Draft NaN (and non-finite values) rejected with `DRAFT_NUMBER_OUT_OF_RANGE_MESSAGE` | `draft-limits.test.ts` (NaN + graduationYear range) |
| S4 | Medium | **Fixed** | PDF graph walk recurses dict values (depth cap 8), inspects stream `.dict`, rejects `AA`, `Names`, `EmbeddedFiles`, `EF`, `AcroForm`, `XFA` | `pdf-validation.test.ts` (annotation `/A`, catalog `/AA`) |
| S5 | Medium | **Fixed** | Post-load cap via `countLoadedPdfObjects()` after `PDFDocument.load`; pre-parse declaration count kept as cheap filter | `pdf-validation.test.ts` |
| S6 | Medium | **Fixed** | Removed `https://vercel.live` from `security/csp.ts`, `vercel.json`, and Trusted Types (`public/trusted-types.js`) | `security.test.ts`, `trusted-types-policy.test.ts`, `csp.test.ts` |
| S7 | Low | **Fixed** | Raw scan matches PDF name tokens only; hex `#xx` normalized per token (avoids `/JSans` false positives) | `pdf-validation.test.ts` (`/JSans` accepted) |
| S8 | Low | **Fixed** | `x-test-origin` Origin substitute gated on `VITEST` / `CONVEX_TEST_MODE` (same as content-length test fallback) | existing upload tests |
| S9 | Low | **Fixed** | `docs/API.md`: cooldown endpoints are **queries**; `convex/README.md`: pdfValidation does graph walk; first follow-up Test column corrected | docs review |
| S10 | Low | **Fixed** | `security.test.ts` asserts `Cross-Origin-Opener-Policy: same-origin` and `X-Frame-Options: DENY` from `vercel.json` | `security.test.ts` |

## Updated F/R status

| Item | Result | Notes |
| --- | --- | --- |
| F1–F27 | **Pass** | Unchanged |
| R1–R11, R13–R16 | **Pass** | Unchanged |
| R12 | **Superseded** | `vercel.live` removed in S6 (stricter than R12) |
| R3/R4/R5/R9 partial gaps | **Pass** | Completed by S4, S5, S2, S3 |

## Test evidence

```text
npm run typecheck → pass
npm run test:unit → 76 files, 1139 tests passed
npm audit --omit=dev → 0 vulnerabilities
```

No schema changes; existing auth and rate-limit indexes only.

## Remaining risks

| Risk | Owner | Mitigation |
| --- | --- | --- |
| PDF active content only in compressed object streams | Eng | Graph walk after parse; no AV |
| Vercel preview comments toolbar blocked | Eng/Ops | Accepted — preview app works without `vercel.live` |
| Per-account failed sign-in lockout (`@convex-dev/auth`) | Platform | Document; IP/global on sends only |
| Prod email key historical dev exposure | Ops | **Rotate key** |
| CSP `*.convex.cloud` wildcard | Eng | Required for preview deploys |
| Public cooldown oracle | Eng | Accepted design |
| Live header / email-service probes | Ops | Manual curl + service checks |

## External dependencies

Unchanged from [SECURITY-REVIEW-2026-09-26.md](./SECURITY-REVIEW-2026-09-26.md).
