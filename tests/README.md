# Tests (`tests/`)

Quality gates for the registration app: Vitest unit/integration tests and Playwright browser specs.

## Overview

| Path | Summary |
| --- | --- |
| [unit/](unit/) | Vitest — shared modules, Convex handlers, React pages and hooks |
| [fixtures/](fixtures/) | Shared payloads and Playwright helpers (registration form, auth, profile layout) |
| [register.spec.ts](register.spec.ts) | Playwright e2e — sign-up, OTP, application flow, CSP headers |
| [profile.spec.ts](profile.spec.ts) | Playwright e2e — profile overview layout and sign-out placement (mobile + desktop) |
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
| application-questions.test.ts | Mandatory multiline application questions (validation, draft round-trip, legacy hydration) |
| hackathons-attended.test.ts | `hackathonsAttended` integer field and legacy `firstHackathon` mapping |
| sanitize-input.test.ts | Input sanitization |
| normalize-email.test.ts | Email normalization |
| password.test.ts | Password rules |
| auth-error-messages.test.ts | mapAuthError and mapPasswordResetError |
| otp-rate-limit.test.ts | OTP cooldown helpers |
| submit-errors.test.ts | Error message mapping |
| resume-upload-policy.test.ts | Client resume policy |
| pdf-validation.test.ts | Server PDF parse |
| hackathon-timeline.test.ts | Timeline builder |
| dietary-migration.test.ts | Legacy eatsBeef/eatsPork → dietaryRestrictions migration mapping |
| mlh-texas-schools.test.ts | Texas school ordering |
| validation-build.test.ts | Schema build smoke test |

### Convex backend

| File | Covers |
| --- | --- |
| convex.test.ts | Registrations, resume HTTP route, drafts, seed, cleanup |
| resume-upload-security.test.ts | Upload origin allowlist |
| rate-limits.test.ts | Sign-up and password-reset OTP rate-limit mutations |
| email-actions.test.ts | Email actions: plain-text sends, delivery tracking, recipient lookup, status check |
| email-service.test.ts | Email service client (config, errors, timeouts, tracking) and templates |
| backend-authorization.test.ts | Auth boundaries, profile lifecycle, upload sessions, upload failure recovery, maintenance and migrations |
| hackuta-password.test.ts | Password provider flows: sign-up, sign-in, reset, reset verification, email verification |
| convex-auth-config.test.ts | Auth provider wiring, OTP generation, rate-limited email delivery |

### Frontend

| File | Covers |
| --- | --- |
| sign-in.test.tsx, sign-in-extended.test.tsx | Sign-in / OTP UI (including secondary action buttons) |
| sign-in-password-input.test.tsx | Sign-in password visibility toggle |
| forgot-password.test.tsx | Forgot-password flow (mock auth) |
| sign-in-convex.test.tsx | Sign-in, OTP resend, and password reset against mocked Convex auth |
| auth-components.test.tsx | OTP input, route guard, sign-out, mock auth provider |
| register-ui.test.tsx, register-api.test.ts | Application form and API client |
| register-form-workflows.test.tsx | Autosave retry, upload/submit failure recovery, resume reuse and cleanup, application questions UI |
| form-fields.test.tsx | TextAreaField helper text and validation display |
| resume-upload.test.tsx | Resume widget |
| profile-page.test.tsx | Applicant dashboard |
| home-redirect.test.tsx | / routing |
| auth-bootstrap.test.tsx | Session bootstrap |
| use-session-auth.test.tsx, use-applicant-routing.test.tsx | Auth hooks |
| applicant-timeline.test.tsx | Profile timeline UI |
| searchable-select.test.tsx | School search control |
| select-field.test.tsx | Custom SelectField listbox |
| custom-checkbox.test.tsx | CustomCheckbox and CustomRadio controls |
| allergy-details.test.ts | `allergyDetails` rename, legacy merge helper, validation, draft round-trip |
| experience-level.test.ts | Experience level select field and draft autosave |
| weather-mood.test.tsx | Sign-in weather toggle |
| app-shell.test.tsx | main.tsx providers and routes, Convex client, storm backdrop, presentational components |

### Security

| File | Covers |
| --- | --- |
| security.test.ts | CSP / header parity with vercel.json |
| csp.test.ts | CSP directive structure |
| auth.test.ts | Mock auth helpers |

Convex integration tests use convex-test with import.meta.glob over convex/**/*.ts. HTTP upload tests use X-Test-Origin and X-Test-Content-Length because the test harness cannot set Content-Length.

## E2E (`register.spec.ts`, `profile.spec.ts`)

Runs against the dev server or a production build (PLAYWRIGHT_USE_BUILD=true). CI uses mock auth (VITE_USE_MOCK_API=true) — no live Convex or email service.

| Spec | Covers |
| --- | --- |
| register.spec.ts | Password sign-up, mock OTP verify, multi-step registration (including application questions and hackathons attended), dietary options, CSP headers |
| profile.spec.ts | Profile overview grid, sign-out below details/timeline, mobile and desktop viewports |

Shared Playwright helpers: [fixtures/playwrightAuth.ts](fixtures/playwrightAuth.ts) (sign-up, client-side profile navigation, `openProfileAsReturningApplicant` via `window.__hackutaMockAuth`), [fixtures/playwrightRegistration.ts](fixtures/playwrightRegistration.ts), [fixtures/profileLayout.ts](fixtures/profileLayout.ts).

Contact-form e2e lives in the separate [hackuta-2026-registration](https://github.com/aroudrasthakur/hackuta-2026-registration) repo.

## Commands

| Command | Purpose |
| --- | --- |
| npm run test:unit | All Vitest tests |
| npm run test:unit:coverage | Vitest with Istanbul output; fails below 85% globally or per area |
| npm run test:coverage:check | Per-area coverage table and threshold check ([check-coverage.mjs](../scripts/check-coverage.mjs)) |
| npm run test:e2e | Playwright |
| PLAYWRIGHT_USE_BUILD=true npm run test:e2e | Playwright against dist/ (CI path) |

## Related

| Location | Role |
| --- | --- |
| [docs/TESTING.md](../docs/TESTING.md) | CI pipeline and conventions |
| [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md) | Pre-PR quality gate |
| [scripts/README.md](../scripts/README.md) | Convex stub and coverage scripts |

Parent index: [README.md](../README.md).
