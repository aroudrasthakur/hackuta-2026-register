# Testing

How quality is enforced before production deploys.

## Overview

| Layer | Tool | Location |
| --- | --- | --- |
| Unit + integration | Vitest | `tests/unit/` |
| Browser + a11y | Playwright | `tests/*.spec.ts` |
| Coverage gate | Istanbul | 80% thresholds (`scripts/check-coverage.mjs`) |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

## Commands

```bash
npm run test:unit              # all Vitest tests
npm run test:unit:coverage     # with coverage report
npm run test:coverage:check    # enforce thresholds
npm run test:e2e               # Playwright (dev server)
PLAYWRIGHT_USE_BUILD=true npm run test:e2e   # against production build (CI path)
```

## Unit test areas

| Area | Example files |
| --- | --- |
| Registration Zod | `registration-validation.test.ts` |
| Password auth | `password.test.ts`, `sign-in.test.tsx`, `sign-in-extended.test.tsx` |
| Profile drafts | `convex.test.ts`, `register-ui.test.tsx` |
| Input sanitization | `sanitize-input.test.ts` |
| Resume upload policy | `resume-upload-policy.test.ts`, `convex.test.ts` |
| PDF validation | `pdf-validation.test.ts` |
| Error mapping | `submit-errors.test.ts` |
| CSP / headers sync | `security.test.ts`, `csp.test.ts` |
| Convex integration | `convex.test.ts` |

Convex tests use `convex-test` with `import.meta.glob` over `convex/**/*.ts`.

## E2E tests

Playwright covers password sign-up, OTP verify, registration UI, and CSP header assertions (`register.spec.ts`). Contact form tests remain in `hackuta-2026-registration`.

CI builds with `VITE_USE_MOCK_API=true` — no live Convex or SMTP in browser jobs.

## CI pipeline

| Job | Steps |
| --- | --- |
| **quality** | lint → typecheck → unit tests + coverage → production build |
| **e2e** | Playwright against uploaded `dist/` artifact |
| **dependency-audit** | `npm audit --omit=dev --audit-level=high` |
| **secrets** | Gitleaks full-history scan |

## Writing tests

- **Validation changes:** add cases to the matching `shared/` unit test; server must stay in sync with client schema.
- **HTTP upload changes:** extend `convex.test.ts` resume section; use `X-Test-Content-Length` + `X-Test-Origin` (convex-test cannot set `Content-Length`).
- **CSP changes:** update `security/csp.ts` **and** `vercel.json`; `security.test.ts` enforces parity.
- **New public API:** document in [API.md](API.md) and add convex-test coverage where applicable.

## Mock mode

`VITE_USE_MOCK_API=true` bypasses Convex Auth and mutations. Mock OTP: **`042681`**. Used in CI e2e, not production.

## Related docs

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
