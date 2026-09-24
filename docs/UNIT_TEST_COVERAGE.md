# Unit test coverage upgrade

This document explains what changed in our unit tests: why we did it, what's covered now, and how the coverage check works.

---

## The short version

- **Before:** about **75%** of the code was exercised by unit tests once every source file was counted. The old setup excluded large parts of the app from measurement, which made the reported number look higher than it was.
- **After:** about **98%** of the code is tested, and every part of the app is above **85%** on its own.
- **CI now enforces it.** A pull request fails if coverage drops below 85%, either overall or in any single area of the app.
- **Tests stay offline.** They never contact a real server, database, or email service, and they don't need any passwords or keys.
- **Tests found real problems.** One was fixed, and a few smaller ones are listed at the end.

---

## What "coverage" means

Coverage measures how much of our code actually runs while the tests run. It's reported four ways:

| Metric | In plain terms |
| --- | --- |
| **Statements** | How many individual instructions ran |
| **Branches** | For every `if`/`else`, whether **both** paths were tried |
| **Functions** | How many functions were called at least once |
| **Lines** | How many lines of code ran |

A high number doesn't guarantee the code is correct, but a low number guarantees parts of it are untested. The aim was tests that check real behavior: success cases, failures, edge cases, and recovery from errors.

---

## Before and after

| | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| **Before** (all code counted) | 75.5% | 71.8% | 82.5% | 76.4% |
| **After** | 98.3% | 95.8% | 98.8% | 98.9% |

### Coverage by area of the app

We split the app into seven areas. Each one has to pass the 85% bar **by itself**. That stops a heavily tested helper file from hiding an untested screen or workflow.

| Area | What it includes | Statements | Branches | Functions | Lines |
| --- | --- | ---: | ---: | ---: | ---: |
| Shared validation & error messages | Form rules, draft saving logic, error wording (`shared/`) | 99.6% | 98.8% | 100% | 99.5% |
| Backend | Convex database functions, file upload endpoint, emails (`convex/`) | 99.3% | 95.3% | 100% | 99.6% |
| Security headers | Content Security Policy and headers (`security/`) | 100% | 100% | 100% | 100% |
| Sign-in & accounts | Sign-in page, OTP codes, password reset, route guards | 96.4% | 92.3% | 100% | 98.2% |
| Registration form | The application form, resume upload, submission | 97.5% | 94.3% | 97.0% | 98.3% |
| Profile page | The applicant dashboard | 98.5% | 100% | 92.3% | 98.3% |
| App shell | App startup, page layout, visuals, Convex connection | 98.7% | 98.1% | 97.6% | 98.6% |

---

## What's tested now

### Sign-in and accounts
- Creating an account, getting a 6-digit email code, and entering it.
- Signing in with a correct or incorrect password, and being sent to the right page afterwards (new applicants to the form, returning applicants to their profile).
- **Resending codes:** the 30-second wait, the hourly limit, and what happens if the server can't be reached.
- **Password reset, end to end:** request a code, enter it, choose a new password, and sign out of other devices. It also covers bad codes, reusing the old password, and weak passwords.
- The site doesn't reveal whether an email address has an account.
- Every fresh page load starts signed out, as intended.
- The backend rules behind all of this: account creation, sign-in, reset, and email verification, plus the rate limits on how often codes can be sent.

### Registration form
- Every validation rule, including the boundary values (for example, a phone number with exactly 7 or 15 digits).
- **Conditional fields:** picking "Other" for school, major, how you heard about us, or race/ethnicity shows a follow-up box, and what you type there is what gets submitted.
- **Autosave:** the draft saves while you type. If saving fails, a "Try saving again" button appears and works. A submitted application is never overwritten.
- **Failure and retry:**
  - If the resume upload fails, the error appears next to the resume field and nothing is submitted.
  - If submitting fails, you can retry **without uploading the resume again**.
  - If you pick a different resume or remove it, the old uploaded file is cleaned up.
  - Leaving the page cleans up an unused upload.
- **Resume rules:** PDF only, not empty, at most 2 MB, at most 25 pages, and drag and drop.

### Backend and security
- **Who can do what:** signed-out users can't save drafts or view dashboards, and one applicant can't delete another applicant's resume.
- Error messages shown to users are friendly and never leak internal details.
- The upload endpoint only accepts uploads from approved websites, and it cleans up correctly if storing a file fails.
- The maintenance tools (wipe all data, one-time data cleanup) handle large amounts of data correctly.

