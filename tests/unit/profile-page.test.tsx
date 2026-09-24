import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { type MockAuthScenario } from "../../src/constants/mockAuth";
import { useMockAuth } from "../../src/hooks/useMockAuth";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import ProfilePage from "../../src/pages/Profile/ProfilePage";

const { dashboardQueryResult } = vi.hoisted(() => ({
  dashboardQueryResult: { current: undefined as unknown },
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: () => dashboardQueryResult.current,
    useMutation: () => vi.fn(),
  };
});

vi.mock("../../src/convex/client", () => ({
  getConvexClient: () => ({}),
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useAuthActions: () => ({
    signIn: vi.fn(async () => ({ signingIn: true })),
    signOut: vi.fn(async () => {}),
  }),
}));

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: ({ active }: { active?: boolean }) => (
    <div data-testid="storm-backdrop" data-active={active ? "true" : "false"} />
  ),
}));

function MockScenario({ scenario }: { scenario: MockAuthScenario }) {
  const { setScenario } = useMockAuth();

  useEffect(() => {
    setScenario(scenario);
  }, [scenario, setScenario]);

  return null;
}

function renderProfilePage(scenario: MockAuthScenario = "signedInReturning") {
  vi.stubEnv("VITE_USE_MOCK_API", "true");

  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <MockAuthProvider>
        <SessionAuthProvider>
          <MockScenario scenario={scenario} />
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/sign-in" element={<div>Sign In Page</div>} />
            <Route path="/register" element={<div>Register Page</div>} />
          </Routes>
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    dashboardQueryResult.current = undefined;
    vi.stubEnv("VITE_USE_MOCK_API", "true");
  });

  it("renders submitted application details for returning applicants", () => {
    renderProfilePage("signedInReturning");

    expect(screen.getByRole("heading", { name: "Your Journey" })).toBeInTheDocument();
    expect(screen.getByText("Sam Test")).toBeInTheDocument();
    expect(screen.getByText("The University of Texas at Arlington")).toBeInTheDocument();
    expect(screen.getByText("Year of study").closest("div")).toHaveTextContent("2026");
    expect(screen.getByText("Under review")).toBeInTheDocument();
    expect(screen.queryByText("submitted")).not.toBeInTheDocument();
    expect(
      screen.getByText("HackUTA 2026 odyssey illustrations of a ship, clouds, and an island"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("profile-decorations")).toBeInTheDocument();
    const decorations = screen.getByTestId("profile-decorations");
    const clouds = decorations.querySelector('img[src="/images/profile/clouds.png"]');
    const island = decorations.querySelector('img[src="/images/profile/island.png"]');
    const ship = decorations.querySelector('img[src="/images/profile/ship.png"]');
    expect(clouds).toHaveClass("top-0", "left-0");
    expect(island?.compareDocumentPosition(ship!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(ship?.parentElement).toHaveClass("bottom-0");
    expect(screen.getByText("Applications open")).toBeInTheDocument();
    expect(screen.getByText("Applications close")).toBeInTheDocument();
    expect(screen.getByText("Decisions go out")).toBeInTheDocument();
    expect(screen.getAllByText("To be announced")).toHaveLength(2);
    expect(screen.getByText("RSVP due")).toBeInTheDocument();
    expect(screen.getByText("The hackathon begins")).toBeInTheDocument();
    expect(screen.queryByText("Country of residence")).not.toBeInTheDocument();
    expect(screen.queryByText("State of residence")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue application" })).not.toBeInTheDocument();
  });

  it("shows start application when the applicant has not registered yet", () => {
    renderProfilePage("signedInNew");

    expect(
      screen.getByText("You haven't started an application yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start application" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("renders the weather mood toggle and calms the storm", async () => {
    const user = userEvent.setup();
    renderProfilePage("signedInReturning");

    expect(screen.getByRole("group", { name: "Weather mood" })).toBeInTheDocument();
    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "true");

    await user.click(screen.getByRole("button", { name: "Calm" }));

    expect(screen.getByRole("button", { name: "Calm" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "false");
    expect(window.localStorage.getItem("hackuta-weather-mood")).toBe("calm");
  });

  it("re-enrages the storm from a calmed state", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hackuta-weather-mood", "calm");
    renderProfilePage("signedInReturning");

    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "false");

    await user.click(screen.getByRole("button", { name: "Enrage" }));

    expect(screen.getByTestId("storm-backdrop")).toHaveAttribute("data-active", "true");
    expect(window.localStorage.getItem("hackuta-weather-mood")).toBe("enraged");
  });

  it("redirects to sign-in after sign out", async () => {
    const user = userEvent.setup();
    renderProfilePage("signedInReturning");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
  });
});

describe("ProfilePage (Convex mode)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    vi.stubEnv("VITE_USE_MOCK_API", "false");
  });

  it("shows a loading state while the dashboard query is pending", () => {
    dashboardQueryResult.current = undefined;

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <MockAuthProvider>
          <SessionAuthProvider>
            <ProfilePage />
          </SessionAuthProvider>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading your application…")).toBeInTheDocument();
  });

  it("does not label incomplete drafts as under review", () => {
    dashboardQueryResult.current = {
      profile: {
        displayName: "Draft User",
        verifiedEmail: "draft@example.com",
      },
      registration: {
        status: "draft",
        eligibilityStatus: "unreviewed",
        submittedAt: null,
        answers: {
          firstName: "Draft",
          lastName: "User",
          school: "The University of Texas at Arlington",
          graduationYear: 2027,
        },
      },
      hackathon: null,
    };

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <MockAuthProvider>
          <SessionAuthProvider>
            <ProfilePage />
          </SessionAuthProvider>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Draft User")).toBeInTheDocument();
    expect(screen.getByText("The University of Texas at Arlington")).toBeInTheDocument();
    expect(screen.getByText("2027")).toBeInTheDocument();
    expect(screen.queryByText("Under review")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue application" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("shows an error when the dashboard cannot be loaded", () => {
    dashboardQueryResult.current = null;

    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <MockAuthProvider>
          <SessionAuthProvider>
            <ProfilePage />
          </SessionAuthProvider>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText("We couldn't load your application. Please try again."),
    ).toBeInTheDocument();
  });
});
