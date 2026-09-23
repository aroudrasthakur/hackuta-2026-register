# Tests (`tests/`)

Quality gates for the registration app: Vitest unit/integration tests and Playwright browser specs.

## Overview

| Path | Summary |
| --- | --- |
| [unit/](unit/) | Vitest — shared modules, Convex handlers, React pages and hooks |
| [fixtures/](fixtures/) | Shared registration form payloads for tests |
| [register.spec.ts](register.spec.ts) | Playwright e2e — sign-up, OTP, application flow, CSP headers |
| [playwright-coverage.ts](playwright-coverage.ts) | Playwright fixture wrapper for Istanbul coverage |
| [unit/setup.ts](unit/setup.ts) | Vitest global setup (@testing-library/jest-dom) |

Config: [vitest.config.ts](../vitest.config.ts), [playwright.config.ts](../playwright.config.ts).

## Unit tests (`unit/`)

### Shared and validation

| File | Covers |
| --- | --- |
| registration-validation.test.ts | Zod registration schema |
| registration-constants.test.ts | Shared enums and bounds |
| draft-patch.test.ts | Draft patch merge rules |
| sanitize-input.test.ts | Input sanitization |
| normalize-email.test.ts | Email normalization |
| password.test.ts | Password rules |
| otp-rate-limit.test.ts | OTP cooldown helpers |
| submit-errors.test.ts | Error message mapping |
| resume-upload-policy.test.ts | Client resume policy |
| pdf-validation.test.ts | Server PDF parse |
| hackathon-timeline.test.ts | Timeline builder |
| mlh-texas-schools.test.ts | Texas school ordering |
| validation-build.test.ts | Schema build smoke test |

### Convex backend

| File | Covers |
| --- | --- |
| convex.test.ts | Registrations, resume HTTP route, drafts, seed, cleanup |
| resume-upload-security.test.ts | Upload origin allowlist |
| rate-limits.test.ts | OTP rate-limit mutations |
| email-actions.test.ts | Email action wiring |
| email-service.test.ts | SMTP helper |

### Frontend

| File | Covers |
| --- | --- |
| sign-in.test.tsx, sign-in-extended.test.tsx | Sign-in / OTP UI |
| register-ui.test.tsx, register-api.test.ts | Application form and API client |
| resume-upload.test.tsx | Resume widget |
| profile-page.test.tsx | Applicant dashboard |
| home-redirect.test.tsx | / routing |
| auth-bootstrap.test.tsx | Session bootstrap |
| use-session-auth.test.tsx, use-applicant-routing.test.tsx | Auth hooks |
| applicant-timeline.test.tsx | Profile timeline UI |
| searchable-select.test.tsx | School search control |
| weather-mood.test.tsx | Sign-in weather toggle |

### Security

| File | Covers |
| --- | --- |
| security.test.ts | CSP / header parity with vercel.json |
| csp.test.ts | CSP directive structure |
| auth.test.ts | Mock auth helpers |

Convex integration tests use convex-test with import.meta.glob over convex/**/*.ts. HTTP upload tests use X-Test-Origin and X-Test-Content-Length because the test harness cannot set Content-Length.

## E2E (`register.spec.ts`)

Runs against the dev server or a production build (PLAYWRIGHT_USE_BUILD=true). CI uses mock auth (VITE_USE_MOCK_API=true) — no live Convex or SMTP.

Covers password sign-up, mock OTP verify, multi-step registration, and production security headers.

Contact-form e2e lives in the separate [hackuta-2026-registration](https://github.com/aroudrasthakur/hackuta-2026-registration) repo.

## Commands

| Command | Purpose |
| --- | --- |
| npm run test:unit | All Vitest tests |
| npm run test:unit:coverage | Vitest with Istanbul output |
| npm run test:coverage:check | Enforce 80% thresholds ([check-coverage.mjs](../scripts/check-coverage.mjs)) |
| npm run test:e2e | Playwright |
| PLAYWRIGHT_USE_BUILD=true npm run test:e2e | Playwright against dist/ (CI path) |

## Related

| Location | Role |
| --- | --- |
| [docs/TESTING.md](../docs/TESTING.md) | CI pipeline and conventions |
| [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) | Pre-PR quality gate |
| [scripts/README.md](../scripts/README.md) | Convex stub and coverage scripts |

Parent index: [README.md](../README.md).