### Profile page and app shell
- The profile shows sensible fallbacks when a name, school, or year is missing.
- The app starts with the right setup in each mode (real backend, mock/demo mode, or no backend configured).
- Each web address goes to the right page, and unknown addresses redirect home.
- The animated storm background handles graphics failures and respects the "reduce motion" accessibility setting.

---

## How the coverage check works

**One settings file:** [`scripts/coverage-policy.mjs`](../scripts/coverage-policy.mjs). It defines:

1. **The minimum:** 85% for all four metrics.
2. **What gets measured:** all app code. A file with no tests counts as 0%; it isn't silently skipped.
3. **The seven areas** and which folders belong to each.
4. **What's excluded, and why.** Only files that aren't real app logic are excluded:

| Excluded file | Why |
| --- | --- |
| Type declaration files (`*.d.ts`) | They contain no code that runs |
| `convex/_generated/` | Generated automatically by Convex |
| `convex/auth.config.ts` | Configuration read by the Convex platform |
| `convex/crons.ts` | Just a schedule; the job it schedules is tested directly |
| `shared/registration/countries.ts` | Country list generated by a script |
| `shared/registration/mlhSchools.ts` | School list generated by a script |

**To change the threshold,** edit `MINIMUM` in that one file. Everything else reads it from there.

### Running it yourself

```bash
npm run test:unit:coverage    # run the tests; fails if coverage is too low
npm run test:coverage:check   # print the coverage table by area
```

### In CI (GitHub Actions)

On every pull request, the **quality** job:
1. Runs all unit tests with coverage and **fails if anything is below 85%**.
2. Posts a coverage table by area in the job summary.
3. Saves the full coverage report (browsable HTML) as a downloadable artifact called `unit-coverage`.

---

## Problems found along the way

| Issue | Status |
| --- | --- |
| **The one-time data cleanup would crash with more than 100 applicants.** It asked the database for page after page of results in one go, which Convex doesn't allow. | ✅ **Fixed** in `convex/migrations.ts` |
| After a failed upload or submission, the form tries to move keyboard focus to the resume field, but the field is disabled and hidden at that moment. The page scrolls to it, but keyboard users lose their place. | ⚠️ Not fixed; small accessibility follow-up |
| If the app is misconfigured with no backend, the password-reset screen says "This code is invalid or has expired" on the email step, which is confusing. | ⚠️ Not fixed; only happens in a broken setup |
| `src/pages/Profile/ProfileSection.tsx` isn't used anywhere. | ⚠️ Not fixed; can probably be deleted |
| Two form tests that fill in the whole application sometimes run just over the 5-second time limit when the full suite runs with coverage. The first full run failed them; the second passed. | ⚠️ Not fixed; raising those two tests' time limit to 15 seconds would stop the random failures |

---

## Files that changed

**New test files** (in `tests/unit/`)

| File | What it covers |
| --- | --- |
| `sign-in-convex.test.tsx` | Sign-in, code resend, and password reset against the (simulated) real backend |
| `auth-components.test.tsx` | Code input boxes, page guards, sign-out, demo-mode sign-in |
| `hackuta-password.test.ts` | Backend rules for sign-up, sign-in, and password reset |
| `convex-auth-config.test.ts` | Email code generation and rate-limited sending |
| `backend-authorization.test.ts` | Permissions, profile updates, upload cleanup, maintenance tools |
| `register-form-workflows.test.tsx` | Autosave, upload and submit failures, retrying |
| `app-shell.test.tsx` | App startup, routing, background visuals, layout pieces |

**New helper:** `tests/fixtures/fillApplicationForm.ts` fills in the whole form for tests. It was moved out of an existing test so other tests can reuse it.

**Existing test files extended** with more edge cases: error messages, OTP limits, input cleaning, draft saving, resume rules, form validation, rate limits, PDF checks, upload security, email templates, the resume widget, dropdowns, the profile page, sign-in, password reset, session handling, and the weather toggle.

**Settings and tooling**
- `scripts/coverage-policy.mjs`: new file holding the coverage rules.
- `vitest.config.ts`: now uses those rules.
- `scripts/check-coverage.mjs`: rewritten to report coverage by area and post it to CI.
- `.github/workflows/ci.yml`: publishes the coverage summary and report.
- `.nycrc.json`: updated to match the new rules.
- `package.json`: adds `picomatch`, which the coverage script uses to match file paths.

**App code:** `convex/migrations.ts` (the bug fix above).

**Docs:** `docs/TESTING.md`, `README.md`, `tests/README.md`, `scripts/README.md`.
