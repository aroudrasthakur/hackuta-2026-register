# Sign-in page (`src/pages/SignIn`)

Password sign-up/sign-in with email verification OTP on first registration, plus forgot-password reset via a separate OTP flow.

## Overview

| File | Summary |
| --- | --- |
| [SignInPage.tsx](SignInPage.tsx) | Credentials step, verify step, forgot-password entry, mock vs Convex auth branches |
| [ForgotPasswordFlow.tsx](ForgotPasswordFlow.tsx) | Email → reset OTP → new password; returns to sign-in with success message |

## Routes and behavior

| Concern | Detail |
| --- | --- |
| Route | /sign-in ([main.tsx](../../main.tsx)) |
| Shell | [SignInShell](../../components/SignInShell.tsx) + [OtpCodeInput](../../components/OtpCodeInput.tsx) |
| Convex | useAuthActions().signIn / signOut, ensureApplicantProfileRef, getOtpSendCooldownRef, getPasswordResetSendCooldownRef, invalidateSessionsAfterPasswordResetRef |
| Mock | useMockAuth requestOtp / verifyOtp with MOCK_OTP from [mockAuth.ts](../../constants/mockAuth.ts) |
| Redirect | Authenticated users on the main sign-in view sent to /register or /profile |

Password, OTP, and reset copy: [shared/auth/](../../../shared/auth/).

### Sign-up / sign-in flows

| Step | `flow` value | FormData |
| --- | --- | --- |
| Sign up | `signUp` | `email`, `password` |
| Verify email | `email-verification` | `email`, `code` |
| Sign in | `signIn` | `email`, `password` |

### Forgot password flows

| Step | `flow` value | FormData |
| --- | --- | --- |
| Request reset code | `reset` | `email` |
| Set new password | `reset-verification` | `email`, `code`, `newPassword` |

After a successful reset, the app invalidates all auth sessions, signs out, and shows a success banner on the sign-in form. Reset code requests always show neutral copy (“If an account exists…”) regardless of whether the email is registered.

Signup OTPs use provider `email-verification`; reset OTPs use `password-reset` (separate buckets and email templates).

## Related

| Location | Role |
| --- | --- |
| [hooks/README.md](../../hooks/README.md) | useSessionAuth, useApplicantRouting |
| [convex/README.md](../../convex/README.md) | auth.ts, rateLimits.ts, passwordReset.ts |
| [docs/API.md](../../../docs/API.md) | Auth and rate-limit reference |

Parent index: [../README.md](../README.md).
