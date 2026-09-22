export type MockAuthScenario =
  | "signedOut"
  | "otpPending"
  | "signedInNew"
  | "signedInReturning";

export const MOCK_OTP = "042681";

/** Compile-time gate only. Never set VITE_USE_MOCK_API=true on live production deploys. */
export function isMockApiEnabled() {
  return import.meta.env.VITE_USE_MOCK_API === "true";
}
