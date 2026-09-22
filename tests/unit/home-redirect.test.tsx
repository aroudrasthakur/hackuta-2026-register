import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import HomeRedirect from "../../src/pages/HomeRedirect";

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
  };
});

let mockRoutingState = {
  isLoading: false,
  isAuthenticated: false,
  verifiedEmail: null as string | null,
  hasRegistration: false,
  hasSubmittedRegistration: false,
  registrationStatus: null as string | null,
};

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => mockRoutingState,
}));

function renderHomeRedirect() {
  vi.stubEnv("VITE_USE_MOCK_API", "true");

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <MockAuthProvider>
        <SessionAuthProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/sign-in" element={<div>Sign In Page</div>} />
            <Route path="/profile" element={<div>Profile Page</div>} />
            <Route path="/register" element={<div>Register Page</div>} />
          </Routes>
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("HomeRedirect", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockRoutingState = {
      isLoading: false,
      isAuthenticated: false,
      verifiedEmail: null,
      hasRegistration: false,
      hasSubmittedRegistration: false,
      registrationStatus: null,
    };
  });

  it("shows loading state while authentication is being checked", () => {
    mockRoutingState.isLoading = true;
    renderHomeRedirect();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to sign-in when not authenticated", () => {
    renderHomeRedirect();
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("redirects to profile when authenticated with submitted registration", () => {
    mockRoutingState.isAuthenticated = true;
    mockRoutingState.verifiedEmail = "test@example.com";
    mockRoutingState.hasRegistration = true;
    mockRoutingState.hasSubmittedRegistration = true;
    mockRoutingState.registrationStatus = "submitted";

    renderHomeRedirect();
    expect(screen.getByText("Profile Page")).toBeInTheDocument();
  });

  it("redirects to register when authenticated but no submitted registration", () => {
    mockRoutingState.isAuthenticated = true;
    mockRoutingState.verifiedEmail = "test@example.com";

    renderHomeRedirect();
    expect(screen.getByText("Register Page")).toBeInTheDocument();
  });
});
