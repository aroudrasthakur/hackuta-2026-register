# Operations

Deploy, configure, monitor, and maintain the registration app in production.

## Deployments

| Environment | Frontend | Convex deployment |
| --- | --- | --- |
| Production | `register.hackuta.com` (Vercel) | — (not stored in repo; set in Vercel / Convex dashboard) |
| Shared dev | — | `standing-manatee-425` |
| Personal local | `127.0.0.1:5273` | `npx convex dev` |

### Deploy to shared dev

Push schema and backend functions to the shared dev deployment (`standing-manatee-425`) without starting a watch process:

```bash
npx convex dev --once --env-file .env.local
```

Requires `.env.local` with `CONVEX_DEPLOYMENT=dev:standing-manatee-425` (see [.env.example](../.env.example)). Personal Convex deployments use `npx convex dev` instead.

### Release checklist

1. **Quality gate:** `npm run lint && npm run typecheck && npm run test:unit:coverage && npm run build`
2. **Convex prod:** `npm run convex:deploy` (or `npx convex deploy --prod`)
3. **Verify env:** `npm run convex:verify` (if configured)
4. **Vercel:** push to `main` or promote deployment
5. **Smoke test:** sign-up + OTP, sign-in, forgot-password reset, draft autosave, submit test application, resume upload
6. **Confirm prod Convex env:** no `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS`; origins point to `register.hackuta.com` only

### Vercel environment variables

Set in project settings (Production + Preview as appropriate):

| Variable | Production value |
| --- | --- |
| `VITE_CONVEX_URL` | Set in Vercel — `https://<prod-deployment>.convex.cloud` (not stored in repo) |
| `VITE_CONVEX_SITE_URL` | Set in Vercel — `https://<prod-deployment>.convex.site` (not stored in repo) |
| `VITE_LANDING_URL` | `https://hackuta.com` |
| `VITE_USE_MOCK_API` | unset or `false` |

### Convex production environment

```bash
npx convex env set --prod SITE_URL https://register.hackuta.com
npx convex env set --prod REGISTRATION_ALLOWED_ORIGINS https://register.hackuta.com
npx convex env unset --prod REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS
npx convex env set --prod EMAIL_SERVICE_URL https://emailservice.hackuta.com
npx convex env set --prod EMAIL_SERVICE_API_KEY <api-key>
# JWT keys
```

JWT keys: `node scripts/generateAuthKeys.mjs` — generate **per environment**, never reuse prod keys in dev.

Dev sync helper: `node scripts/sync-dev-convex-env.mjs` (copies email service settings, sets localhost origins).

### Application review rollout

The first deployment is additive: it creates `applicationReviews` and writes a review when an application is submitted, but keeps the old `applications.status`, `updatedAt`, `reviewedAt`, and `reviewedBy` fields so existing rows and older code remain valid. Draft edits use `applicantUpdatedAt`; profile queries prefer the review row and fall back to legacy status until backfill is complete.

1. Deploy to a personal or shared dev deployment; test draft save, submit, confirmation email, and `/profile` before backfilling. Do not deploy a schema that removes the legacy fields yet.
2. Run `npx convex run migrations:backfillApplicationReviews '{}'`. Repeat with `'{"cursor":"<continueCursor>"}'` until `isDone` is true. The migration processes at most 50 applications per call, is safe to repeat, and preserves unrecognized historical reviewer strings as `legacyReviewedBy`.
3. Compare counts and decisions between submitted applications and review rows; investigate any nonzero `unresolvedDraftReviews` before removing old fields, and check historical `applicationSubmissionLogs` still load. Test `/profile` for a backfilled application before considering production.
4. After review and approval, repeat the additive deploy and backfill on production. Production currently runs backend code older than PR #88; coordinate that baseline upgrade separately.
5. Deploy the transitional review version **after** the additive backfill. New application flows do not set the old `applications.status` or `updatedAt` fields; existing rows keep their old values until the guarded strip, and the schema accepts both row shapes.
6. With explicit approval, run `npx convex run migrations:stripApplicationReviewFields '{}'` on dev. Repeat with `'{"cursor":"<continueCursor>"}'` until `isDone` is true; every page must report `blocked: 0`. Investigate blocked rows before continuing. Verify the old fields are gone, historical submission logs load, and draft/submission/profile flows still work. Only then repeat on production under a separately approved rollout.
7. In a **final** deploy, after every target deployment has zero remaining legacy application fields, remove their validators and `applications.by_status`. The final code no longer exports either review migration; use the earlier deployed stages for steps 2 and 6. Never deploy the final strict schema directly onto unmigrated data.

## Scheduled maintenance

| Job | Schedule | Function |
| --- | --- | --- |
| Resume session cleanup | Every 15 min | `resumeUploads:cleanupExpiredUploadSessions` |

Defined in `convex/crons.ts`. Removes expired upload sessions and orphaned storage.

## Common operator tasks

