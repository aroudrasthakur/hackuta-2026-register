import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { useMockAuth } from "../../src/hooks/useMockAuth";
import {
  SessionAuthProvider,
  useSessionAuth,
} from "../../src/hooks/useSessionAuth";
import type { ReactNode } from "react";

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: false,
  }),
  useAuthActions: () => ({
    signOut: vi.fn(async () => {}),
  }),
}));

function createWrapper(mockEnabled = true) {
  return function Wrapper({ children }: { children: ReactNode }) {
    vi.stubEnv("VITE_USE_MOCK_API", mockEnabled ? "true" : "false");
    return (
      <MockAuthProvider>
        <SessionAuthProvider>{children}</SessionAuthProvider>
      </MockAuthProvider>
    );
  };
}

describe("useSessionAuth", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws error when used outside provider", () => {
    expect(() => renderHook(() => useSessionAuth())).toThrow(
      "useSessionAuth must be used within SessionAuthProvider",
    );
  });

  it("returns loading state initially with mock auth", async () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    expect(result.current.isLoading).toBeDefined();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("returns authenticated state after mock auth loads", async () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("provides signOut function", () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    expect(result.current.signOut).toBeInstanceOf(Function);
  });

  it("signs the mock session out through the mock provider", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    const { result } = renderHook(
      () => ({ session: useSessionAuth(), mock: useMockAuth() }),
      { wrapper: createWrapper(true) },
    );

    act(() => result.current.mock.setScenario("signedInNew"));
    expect(result.current.session.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.session.signOut();
    });
    expect(result.current.session.isAuthenticated).toBe(false);
  });

  it("uses ConvexSessionBridge when mock is disabled", () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(false),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
