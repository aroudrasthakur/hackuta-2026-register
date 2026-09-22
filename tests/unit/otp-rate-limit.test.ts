import { describe, expect, it } from "vitest";
import {
  formatOtpCooldownMessage,
  formatOtpResendLabel,
  getOtpSendErrorMessage,
  getOtpSendStatusMessage,
  isMaskedConvexAuthError,
  isOtpRateLimitError,
  getCooldownWaitSeconds,
  hasPendingOtpCode,
  mergeCooldownExpiry,
  shouldShowOtpSendCooldown,
  shouldTreatAsOtpRateLimit,
  startCooldownExpiry,
} from "../../shared/auth/otpRateLimit";

describe("otp rate limit helpers", () => {
  it("detects server rate-limit messages", () => {
    expect(isOtpRateLimitError("Too many verification requests. Please try again later.")).toBe(
      true,
    );
    expect(isOtpRateLimitError("Please wait before requesting another code.")).toBe(true);
    expect(isOtpRateLimitError("Missing environment variable SITE_URL")).toBe(false);
  });

  it("detects masked Convex auth errors", () => {
    expect(isMaskedConvexAuthError(new Error("Server Error"))).toBe(true);
    expect(
      isMaskedConvexAuthError(
        new Error("[CONVEX A(auth:signIn)] [Request ID: abc123] Server Error"),
      ),
    ).toBe(true);
    expect(isMaskedConvexAuthError(new Error("Please wait before requesting another code."))).toBe(
      false,
    );
  });

  it("keeps a shared cooldown expiry when syncing from the server", () => {
    const now = 1_000_000;
    const current = startCooldownExpiry(40, now);
    const merged = mergeCooldownExpiry(
      current,
      { waitSeconds: 60, hourlyLimitReached: false },
      now,
    );
    expect(getCooldownWaitSeconds(merged, now + 5_000)).toBe(35);
    expect(getCooldownWaitSeconds(merged, now + 20_000)).toBe(20);
  });

  it("only shows cooldown UI when the server reports an active limit", () => {
    expect(shouldShowOtpSendCooldown({ waitSeconds: 0, hourlyLimitReached: false })).toBe(false);
    expect(shouldShowOtpSendCooldown({ waitSeconds: 12, hourlyLimitReached: false })).toBe(true);
    expect(shouldShowOtpSendCooldown({ waitSeconds: 0, hourlyLimitReached: true })).toBe(true);
    expect(hasPendingOtpCode({ waitSeconds: 12, hourlyLimitReached: false })).toBe(true);
    expect(hasPendingOtpCode({ waitSeconds: 0, hourlyLimitReached: true })).toBe(false);
  });

  it("formats cooldown messages with live seconds", () => {
    expect(formatOtpCooldownMessage(45)).toBe(
      "Please wait before requesting another code. You can send another in 45s.",
    );
    expect(formatOtpResendLabel(12)).toBe("Resend code in 12s");
    expect(formatOtpResendLabel(0)).toBe("Resend code");
  });

  it("builds status messages from server cooldown state", () => {
    expect(getOtpSendStatusMessage({ waitSeconds: 0, hourlyLimitReached: false })).toBeNull();
    expect(getOtpSendStatusMessage({ waitSeconds: 30, hourlyLimitReached: false })).toBe(
      "Please wait before requesting another code. You can send another in 30s.",
    );
    expect(getOtpSendStatusMessage({ waitSeconds: 0, hourlyLimitReached: true })).toBe(
      "Too many verification requests. Please try again later.",
    );
  });

  it("treats server cooldown state as a rate limit", () => {
    expect(shouldTreatAsOtpRateLimit(new Error("Server Error"))).toBe(false);
    expect(
      shouldTreatAsOtpRateLimit(new Error("Please wait before requesting another code."), {
        waitSeconds: 0,
        hourlyLimitReached: false,
      }),
    ).toBe(true);
  });

  it("returns rate-limit messages in production mode", () => {
    expect(
      getOtpSendErrorMessage(
        new Error("Please wait before requesting another code."),
        false,
      ),
    ).toBe("Please wait before requesting another code.");
  });

  it("returns other errors only in dev mode", () => {
    expect(getOtpSendErrorMessage(new Error("Missing SITE_URL"), false)).toBeNull();
    expect(getOtpSendErrorMessage(new Error("Missing SITE_URL"), true)).toBe("Missing SITE_URL");
    expect(getOtpSendErrorMessage(new Error("Server Error"), true)).toBeNull();
  });

  it("ignores non-error values and blank messages", () => {
    expect(getOtpSendErrorMessage("not an error", false)).toBeNull();
    expect(getOtpSendErrorMessage(new Error("   "), false)).toBeNull();
  });
});
