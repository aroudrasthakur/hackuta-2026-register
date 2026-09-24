# Convex email (`convex/email/`)

SMTP delivery and HTML templates for registration auth and confirmations.

## Overview

| File | Summary |
| --- | --- |
| [smtp.ts](smtp.ts) | Nodemailer transport using Convex env SMTP vars |
| [templates.ts](templates.ts) | HTML/text bodies for OTP, password reset, and confirmation mail; escapeHtml on user content |
| [sendOtpEmail.ts](sendOtpEmail.ts) | sendOtpEmail action — sign-up verification code (called from [auth.ts](../auth.ts)) |
| [sendPasswordResetEmail.ts](sendPasswordResetEmail.ts) | sendPasswordResetEmail action — password reset code (called from [auth.ts](../auth.ts)) |
| [sendApplicationConfirmationEmail.ts](sendApplicationConfirmationEmail.ts) | sendApplicationConfirmationEmail action — post-submit mail (scheduled from [registrations.ts](../registrations.ts)) |

Sign-up and password-reset emails use separate templates and subjects. Both OTP types expire in 10 minutes.

## Related

| Location | Role |
| --- | --- |
| [../README.md](../README.md) | Convex backend index |
| [docs/OPERATIONS.md](../../docs/OPERATIONS.md) | SMTP env var setup |

Parent index: [../README.md](../README.md).
