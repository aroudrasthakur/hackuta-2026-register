import { PASSWORD_REQUIREMENTS_MESSAGE } from "./password";

export const AUTH_FAILED_MESSAGE = "Incorrect email or password. Please try again.";
export const ACCOUNT_EXISTS_MESSAGE =
  "An account with this email already exists. Sign in instead.";
export const OTP_INVALID_MESSAGE = "This code is invalid or has expired. Request a new code.";
export const EMAIL_SEND_FAILED_MESSAGE =
  "We couldn't send a verification email. Please try again.";

function rawAuthErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function isAccountExistsError(error: unknown) {
  return rawAuthErrorText(error).toLowerCase().includes("already exists");
}

type AuthErrorContext = "credentials" | "resend";

/** Map Convex Auth / client errors to applicant-facing copy. Never return stack traces. */
export function mapAuthError(error: unknown, context: AuthErrorContext = "credentials") {
  const raw = rawAuthErrorText(error);
  const text = raw.toLowerCase();

  if (isAccountExistsError(error)) return ACCOUNT_EXISTS_MESSAGE;
  if (text.includes("invalid password") || raw === PASSWORD_REQUIREMENTS_MESSAGE) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }
  if (text.includes("passwords do not match")) return "Passwords do not match.";
  if (
    text.includes("email is not configured") ||
    text.includes("email could not") ||
    text.includes("email service")
  ) {
    return EMAIL_SEND_FAILED_MESSAGE;
  }
  if (context === "resend") {
    return EMAIL_SEND_FAILED_MESSAGE;
  }
  if (
    text.includes("invalid secret") ||
    text.includes("invalid credentials") ||
    text.includes("could not authenticate") ||
    text.includes("could not sign")
  ) {
    return AUTH_FAILED_MESSAGE;
  }
  if (
    text.includes("invalid code") ||
    text.includes("could not verify") ||
    raw === OTP_INVALID_MESSAGE
  ) {
    return OTP_INVALID_MESSAGE;
  }
  if (
    raw === AUTH_FAILED_MESSAGE ||
    raw === ACCOUNT_EXISTS_MESSAGE ||
    raw === EMAIL_SEND_FAILED_MESSAGE
  ) {
    return raw;
  }

  return AUTH_FAILED_MESSAGE;
}
