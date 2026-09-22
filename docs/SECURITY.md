# Security

How HackUTA registration protects applicant data, blocks abuse, and limits attack surface.

## Threat model (summary)

| Asset | Primary risks | Mitigations |
| --- | --- | --- |
| Applicant PII | XSS, stored injection, admin export | Server validation, React text rendering, email HTML escaping |
| Auth sessions | OTP brute force, enumeration | Rate limits, hashed codes, generic errors |
| Resume uploads | Malware, DoS, storage abuse | Allowlist, size caps, isolated Convex storage, rate limits |
| Contact form | Spam, header injection, XSS | Honeypot, CRLF block, sanitization, rate limits |
| Frontend | Script injection, clickjacking | Strict CSP, Trusted Types, HSTS |

There is **no SQL layer** — Convex uses typed queries. Injection focus is on **XSS** and **upload abuse**.

## Defense layers

```
Browser CSP ──► Client Zod (UX) ──► Convex handler ──► Shared validation/sanitize ──► DB / storage
```

### Input validation

| Surface | Module | Server behavior |
| --- | --- | --- |
| Registration | `shared/registration/schema.ts` | Zod `.strict()`; rejects HTML/script patterns via `shared/lib/sanitizeInput.ts` |
| Contact | `shared/contact/validation.ts` | Length limits, email syntax, honeypot, CRLF rejection, sanitization |
| Resume upload | `convex/http.ts`, `convex/pdfValidation.ts` | See [Upload security](#resume-upload-security) |
| OTP email lookup | `rateLimits:getOtpSendCooldown` | Neutral response when rate-limited |

Free-text fields allow plain text only — no HTML tags, `javascript:` URLs, or event handlers.

### Email output

All user-derived values in HTML emails pass through `escapeHtml()` in `convex/email/templates.ts`. Contact `replyTo` rejects CRLF in addresses.

### Authentication

- Email OTP via `@convex-dev/auth` — codes hashed, 10-minute expiry, never logged or returned in API responses
- Registration email is **always** taken from the verified JWT, not from the form payload
- Admin query `getApplicationsByHackathon` requires `REGISTRATION_ADMIN_IDENTITY_KEYS`

### Content Security Policy

Defined in `security/csp.ts`; deployed via `vercel.json`. Tests in `tests/unit/security.test.ts` keep them in sync.

Key directives: `default-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, Trusted Types, `connect-src` limited to Convex + Vercel preview tooling.

Also deployed: HSTS, `X-Frame-Options: DENY`, Permissions-Policy (camera/mic disabled), Referrer-Policy.

### Origin policy (resume upload)

`convex/registrationSecurity.ts` builds the allowlist from `REGISTRATION_ALLOWED_ORIGINS` and `SITE_URL`. Dev deployment may set `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS=true` for localhost — **never on production**.

## Resume upload security

Uploads never touch the Vercel filesystem. Files go to **Convex `_storage`** (object storage with no code execution).

### Pipeline (`POST /resume-upload`)

1. Origin allowlist
2. `Content-Type: application/pdf`
3. **`Content-Length` required** — reject oversize **before** reading body (DoS / bill protection)
4. **`X-Resume-Filename`** — must end in `.pdf`; no path segments
5. Rate limit (IP + global)
6. Read body; verify length matches header; max **5 MB**
7. PDF magic bytes (`%PDF-`)
8. Structural parse via `pdf-lib`; max **25 pages**
9. Store with `contentType: application/pdf`
10. Issue single-use capability token (30 min TTL)

Registration mutation verifies token, storage metadata, and PDF content type before attaching.

### Rate limits

| Scope | Limit | Window |
| --- | --- | --- |
| Per client IP | 5 uploads | 10 minutes |
| Global | 100 uploads | 10 minutes |

## Error handling (security UX)

Server errors return JSON `{ "error": "..." }` with appropriate HTTP status. The client maps technical messages to applicant-friendly copy via `shared/registration/submitErrors.ts` — users never see stack traces or internal paths.

## Environment secrets

| Secret | Where | Never |
| --- | --- | --- |
| SMTP, JWT keys | Convex deployment env | `VITE_*` or git |
| Convex URLs | Vercel build env | Committed in repo |

Rotate SMTP and JWT independently per environment. Dev keys must not be copied to prod.

## Operational security

| Task | Command / location |
| --- | --- |
| Wipe all data (destructive) | `npx convex run admin:resetAllData --prod` |
| Clear OTP limits (support) | Internal `rateLimits:clearOtpSendLimitsForEmail` |
| Dependency audit | CI `npm audit --audit-level=high` |
| Secret scan | CI Gitleaks |

## Related docs

- [API.md — HTTP errors & validation](API.md#error-responses)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [OPERATIONS.md](OPERATIONS.md)
