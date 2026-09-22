import { renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "convex/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import { useApplicantRouting } from "../../src/hooks/useApplicantRouting";
import type { ReactNode } from "react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn(async () => ({ ok: true, userId: "user-id" }))),
}));

vi.mock("../../src/convex/client", () => ({
  getConvexClient: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useAuthActions: () => ({
    signIn: vi.fn(async () => ({ signingIn: true })),
    signOut: vi.fn(async () => {}),
  }),
}));

function createWrapper(mockApi = true) {
  return function Wrapper({ children }: { children: ReactNode }) {
    vi.stubEnv("VITE_USE_MOCK_API", mockApi ? "true" : "false");
    return (
      <MockAuthProvider>
        <SessionAuthProvider>{children}</SessionAuthProvider>
      </MockAuthProvider>
    );
  };
}

describe("useApplicantRouting", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(useQuery).mockReturnValue(undefined);
  });

  it("returns signed-out mock routing by default", async () => {
    const { result } = renderHook(() => useApplicantRouting(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toMatchObject({
      isAuthenticated: false,
      verifiedEmail: null,
      hasRegistration: false,
      hasSubmittedRegistration: false,
      registrationStatus: null,
    });
  });

  it("returns convex routing state when mock auth is disabled", async () => {
    vi.mocked(useQuery).mockReturnValue({
      authenticated: true,
      verifiedEmail: "live@example.com",
      hasRegistration: true,
      registrationStatus: "submitted",
      hasSubmittedRegistration: true,
    });

    const { result } = renderHook(() => useApplicantRouting(), {
      wrapper: createWrapper(false),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toMatchObject({
      isAuthenticated: true,
      verifiedEmail: "live@example.com",
      hasRegistration: true,
      hasSubmittedRegistration: true,
      registrationStatus: "submitted",
    });
  });

  it("waits for convex routing while authenticated query is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    const { result } = renderHook(() => useApplicantRouting(), {
      wrapper: createWrapper(false),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
  });
});
