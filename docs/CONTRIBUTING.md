# Contributing

Guidelines for changes to the registration repo.

## Prerequisites

- Node.js 22+
- Convex CLI
- Read [ARCHITECTURE.md](ARCHITECTURE.md) and [README.md](../README.md) setup

## Workflow

1. Branch from `dev` (or `main` for hotfixes)
2. Make focused changes — match existing patterns in surrounding code
3. Run locally before opening PR:

```bash
npm run lint
npm run typecheck
npm run test:unit:coverage
npm run build
```

4. Open PR to `dev` or `main`; CI must pass

## Code conventions

| Area | Convention |
| --- | --- |
| Validation | Shared Zod/manual validators in `shared/`; used by client **and** Convex |
| Security strings | Sanitize in `shared/lib/sanitizeInput.ts`; don’t duplicate regex |
| Errors (applicant-facing) | Add messages to `shared/registration/submitErrors.ts` allowlists |
| CSP | Edit `security/csp.ts` + `vercel.json` together |
| Convex functions | Typed args (`v.*`); avoid `v.any()` for user payloads |
| Tests | Colocate in `tests/unit/`; name `*.test.ts` |

## Do not

- Commit `.env.local`, SMTP passwords, or JWT private keys
- Set `VITE_USE_MOCK_API=true` on production Vercel
- Set `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS` on production Convex
- Add `dangerouslySetInnerHTML` for user content
- Skip server-side validation because the client already validates

## Documentation

Update docs when you change:

| Change | Update |
| --- | --- |
| New/changed API | [API.md](API.md) |
| Security behavior | [SECURITY.md](SECURITY.md) |
| Deploy/env vars | [README.md](../README.md), [OPERATIONS.md](OPERATIONS.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |

## Related docs

- [TESTING.md](TESTING.md)
- [SECURITY.md](SECURITY.md)
