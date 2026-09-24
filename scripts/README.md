# Build and ops scripts (`scripts/`)

Node scripts invoked from npm lifecycle hooks, local setup, or CI. Not imported by the app at runtime.

## Overview

| Script | When to run | Summary |
| --- | --- | --- |
| [ensure-convex-server-stub.mjs](ensure-convex-server-stub.mjs) | pretypecheck, pretest:unit, prebuild | Copies [convex-server-stub.ts](convex-server-stub.ts) → convex/_generated/server.ts |
| [convex-server-stub.ts](convex-server-stub.ts) | (via ensure script) | Minimal Convex server generics for local typecheck and Vitest |
| [verify-production-env.mjs](verify-production-env.mjs) | prebuild | Blocks production Vercel builds when VITE_USE_MOCK_API=true |
| [verify-convex-deployment.mjs](verify-convex-deployment.mjs) | npm run convex:verify | Smoke-test deployed Convex: hackathon query + authenticated routing |
| [generateAuthKeys.mjs](generateAuthKeys.mjs) | Local / new deployment setup | Generate RS256 JWT keys and set JWT_PRIVATE_KEY / JWKS on linked Convex deployment |
| [sync-dev-convex-env.mjs](sync-dev-convex-env.mjs) | Dev deployment setup | Copy SMTP vars from prod; set localhost SITE_URL and resume upload origins |
| [check-coverage.mjs](check-coverage.mjs) | npm run test:coverage:check | Enforce the coverage policy on unit (+ optional Playwright) coverage; prints a per-area table and writes the CI step summary |
| [coverage-policy.mjs](coverage-policy.mjs) | (imported) | Single source of truth for coverage scope, documented exclusions, and 85% per-area thresholds |
| [generate-countries.mjs](generate-countries.mjs) | Manual maintenance | Regenerate [shared/registration/countries.ts](../shared/registration/countries.ts) from ISO 3166 JSON |
| [generate-mlh-schools.mjs](generate-mlh-schools.mjs) | Manual maintenance | Regenerate [shared/registration/mlhSchools.ts](../shared/registration/mlhSchools.ts) from MLH schools.csv |

## Convex codegen workflow

| Step | Command |
| --- | --- |
| Live codegen (push + bindings) | npx convex dev or npx convex codegen |
| Offline typecheck / unit tests | node scripts/ensure-convex-server-stub.mjs then npm run typecheck / npm run test:unit |

Generated API types land in convex/_generated/ (gitignored). See [convex/README.md](../convex/README.md).

## Deployment verification

verify-convex-deployment.mjs requires:

| Variable | Purpose |
| --- | --- |
| VITE_CONVEX_URL | Convex WebSocket URL |
| CONVEX_AUTH_TOKEN | JWT for an authenticated test user |

It queries applicant:getApplicantRoutingState and applications:getMyApplicantDashboard.

## Data generators

Place MLH school source CSV at [shared/registration/data/schools.csv](../shared/registration/data/schools.csv), then:

```bash
node scripts/generate-mlh-schools.mjs
node scripts/generate-countries.mjs
```

Commit the regenerated TypeScript modules with the updated data.

## Related

| Location | Role |
| --- | --- |
| [package.json](../package.json) | npm script entry points |
| [docs/OPERATIONS.md](../docs/OPERATIONS.md) | Deploy checklist and env vars |
| [README.md](../README.md) | Local setup |

Parent index: [README.md](../README.md).
