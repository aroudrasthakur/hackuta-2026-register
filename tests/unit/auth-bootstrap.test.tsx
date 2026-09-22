import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthBootstrap } from "../../src/components/AuthBootstrap";

const signOut = vi.fn(async () => undefined);

vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: vi.fn(),
}));

import { useSessionAuth } from "../../src/hooks/useSessionAuth";

describe("AuthBootstrap", () => {
  it("keeps children mounted when isLoading flips after bootstrap", async () => {
    const mockUseSessionAuth = vi.mocked(useSessionAuth);
    mockUseSessionAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      signIn: vi.fn(),
      signOut,
    });

    const { rerender } = render(
      <AuthBootstrap>
        <p>Sign-in content</p>
      </AuthBootstrap>,
    );

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    mockUseSessionAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      signIn: vi.fn(),
      signOut,
    });
    rerender(
      <AuthBootstrap>
        <p>Sign-in content</p>
      </AuthBootstrap>,
    );

    expect(await screen.findByText("Sign-in content")).toBeInTheDocument();

    mockUseSessionAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      signIn: vi.fn(),
      signOut,
    });
    rerender(
      <AuthBootstrap>
        <p>Sign-in content</p>
      </AuthBootstrap>,
    );

    await waitFor(() => {
      expect(screen.getByText("Sign-in content")).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
