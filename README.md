# HackUTA 2026 — Register

Sign-up, sign-in, application (with draft autosave), and applicant profile for **HackUTA 2026** — a 24-hour hackathon at the University of Texas at Arlington (**November 14–15, 2026**).

Contact form lives in [hackuta-2026-registration](https://github.com/aroudrasthakur/hackuta-2026-registration).

This app deploys separately from the marketing landing page ([hackuta-2026-repository](https://github.com/aroudrasthakur/hackuta-2026-repository)). The landing site’s “Apply” button links here.

| Environment | Frontend | Convex |
| --- | --- | --- |
| Shared dev | [127.0.0.1:5273](http://127.0.0.1:5273) | standing-manatee-425 |
| Local personal | [127.0.0.1:5273](http://127.0.0.1:5273) | npx convex dev (your deployment) |
| Production | [register.hackuta.com](https://register.hackuta.com) | <ask director> |

Organizer contact: [hello@hackuta.org](mailto:hello@hackuta.org)

## Related repositories

| Repo                                                                                 | Role                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------- |
| [hackuta-2026-repository](https://github.com/aroudrasthakur/hackuta-2026-repository) | Public marketing site (`hackuta.com`)       |
| **hackuta-2026-register** (this repo)                                                | Auth, application form, draft save, profile |

## Stack

- **Frontend:** Vite, React 19, TypeScript, Tailwind CSS v4, React Router 7
- **Backend:** [Convex](https://convex.dev) — database, file storage, HTTP actions, scheduled jobs
- **Auth:** [@convex-dev/auth](https://labs.convex.dev/auth) password sign-up/sign-in + 6-digit email OTP verification (cPanel SMTP)
- **Validation:** Zod schemas shared between client and Convex (`shared/`)
- **Testing:** Vitest (unit), Playwright (e2e + accessibility), 80% Istanbul coverage thresholds

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/API.md](docs/API.md) | Endpoints, payloads, errors, validation, rate limits |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Codebase layout, data flows, design decisions |
| [docs/SECURITY.md](docs/SECURITY.md) | Input validation, CSP, upload hardening, secrets |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Deploy checklist, env vars, maintenance, incidents |
| [docs/TESTING.md](docs/TESTING.md) | Unit/e2e tests, CI, coverage |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | PR workflow and conventions |
| [docs/DESIGN.md](docs/DESIGN.md) | Odyssey theme, palette, UX principles |
| [.env.example](.env.example) | Environment variable template |

### Directory READMEs

| Path | Contents |
| --- | --- |
| [convex/README.md](convex/README.md) | Backend modules, public API, ops commands |
| [src/README.md](src/README.md) | React SPA routes and bootstrap |
| [shared/README.md](shared/README.md) | Isomorphic validation and constants |
| [tests/README.md](tests/README.md) | Unit and e2e test map |
| [scripts/README.md](scripts/README.md) | Codegen stub, deploy verify, generators |
| [public/README.md](public/README.md) | Static fonts, images, trusted-types |
| [security/README.md](security/README.md) | CSP and response headers |

## Getting started

### Prerequisites

- Node.js 22+
- A Convex account and CLI (`npm i -g convex` or use `npx convex`)
- cPanel mailbox credentials for OTP and confirmation email (production)

### Local setup

```bash
npm install
cp .env.example .env.local   # fill in VITE_CONVEX_URL and VITE_CONVEX_SITE_URL
node scripts/generateAuthKeys.mjs
npx convex dev               # second terminal: pushes schema, prints deployment URL
npm run dev
```

Open [http://127.0.0.1:5273](http://127.0.0.1:5273).

Copy the Convex deployment URL from `npx convex dev` into `.env.local`:

```bash
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
VITE_CONVEX_SITE_URL=https://<your-deployment>.convex.site
CONVEX_DEPLOYMENT=dev:<your-deployment>
```

Configure your **dev** Convex deployment (`standing-manatee-425`):

```bash
node scripts/generateAuthKeys.mjs   # JWT keys (dev-only; do not copy from prod)
node scripts/sync-dev-convex-env.mjs # SMTP/email from prod + localhost origin allowlist
```

`sync-dev-convex-env.mjs` sets dev-specific `SITE_URL`, localhost CORS, and copies shared mail settings from production. Localhost origins are ignored on production unless `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS` is set — keep that unset on prod.

### Production deploy

1. **Convex:** `npm run convex:deploy` (or `npx convex deploy --prod`)
2. **Vercel:** connect repo; set build env vars (see [Environment variables](#environment-variables))
3. Set Convex **production** deployment vars: `SITE_URL`, `REGISTRATION_ALLOWED_ORIGINS`, SMTP, JWT keys. Do **not** set `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS` on production.

```bash
npx convex env set --prod SITE_URL https://register.hackuta.com
npx convex env set --prod REGISTRATION_ALLOWED_ORIGINS https://register.hackuta.com
npx convex env unset --prod REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS
```

## Application flow

```
/sign-in  →  password + email OTP (sign-up)  →  /register (new) or /profile (returning)
                ↓
         draft autosave on /register (profiles table)
```

1. Visitor opens `/sign-in` and creates an account (email, password, confirm) or signs in with existing credentials.
2. New accounts receive a 6-digit verification code (10-minute expiry) via SMTP.
3. After verification, Convex Auth establishes a JWT session and ensures a draft `profiles` row exists.
4. The app routes to `/register` (not yet submitted) or `/profile` (already submitted).
5. On `/register`, form fields autosave every ~800ms; applicants can leave and resume later.
6. Resume upload goes to a Convex HTTP action; the returned upload token is redeemed at `registrations:register`. Unneeded uploads can be discarded via `resumeUploads:discardUploadSession`.
7. Sign-out returns the visitor to `/sign-in`.

### OTP rate limits

| Limit                  | Value                                              |
| ---------------------- | -------------------------------------------------- |
| Resend cooldown        | 30 seconds (shared across email step and OTP step) |
| Sends per hour         | 5 per email address                                |
| Code expiry            | 10 minutes                                         |
| Failed verify attempts | 5 per hour (Convex Auth)                           |

See [docs/API.md](docs/API.md#rate-limits) for server-side enforcement details.

## Frontend routes

| Path        | Access                           | Purpose                                                                          |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `/`         | Public                           | Redirects authenticated users to `/register` or `/profile`; others to `/sign-in` |
| `/sign-in`  | Public                           | Password sign-up / sign-in + OTP verify                                          |
| `/register` | Authenticated, not yet submitted | Multi-step application form with draft autosave                                  |
| `/profile`  | Authenticated                    | Applicant dashboard (status, timeline, sign-out)                                 |

## Environment variables

### Vite (build-time — set in Vercel or `.env.local`)

| Variable               | Required | Purpose                                                                 |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `VITE_CONVEX_URL`      | Yes      | Convex deployment URL (`https://<name>.convex.cloud`)                   |
| `VITE_CONVEX_SITE_URL` | Yes      | Convex HTTP actions URL (`https://<name>.convex.site`)                  |
| `VITE_LANDING_URL`     | Yes      | Marketing site for “back to home” links (prod: `https://hackuta.com`)   |
| `VITE_USE_MOCK_API`    | No       | `true` bypasses Convex Auth for UI dev/CI; **never** on live production |
| `CONVEX_DEPLOYMENT`    | Local/CI | Convex CLI deployment selector                                          |

### Convex deployment (`npx convex env set`)

| Variable                                               | Purpose                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `SITE_URL`                                             | Frontend origin for Convex Auth redirects                                                        |
| `REGISTRATION_ALLOWED_ORIGINS`                         | Comma-separated browser origins allowed for resume upload CORS (also includes `SITE_URL` origin) |
| `JWT_PRIVATE_KEY`, `JWKS`                              | Convex Auth signing keys (from `scripts/generateAuthKeys.mjs`)                                   |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | cPanel SMTP                                                                                      |
| `EMAIL_FROM`                                           | From address for outbound mail                                                                   |
| `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS`                 | Dev only — allow `localhost:5273` resume uploads                                                 |

**Do not** set SMTP or JWT values as `VITE_*` — they belong only on the Convex deployment.

### cPanel SMTP

Find settings under **Email Accounts → Connect Devices**:

```bash
npx convex env set SMTP_HOST mail.example.com
npx convex env set SMTP_PORT 465          # 465 = implicit TLS; 587 = STARTTLS
npx convex env set SMTP_USER noreply@hackuta.org
npx convex env set SMTP_PASSWORD your-mailbox-password
npx convex env set EMAIL_FROM noreply@hackuta.org
```

Configure SPF and DKIM under cPanel **Email Deliverability**. Test by creating an account and requesting a verification code.

## Mock mode

When `VITE_USE_MOCK_API=true`:

- Convex Auth is bypassed via `MockAuthProvider`.
- Mock OTP code: **`042681`**
- Registration submissions succeed without SMTP or authenticated Convex mutations.

CI builds with mock mode enabled for Playwright CSP tests. Live Vercel production deploys must leave this unset or `false`.

## Project layout

| Path | README | Role |
| --- | --- | --- |
| convex/ | [convex/README.md](convex/README.md) | Schema, mutations, actions, HTTP routes, auth, email |
| src/ | [src/README.md](src/README.md) | React SPA — sign-in, register, profile |
| shared/ | [shared/README.md](shared/README.md) | Zod validation, enums, resume policy (client + Convex) |
| public/ | [public/README.md](public/README.md) | Fonts, Odyssey art, logos, trusted-types |
| security/ | [security/README.md](security/README.md) | CSP + response headers (sync with vercel.json) |
| scripts/ | [scripts/README.md](scripts/README.md) | Codegen stub, deploy verify, MLH/country generators |
| tests/ | [tests/README.md](tests/README.md) | Vitest unit tests and Playwright e2e |
| docs/ | [docs/README.md](docs/README.md) | API, architecture, security, operations, testing |

## Scripts

| Script                       | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `npm run dev`                | Vite dev server on `127.0.0.1:5273`                |
| `npm run build`              | Typecheck and production build to `dist/`          |
| `npm run preview`            | Serve `dist/` with production CSP headers          |
| `npm run lint`               | ESLint over app, Convex, shared, security, scripts |
| `npm run typecheck`          | App/test types plus Convex schema                  |
| `npm run test:unit`          | Vitest                                             |
| `npm run test:unit:coverage` | Vitest with 80% Istanbul thresholds                |
| `npm run test:e2e`           | Playwright against dev server or production build  |
| `npm run convex:dev`         | Convex dev deployment watcher                      |
| `npm run convex:deploy`      | Push functions and schema to Convex                |
| `npm run convex:verify`      | Verify deployment connectivity                     |

Run Playwright against the production build (same path CI uses):

```bash
PLAYWRIGHT_USE_BUILD=true npm run test:e2e
```

## CI

GitHub Actions on pushes/PRs to `main` and `dev`:

| Job                  | Steps                                                          |
| -------------------- | -------------------------------------------------------------- |
| **quality**          | lint → typecheck → unit tests with coverage → production build |
| **e2e**              | Playwright against uploaded production build artifact          |
| **dependency-audit** | `npm audit --omit=dev --audit-level=high`                      |
| **secrets**          | Gitleaks full-history scan                                     |

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Security notes

See [docs/SECURITY.md](docs/SECURITY.md) for the full security model. Summary:

- Strict CSP + Trusted Types (`security/csp.ts`, synced with `vercel.json`)
- Server-side input sanitization on registration forms
- Resume uploads: PDF-only allowlist, Content-Length pre-check, isolated Convex storage, rate limits
- OTP codes hashed; registration email taken from verified JWT only

## Maintenance

| Task                          | Command                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Seed hackathon record         | `npx convex run seed:seedHackathon`                                                                            |
| Reset all data                | Convex dashboard → internal `maintenance:resetAllData` (or `npx convex run maintenance:resetAllData --prod`)   |
| Clear OTP limits for an email | Run internal mutation `rateLimits:clearOtpSendLimitsForEmail` from the Convex dashboard (Functions → internal) |

Resume upload sessions and stale rate-limit rows are purged automatically every 15 minutes via `resumeUploads:cleanupExpiredUploadSessions` in [convex/crons.ts](convex/crons.ts).