| Task | Command |
| --- | --- |
| Deploy schema/functions to shared dev | `npx convex dev --once --env-file .env.local` |
| Update hackathon display name | `npx convex run eventConfig:setHackathonName '{"name":"HackUTA 2026"}'` |
| Set application opening time | `npx convex run eventConfig:setTimelineDates '{"registrationOpensAt":<ms>}'` |
| Set or clear application closing time | `npx convex run eventConfig:setRegistrationClosesAt '{"closesAt":<ms>}'` or `'{"closesAt":null}'` |
| Set or clear decisions date | `npx convex run eventConfig:setTimelineDates '{"decisionsReleasedAt":<ms>}'` or `'{"decisionsReleasedAt":null}'` |
| Update hackathon start/end | `npx convex run eventConfig:setTimelineDates '{"startsAt":<ms>,"endsAt":<ms>}'` |
| Verify resolved schedule | `npx convex run eventConfig:getPublicEventConfig '{}'` |
| Migrate legacy beef/pork answers to dietary restrictions | Convex dashboard → internal `migrations:migrateEatsBeefAndPorkToDietaryRestrictions` (one-time; maps `"No"` only) |
| Migrate legacy `otherDietary` to `allergyDetails` | `npx convex run migrations:migrateOtherDietaryToAllergyDetails` (add `--prod` for production). Legacy schema field removed; run before deploy if old rows remain. |
| Migrate legacy `firstHackathon` yes/no to `hackathonsAttended` | `npx convex run migrations:migrateFirstHackathonToHackathonsAttended` (add `--prod` for production). |
| Migrate merged Other/self-describe answers to `other*` columns | `npx convex run migrations:migrateMergedOtherFieldsToSeparateColumns` (add `--prod` for production). |
| Migrate legacy code-of-conduct consent to `mlhCodeOfConductAgreed` | `npx convex run migrations:migrateLegacyCodeOfConductFields` (add `--prod` for production). |
| Rename legacy agreement `*SubmittedAt` columns to `*At` | `npx convex run migrations:migrateLegacyAgreementSubmittedAtFields` (add `--prod` for production). |
| Strip legacy check-in / confirmed timestamps | Convex dashboard → internal `migrations:stripLegacyApplicationCheckInAndConfirmedAt` |
| Strip removed `internalNotes` field | `npx convex run migrations:stripInternalNotesFromApplications` (add `--prod` for production) |
| Strip removed `eligibilityStatus` field | `npx convex run migrations:stripEligibilityStatusFromApplications` (add `--prod` for production) |
| Strip removed `confirmationStatus` field | `npx convex run migrations:stripConfirmationStatusFromApplications` (add `--prod` for production) |
| Remove an orphaned table (not in schema) | Convex dashboard → **Data** → table → **⋮** → **Delete table** |
| Reset all data (**destructive**) | Convex dashboard → internal `maintenance:resetAllData` |
| Clear sign-up OTP rate limit for email | Convex dashboard → internal `rateLimits:clearOtpSendLimitsForEmail` |
| Find emails sent to an address | Convex dashboard → internal `emailDeliveries:listEmailDeliveriesForRecipient` |
| Check whether a queued email was sent | Convex dashboard → internal `email/checkEmailStatus:checkEmailStatus` with the row's `serviceId` |
| Unset stale env var | `npx convex env unset VAR_NAME` |

### Event timeline and registration window

The `eventConfig` table holds **one row** with `key: "current"`. Operators update it at runtime via internal Convex mutations — no frontend redeploy required. Applicants cannot call these mutations.

#### Schema fields

| Column | Stored as | Notes |
| --- | --- | --- |
| `name` | string | Display name (e.g. `HackUTA 2026`) |
| `registrationOpensAt` | integer (UTC ms) or omitted | When draft save/submit becomes allowed |
| `registrationClosesAt` | integer or `null` | `null` = no close date (applications stay open) |
| `decisionsReleasedAt` | integer or `null` | `null` = timeline shows “To be announced” |
| `startsAt` | integer (UTC ms) or omitted | Hackathon start |
| `endsAt` | integer (UTC ms) or omitted | Hackathon end |
| `updatedAt` | integer (UTC ms) | Set automatically by mutations |

**Date format:** store **UTC epoch milliseconds** (a plain integer like `1790460000000`). Do **not** use ISO strings (`"2026-11-14"`) or human-readable dates in the dashboard or CLI — validation rejects invalid values.

Applicant-facing labels format these timestamps in **`America/Chicago`** (CDT or CST depending on the date).

#### Code defaults and read-time fallback

Even when the `eventConfig` table is **empty**, `eventConfig:getPublicEventConfig` still returns dates. It merges any DB row with hardcoded defaults in `shared/hackathon/schedule.ts` (`HACKATHON_SCHEDULE`) and the name from `DEFAULT_HACKATHON_NAME`:

