import { createContext } from "react";
import type { MockAuthScenario } from "../constants/mockAuth";

export type MockAuthContextValue = {
  enabled: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  verifiedEmail: string | null;
  hasRegistration: boolean;
  hasSubmittedRegistration: boolean;
  registrationStatus: string | null;
  scenario: MockAuthScenario;
  setScenario: (scenario: MockAuthScenario) => void;
  requestOtp: (email: string) => void;
  verifyOtp: (code: string) => boolean;
  signOut: () => void;
};

export const defaultMockAuthValue: MockAuthContextValue = {
  enabled: false,
  isLoading: false,
  isAuthenticated: false,
  verifiedEmail: null,
  hasRegistration: false,
  hasSubmittedRegistration: false,
  registrationStatus: null,
  scenario: "signedOut",
  setScenario: () => undefined,
  requestOtp: () => undefined,
  verifyOtp: () => false,
  signOut: () => undefined,
};

export const MockAuthContext = createContext<MockAuthContextValue>(defaultMockAuthValue);
