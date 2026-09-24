# Convex email (`convex/email/`)

HackUTA email service client and templates for registration auth and confirmations.

## Overview

| File | Summary |
| --- | --- |
| [emailService.ts](emailService.ts) | HTTP client for the HackUTA email service (`EMAIL_SERVICE_URL`, `EMAIL_SERVICE_API_KEY`): `sendMailMessage`, `sendTrackedEmail`, `getEmailStatus` |
| [templates.ts](templates.ts) | HTML/text bodies for OTP, password reset, and confirmation mail; escapeHtml on user content |
| [sendOtpEmail.ts](sendOtpEmail.ts) | sendOtpEmail action — sign-up verification code (called from [auth.ts](../auth.ts)) |
| [sendPasswordResetEmail.ts](sendPasswordResetEmail.ts) | sendPasswordResetEmail action — password reset code (called from [auth.ts](../auth.ts)) |
| [sendApplicationConfirmationEmail.ts](sendApplicationConfirmationEmail.ts) | sendApplicationConfirmationEmail action — post-submit mail (scheduled from [registrations.ts](../registrations.ts)) |
| [checkEmailStatus.ts](checkEmailStatus.ts) | Internal operator action — asks the service whether a tracked email was sent |

Sign-up and password-reset emails use separate templates and subjects. Both OTP types expire in 10 minutes.

## Delivery

- Emails are queued with `POST /send-email`. The service sends `body` as plain text, so the plain-text template is used.
- A returned ID confirms queueing, not delivery. Each ID is recorded in `emailDeliveries` ([../emailDeliveries.ts](../emailDeliveries.ts)) with the email kind (also sent as `note`), recipient, and time — never the content or code.
- Requests time out after 10 seconds and are never retried: a failed request may already be queued, and duplicate-send behavior is not defined.
- Errors never include the API key or email body. The key is only sent over HTTPS (plain HTTP only for `localhost` test services).

## Related

| Location | Role |
| --- | --- |
| [../README.md](../README.md) | Convex backend index |
| [docs/OPERATIONS.md](../../docs/OPERATIONS.md) | Email service env var setup and delivery checks |

Parent index: [../README.md](../README.md).
