import { describe, expect, it } from "vitest";
import {
  ACCOUNT_CREATION_FAILED_MESSAGE,
  AUTH_FAILED_MESSAGE,
  mapAuthError,
  OTP_INVALID_MESSAGE,
} from "../../shared/auth/errorMessages";

describe("authentication error mapping", () => {
  it("maps unknown auth errors to the safe fallback", () => {
    expect(mapAuthError(new Error("[CONVEX A(auth:signIn)] database timeout"))).toBe(
      AUTH_FAILED_MESSAGE,
    );
  });

  it("maps known credential failures to actionable copy", () => {
    expect(mapAuthError(new Error("Invalid credentials"))).toBe(AUTH_FAILED_MESSAGE);
    expect(mapAuthError(new Error("An account with this email already exists"))).toBe(
      "An account with this email already exists. Sign in instead.",
    );
  });

  it("maps verification failures without exposing provider details", () => {
    expect(mapAuthError(new Error("Verification code has expired"))).toBe(OTP_INVALID_MESSAGE);
    expect(mapAuthError(new Error("Invalid code"))).toBe(OTP_INVALID_MESSAGE);
    expect(mapAuthError(new Error("[CONVEX A(auth:signIn)] Server Error"))).toBe(
      AUTH_FAILED_MESSAGE,
    );
  });
  it("maps signUp errors to the correct message", () => {
    expect(mapAuthError(new Error("Some error"), "signUp")).toBe(
      ACCOUNT_CREATION_FAILED_MESSAGE,
    );
  });
});
