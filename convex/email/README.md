# Convex email (`convex/email/`)

SMTP delivery and HTML templates for registration auth and confirmations.

## Overview

| File | Summary |
| --- | --- |
| [smtp.ts](smtp.ts) | Nodemailer transport using Convex env SMTP vars |
| [templates.ts](templates.ts) | HTML/text bodies for OTP and confirmation mail; escapeHtml on user content |
| [sendOtpEmail.ts](sendOtpEmail.ts) | sendOtpEmail action — verification code (called from [auth.ts](../auth.ts)) |
| [sendApplicationConfirmationEmail.ts](sendApplicationConfirmationEmail.ts) | sendApplicationConfirmationEmail action — post-submit mail (scheduled from [registrations.ts](../registrations.ts)) |

## Related

| Location | Role |
| --- | --- |
| [../README.md](../README.md) | Convex backend index |
| [docs/OPERATIONS.md](../../docs/OPERATIONS.md) | SMTP env var setup |

Parent index: [../README.md](../README.md).
