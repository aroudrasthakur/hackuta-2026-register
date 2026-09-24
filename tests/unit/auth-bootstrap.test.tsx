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

  it("signs out a session restored from a previous visit before showing the app", async () => {
    let finishSignOut!: () => void;
    const pendingSignOut = vi.fn(
      () => new Promise<undefined>((resolve) => {
        finishSignOut = () => resolve(undefined);
      }),
    );
    vi.mocked(useSessionAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      signOut: pendingSignOut,
    });

    render(
      <AuthBootstrap>
        <p>App content</p>
      </AuthBootstrap>,
    );

    expect(pendingSignOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();

    finishSignOut();
    expect(await screen.findByText("App content")).toBeInTheDocument();
  });

  it("does not sign out when no session was restored", async () => {
    const noSignOut = vi.fn(async () => undefined);
    vi.mocked(useSessionAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      signOut: noSignOut,
    });

    render(
      <AuthBootstrap>
        <p>App content</p>
      </AuthBootstrap>,
    );
    expect(await screen.findByText("App content")).toBeInTheDocument();
    expect(noSignOut).not.toHaveBeenCalled();
  });
});
