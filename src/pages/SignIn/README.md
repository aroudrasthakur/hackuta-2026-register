# Sign-in page (`src/pages/SignIn`)

Password sign-up/sign-in with email verification OTP on first registration.

## Overview

| File | Summary |
| --- | --- |
| [SignInPage.tsx](SignInPage.tsx) | Credentials step, verify step, mock vs Convex auth branches |

## Routes and behavior

| Concern | Detail |
| --- | --- |
| Route | /sign-in ([main.tsx](../../main.tsx)) |
| Shell | [SignInShell](../../components/SignInShell.tsx) + [OtpCodeInput](../../components/OtpCodeInput.tsx) |
| Convex | useAuthActions().signIn, ensureApplicantProfileRef, getOtpSendCooldownRef |
| Mock | useMockAuth requestOtp / verifyOtp with MOCK_OTP from [mockAuth.ts](../../constants/mockAuth.ts) |
| Redirect | Authenticated users sent to / ([HomeRedirect](../HomeRedirect.tsx)) |

Password and OTP rules: [shared/auth/](../../../shared/auth/).

## Related

| Location | Role |
| --- | --- |
| [hooks/README.md](../../hooks/README.md) | useSessionAuth, useApplicantRouting |
| [convex/README.md](../../convex/README.md) | ensureApplicantProfileRef, getOtpSendCooldownRef |

Parent index: [../README.md](../README.md).
