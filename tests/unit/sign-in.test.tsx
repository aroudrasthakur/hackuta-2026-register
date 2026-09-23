import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import SignInPage from "../../src/pages/SignIn/SignInPage";

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: vi.fn().mockResolvedValue({ signingIn: false }),
  }),
}));

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: () => undefined,
    useMutation: () => vi.fn(),
  };
});

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: () => null,
}));

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => ({
    isLoading: false,
    isAuthenticated: false,
    verifiedEmail: null,
    hasSubmittedRegistration: false,
  }),
}));

const TEST_PASSWORD = "Hackuta1";

function renderSignIn() {
  vi.stubEnv("VITE_USE_MOCK_API", "true");
  return render(
    <MemoryRouter>
      <MockAuthProvider>
        <SessionAuthProvider>
          <SignInPage />
        </SessionAuthProvider>
      </MockAuthProvider>
    </MemoryRouter>,
  );
}

async function startSignUp(user: ReturnType<typeof userEvent.setup>, email = "applicant@example.com") {
  await user.type(screen.getByLabelText(/^Email$/i), email);
  await user.type(screen.getByLabelText(/^Password$/i), TEST_PASSWORD);
  await user.type(screen.getByLabelText(/^Confirm password$/i), TEST_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignInPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the account creation step by default", () => {
    renderSignIn();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("rejects an invalid email", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/^Email$/i), "not-an-email");
    await user.type(screen.getByLabelText(/^Password$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/^Confirm password$/i), TEST_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("shows the email verification step after creating an account", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("preserves leading zeros in OTP entry", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("042681");
    expect(cells[0]).toHaveValue("0");
    expect(cells[1]).toHaveValue("4");
    expect(cells[5]).toHaveValue("1");
  });

  it("switches to the sign-in form", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole("button", { name: /Already have an account/i }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Confirm password$/i)).not.toBeInTheDocument();
  });
});
