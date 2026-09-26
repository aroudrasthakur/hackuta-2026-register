export type MockAuthScenario =
  | "signedOut"
  | "otpPending"
  | "signedInNew"
  | "signedInReturning";

export const MOCK_OTP = "042681";

const PROD_CONVEX_DEPLOYMENT = "brilliant-ostrich-892";

/** E2E hook mounted by MockAuthProvider when mock API is enabled. */
export type HackutaMockAuthWindow = {
  setScenario: (scenario: MockAuthScenario) => void;
};

declare global {
  interface Window {
    __hackutaMockAuth?: HackutaMockAuthWindow;
  }
}

function pointsAtProductionConvex() {
  const url = import.meta.env.VITE_CONVEX_URL?.trim() ?? "";
  return url.includes(PROD_CONVEX_DEPLOYMENT);
}

/** Compile-time gate only. Never set VITE_USE_MOCK_API=true on live production deploys. */
export function isMockApiEnabled() {
  if (import.meta.env.VITE_USE_MOCK_API !== "true") {
    return false;
  }
  if (import.meta.env.PROD && pointsAtProductionConvex()) {
    return false;
  }
  return true;
}
