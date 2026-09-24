# Security

How HackUTA registration protects applicant data, blocks abuse, and limits attack surface.

## Threat model (summary)

| Asset | Primary risks | Mitigations |
| --- | --- | --- |
| Applicant PII | XSS, stored injection | Server validation, React text rendering, email HTML escaping |
| Auth sessions | OTP brute force, enumeration, session fixation after reset | Rate limits, hashed codes, generic errors, session wipe after reset |
| Resume uploads | Malware, DoS, storage abuse | Allowlist, size caps, isolated Convex storage, rate limits |
| Frontend | Script injection, clickjacking | Strict CSP, Trusted Types, HSTS |

There is **no SQL layer** — Convex uses typed queries. Injection focus is on **XSS** and **upload abuse**.

## Defense layers

```
Browser CSP ──► Client Zod (UX) ──► Convex handler ──► Shared validation/sanitize ──► DB / storage
```

### Input validation

| Surface | Module | Server behavior |
| --- | --- | --- |
| Registration | shared/registration/schema.ts | Zod `.strict()`; rejects HTML/script patterns via shared/lib/sanitizeInput.ts |
| Resume upload | convex/http.ts, convex/pdfValidation.ts | See [Upload security](#resume-upload-security) |
| OTP email lookup | rateLimits:getOtpSendCooldown, getPasswordResetSendCooldown | Neutral response when rate-limited |

Free-text fields allow plain text only — no HTML tags, `javascript:` URLs, or event handlers.

### Email output

All user-derived values in HTML emails pass through `escapeHtml()` in convex/email/templates.ts.

### Authentication

- Email OTP via `@convex-dev/auth` — codes hashed, 10-minute expiry, never logged or returned in API responses
- Sign-up verification (`email-verification`) and password reset (`password-reset`) use **separate** email providers, templates, and `rateLimits` buckets — a sign-up OTP cannot authorize a reset
- Password reset requests return **neutral** client copy regardless of whether the email is registered
- Reset codes are single-use; expired or incorrect codes cannot complete reset; new password must differ from the current password (checked before OTP consumption)
- After reset, all auth sessions are invalidated and the user must sign in with the new password
- Registration email is **always** taken from the verified JWT, not from the form payload
- Passwords, OTPs, and reset tokens are never placed in URLs or logs; user-facing errors are mapped via `shared/auth/errorMessages.ts`
### Content Security Policy

Defined in `security/csp.ts`; deployed via `vercel.json`. Tests in `tests/unit/security.test.ts` keep them in sync.

Key directives: `default-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`, `frame-ancestors 'none'`, Trusted Types, `connect-src` limited to Convex + Vercel preview tooling.

Also deployed: HSTS, `X-Frame-Options: DENY`, Permissions-Policy (camera/mic disabled), Referrer-Policy.

### Origin policy (resume upload)

`convex/resumeUploadSecurity.ts` builds the allowlist from `REGISTRATION_ALLOWED_ORIGINS` and `SITE_URL`. Dev deployment may set `REGISTRATION_ALLOW_LOCAL_DEV_ORIGINS=true` for localhost — **never on production**.

## Resume upload security

Uploads never touch the Vercel filesystem. Files go to **Convex `_storage`** (object storage with no code execution).

### Pipeline (`POST /resume-upload`)

1. **Authenticated session** — JWT required; `authUserId` derived server-side (never from the client)
2. Origin allowlist
3. `Content-Type: application/pdf` (hint only; not trusted for validation)
4. **`Content-Length` required** — reject oversize **before** reading body (DoS / bill protection)
5. **`X-Resume-Filename`** — must end in `.pdf`; no path segments (UX hint; magic bytes + parser are authoritative)
6. Rate limit (IP + authenticated user + global)
7. Read body; verify length matches header; max **2 MB**
8. PDF magic bytes (`%PDF-`)
9. Structural parse via `pdf-lib`; max **25 pages**
10. Store in private Convex `_storage` with server-generated storage ID (not the user's filename)
11. Issue single-use capability token bound to the authenticated user (30 min TTL)

Registration mutation verifies token ownership, storage metadata, and PDF content type before attaching. `discardUploadSession` requires the same authenticated user who created the session.

### Rate limits

| Scope | Limit | Window |
| --- | --- | --- |
| Per client IP | 5 uploads | 10 minutes |
| Per authenticated user | 5 uploads | 10 minutes |
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
| Clear OTP limits (support) | Internal `rateLimits:clearOtpSendLimitsForEmail` (sign-up bucket only) |
| Dependency audit | CI `npm audit --audit-level=high` |
| Secret scan | CI Gitleaks |

## Related docs

- [API.md — HTTP errors & validation](API.md#error-responses)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [OPERATIONS.md](OPERATIONS.md)
