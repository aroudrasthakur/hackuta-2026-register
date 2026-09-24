import {
  isOtpRateLimitError,
  OTP_HOURLY_LIMIT_MESSAGE,
} from "./otpRateLimit";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "./password";

export const AUTH_FAILED_MESSAGE =
  "Incorrect email or password. Please try again.";
export const ACCOUNT_CREATION_FAILED_MESSAGE =
  "Sorry we couldn't create your account. Please try again.";
export const OTP_INVALID_MESSAGE =
  "This code is invalid or has expired. Please request a new code.";

export function mapAuthError(
  error: unknown,
  mode: "signIn" | "signUp" = "signIn",
): string {
  const detail = error instanceof Error ? error.message.trim() : "";
  const normalized = detail.toLowerCase();
  const fallback = mode === "signUp" ? ACCOUNT_CREATION_FAILED_MESSAGE : AUTH_FAILED_MESSAGE;

  if (!detail) return fallback;
  if (isOtpRateLimitError(detail)) {
    return normalized.includes("too many")
      ? OTP_HOURLY_LIMIT_MESSAGE
      : "Please wait before requesting another code.";
  }
  if (normalized.includes("passwords do not match")) {
    return "Passwords do not match.";
  }
  if (
    normalized.includes("invalid password") ||
    normalized.includes("password must")
  ) {
    return PASSWORD_REQUIREMENTS_MESSAGE;
  }
  if (
    normalized.includes("invalid email") ||
    normalized.includes("enter a valid email")
  ) {
    return "Please enter a valid email address.";
  }
  if (
    normalized.includes("already exists") ||
    normalized.includes("already registered") ||
    normalized.includes("email is already")
  ) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (
    normalized.includes("invalid code") ||
    normalized.includes("expired code") ||
    normalized.includes("verification code")
  ) {
    return OTP_INVALID_MESSAGE;
  }
  if (
    normalized.includes("incorrect") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("wrong password")
  ) {
    return AUTH_FAILED_MESSAGE;
  }

  return fallback;
}
