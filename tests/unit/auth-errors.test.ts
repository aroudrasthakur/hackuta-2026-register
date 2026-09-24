import { describe, expect, it } from "vitest";
import {
  ACCOUNT_EXISTS_MESSAGE,
  AUTH_FAILED_MESSAGE,
  EMAIL_SEND_FAILED_MESSAGE,
  isAccountExistsError,
  mapAuthError,
  OTP_INVALID_MESSAGE,
} from "../../shared/auth/authErrors";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "../../shared/auth/password";

describe("mapAuthError", () => {
  it("translates an existing-account Convex error into a sign-in prompt", () => {
    const error = new Error(
      "[CONVEX A(auth:signIn)] Server Error Uncaught Error: Account hkudoda@gmail.com already exists",
    );

    expect(isAccountExistsError(error)).toBe(true);
    expect(mapAuthError(error)).toBe(ACCOUNT_EXISTS_MESSAGE);
    expect(mapAuthError(error)).not.toContain("hkudoda@gmail.com");
    expect(mapAuthError(error)).not.toContain("CONVEX");
  });

  it("keeps password requirement and mismatch messages", () => {
    expect(mapAuthError(new Error("Invalid password"))).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
    expect(mapAuthError(new Error("Passwords do not match"))).toBe("Passwords do not match.");
  });

  it("maps email and credential failures without leaking internals", () => {
    expect(mapAuthError(new Error("Email is not configured."))).toBe(EMAIL_SEND_FAILED_MESSAGE);
    expect(mapAuthError(new Error("Invalid credentials"))).toBe(AUTH_FAILED_MESSAGE);
    expect(mapAuthError(new Error("Could not verify"))).toBe(OTP_INVALID_MESSAGE);
    expect(mapAuthError(new Error("Unexpected server explosion"))).toBe(AUTH_FAILED_MESSAGE);
    expect(mapAuthError(new Error("InvalidSecret"), "resend")).toBe(EMAIL_SEND_FAILED_MESSAGE);
    expect(mapAuthError(new Error("Account already exists"), "resend")).toBe(
      ACCOUNT_EXISTS_MESSAGE,
    );
  });
});
