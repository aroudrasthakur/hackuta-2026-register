import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
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
    signIn: vi.fn(async () => ({ signingIn: true })),
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

  it("provides signIn function", () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    expect(result.current.signIn).toBeInstanceOf(Function);
  });

  it("provides signOut function", () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    expect(result.current.signOut).toBeInstanceOf(Function);
  });

  it("signIn returns signingIn state", async () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(true),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const signInResult = await result.current.signIn("email", {
      email: "test@example.com",
    });
    expect(signInResult).toHaveProperty("signingIn");
  });

  it("uses ConvexSessionBridge when mock is disabled", () => {
    const { result } = renderHook(() => useSessionAuth(), {
      wrapper: createWrapper(false),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
