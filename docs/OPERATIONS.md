# Operations

Deploy, configure, monitor, and maintain the registration app in production.

## Deployments

| Environment | Frontend | Convex deployment |
| --- | --- | --- |
| Production | `register.hackuta.com` (Vercel) | `brilliant-ostrich-892` |
| Shared dev | — | `standing-manatee-425` |
| Personal local | `127.0.0.1:5273` | `npx convex dev` |

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
| `VITE_CONVEX_URL` | `https://brilliant-ostrich-892.convex.cloud` |
| `VITE_CONVEX_SITE_URL` | `https://brilliant-ostrich-892.convex.site` |
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

## Scheduled maintenance

| Job | Schedule | Function |
| --- | --- | --- |
| Resume session cleanup | Every 15 min | `resumeUploads:cleanupExpiredUploadSessions` |

Defined in `convex/crons.ts`. Removes expired upload sessions and orphaned storage.

## Common operator tasks

| Task | Command |
| --- | --- |
| Update hackathon display name | `npx convex run eventConfig:setHackathonName '{ "name": "HackUTA 2026" }'` |
| Migrate legacy beef/pork answers to dietary restrictions | Convex dashboard → internal `migrations:migrateEatsBeefAndPorkToDietaryRestrictions` (one-time; maps `"No"` only) |
| Migrate legacy `otherDietary` to `allergyDetails` | `npx convex run migrations:migrateOtherDietaryToAllergyDetails` (add `--prod` for production). Legacy schema field removed; run before deploy if old rows remain. |
| Migrate legacy `firstHackathon` yes/no to `hackathonsAttended` | `npx convex run migrations:migrateFirstHackathonToHackathonsAttended` (add `--prod` for production). |
| Migrate merged Other/self-describe answers to `other*` columns | `npx convex run migrations:migrateMergedOtherFieldsToSeparateColumns` (add `--prod` for production). |
| Migrate legacy code-of-conduct consent to `mlhCodeOfConductAgreed` | `npx convex run migrations:migrateLegacyCodeOfConductFields` (add `--prod` for production). |
| Rename legacy agreement `*SubmittedAt` columns to `*At` | `npx convex run migrations:migrateLegacyAgreementSubmittedAtFields` (add `--prod` for production). |
| Strip legacy check-in / confirmed timestamps | Convex dashboard → internal `migrations:stripLegacyApplicationCheckInAndConfirmedAt` |
| Remove an orphaned table (not in schema) | Convex dashboard → **Data** → table → **⋮** → **Delete table** |
| Reset all data (**destructive**) | Convex dashboard → internal `maintenance:resetAllData` |
| Clear sign-up OTP rate limit for email | Convex dashboard → internal `rateLimits:clearOtpSendLimitsForEmail` |
| Find emails sent to an address | Convex dashboard → internal `emailDeliveries:listEmailDeliveriesForRecipient` |
| Check whether a queued email was sent | Convex dashboard → internal `email/checkEmailStatus:checkEmailStatus` with the row's `serviceId` |
| Unset stale env var | `npx convex env unset VAR_NAME` |

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
