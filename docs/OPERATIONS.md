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
5. **Smoke test:** sign-up + OTP, sign-in, draft autosave, submit test application, resume upload
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
# SMTP, JWT keys, EMAIL_FROM
```

JWT keys: `node scripts/generateAuthKeys.mjs` — generate **per environment**, never reuse prod keys in dev.

Dev sync helper: `node scripts/sync-dev-convex-env.mjs` (copies mail settings, sets localhost origins).

## Scheduled maintenance

| Job | Schedule | Function |
| --- | --- | --- |
| Resume session cleanup | Every 15 min | `resumeUploads:cleanupExpiredUploadSessions` |

Defined in `convex/crons.ts`. Removes expired upload sessions and orphaned storage.

## Common operator tasks

| Task | Command |
| --- | --- |
| Update hackathon display name | `npx convex run eventConfig:setHackathonName '{ "name": "HackUTA 2026" }'` |
| Remove an orphaned table (not in schema) | Convex dashboard → **Data** → table → **⋮** → **Delete table** |
| Reset all data (**destructive**) | Convex dashboard → internal `maintenance:resetAllData` |
| Clear OTP rate limit for email | Convex dashboard → internal `rateLimits:clearOtpSendLimitsForEmail` |
| Unset stale env var | `npx convex env unset VAR_NAME` |

## Monitoring & incidents

### What to watch

- **Convex dashboard:** function error rates, HTTP action 4xx/5xx on `/resume-upload`
- **Vercel:** deployment status, edge 5xx
- **SMTP:** OTP and confirmation email delivery (cPanel mail logs)
- **CI:** GitHub Actions on `main` / `dev`

### Symptom → likely cause

| Symptom | Check |
| --- | --- |
| OTP not received | SMTP env vars, SPF/DKIM, rate limit (5/hour) |
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