| Field | Code default (Central) | Default ms |
| --- | --- | --- |
| `name` | HackUTA 2026 | (not a timestamp) |
| `registrationOpensAt` | Sep 25, 2026 12:00 AM | `1790312400000` |
| `registrationClosesAt` | none | `null` |
| `decisionsReleasedAt` | none | `null` |
| `startsAt` | Nov 14, 2026 9:00 AM | `1794668400000` |
| `endsAt` | Nov 15, 2026 6:00 PM | `1794787200000` |

The first mutation that needs config (`ensureEventConfig`) seeds a row with these defaults. Supplying `null` via `setTimelineDates` for **close/decisions** clears the override; `null` for **open/start/end** resets to the code defaults above.

#### Compute timestamps

Pick the exact local time in Central, then convert to ms:

```bash
node -e "console.log(Date.parse('2026-09-26T17:00:00-05:00'))"
```

Use **CDT (`-05:00`)** during daylight saving and **CST (`-06:00`)** otherwise — do not assume a fixed offset year-round.

PowerShell:

```powershell
[DateTimeOffset]::Parse("2026-09-26T17:00:00-05:00").ToUnixTimeMilliseconds()
```

Sanity-check before applying:

```bash
node -e "console.log(new Date(<ms>).toLocaleString('en-US',{timeZone:'America/Chicago'}))"
```

#### Chronological validation

`setTimelineDates` validates the **merged** schedule atomically. After applying your patch, all of the following must hold:

1. `registrationOpensAt` < `startsAt` < `endsAt`
2. If `registrationClosesAt` is set: `registrationOpensAt` < `registrationClosesAt` ≤ `startsAt`
3. If `decisionsReleasedAt` is set: it must be ≥ `registrationOpensAt`, ≥ `registrationClosesAt` (when set), and **≤ `startsAt`** (decisions must fall before hackathon start)

A date after hackathon start (e.g. December 3) will fail with `Event dates must be in chronological order.`

Changing `decisionsReleasedAt` only updates the profile timeline label — it does **not** send decision emails.

#### Example commands

Add `--prod` only after separately confirming the production deployment target.

```bash
# Applications open Sep 26, 2026 5:00 PM CDT
npx convex run eventConfig:setTimelineDates '{"registrationOpensAt":1790460000000}'

# Decisions Nov 12, 2026 12:00 PM CST
npx convex run eventConfig:setTimelineDates '{"decisionsReleasedAt":1794506400000}'

# Clear decisions (back to “To be announced”)
npx convex run eventConfig:setTimelineDates '{"decisionsReleasedAt":null}'

# Set application close time, or reopen
npx convex run eventConfig:setRegistrationClosesAt '{"closesAt":1792000000000}'
npx convex run eventConfig:setRegistrationClosesAt '{"closesAt":null}'

# Hackathon start/end (defaults shown above)
npx convex run eventConfig:setTimelineDates '{"startsAt":1794668400000,"endsAt":1794787200000}'

# Verify what applicants will see
npx convex run eventConfig:getPublicEventConfig '{}'
```

Only pass the fields you intend to update. Before opening or at/after closing, the backend rejects draft writes and submissions; saved drafts remain readable and submitted profiles remain accessible.

## Monitoring & incidents

### What to watch

- **Convex dashboard:** function error rates, HTTP action 4xx/5xx on `/resume-upload`
- **Vercel:** deployment status, edge 5xx
- **Email service:** Sign-up OTP, password-reset OTP, and confirmation email delivery (`emailservice.hackuta.com/health`, `/queue-size`; per-email status via `email/checkEmailStatus`)
- **Email tracking gaps:** rows in `emailDeliveryRecordingFailures` (Convex dashboard → **Data**) — queued emails whose `emailDeliveries` row failed to save; use `serviceId` with `email/checkEmailStatus`
- **CI:** GitHub Actions on `main` / `dev`

### Symptom → likely cause

| Symptom | Check |
| --- | --- |
| OTP not received | `EMAIL_SERVICE_URL` / `EMAIL_SERVICE_API_KEY`, email service `/health`, the email's status (`emailDeliveries` or `emailDeliveryRecordingFailures` → `checkEmailStatus`), spam folder, rate limit (5/hour per bucket: `otp_send`, `password_reset_send`) |
| Resume upload 403 | `REGISTRATION_ALLOWED_ORIGINS` vs actual frontend URL |
| Resume upload 429 | IP or global upload rate limit; possible abuse |
| Submit fails “already submitted” | Expected — one submission per user |

### Incident response (upload abuse)

1. Confirm spike in `/resume-upload` 429s in Convex logs
2. Origin allowlist already blocks non-register domains
3. Rate limits auto-recover after 10 minutes per IP
4. If needed, temporarily tighten global limit in `convex/resumeUploads.ts` and redeploy

## Backups & data retention

Convex Cloud holds authoritative data. There is no self-managed DB backup in this repo — use Convex dashboard export/support for recovery questions.

Resume PDFs live in `_storage`. Replacing a resume deletes the previous blob on successful re-submit.

## Related docs

- [SECURITY.md](SECURITY.md)
- [README.md — Environment variables](../README.md#environment-variables)
