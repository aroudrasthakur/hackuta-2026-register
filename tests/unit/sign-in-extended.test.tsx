import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OTP_INVALID_MESSAGE } from "../../shared/auth/errorMessages";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { MOCK_OTP } from "../../src/constants/mockAuth";
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

async function startSignUp(user: ReturnType<typeof userEvent.setup>, email = "test@example.com") {
  await user.type(screen.getByLabelText(/^Email$/i), email);
  await user.type(screen.getByLabelText(/^Password$/i), TEST_PASSWORD);
  await user.type(screen.getByLabelText(/^Confirm password$/i), TEST_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("heading", { name: "Verify your email" });
}

describe("SignInPage extended", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates email format before creating an account", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "invalid-email");
    await user.type(screen.getByLabelText(/^Password$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/^Confirm password$/i), TEST_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("rejects mismatched passwords on sign up", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/^Email$/i), "test@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/^Confirm password$/i), "Hackuta2");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });

  it("shows email address in the verification step", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user, "user@example.com");
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
  });

  it("provides a back button on the verification step", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    expect(screen.getByRole("button", { name: /Back to sign in/i })).toBeInTheDocument();
  });

  it("returns to credentials when back is clicked", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    await user.click(screen.getByRole("button", { name: /Back to sign in/i }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("allows OTP entry with 6 digits", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("handles non-digit input in OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.keyboard("abc");
    expect(cells[0]).toHaveValue("");
  });

  it("verifies mock OTP and navigates to register", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_USE_MOCK_API", "true");

    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <MockAuthProvider>
          <SessionAuthProvider>
            <Routes>
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/register" element={<div>Register Page</div>} />
            </Routes>
          </SessionAuthProvider>
        </MockAuthProvider>
      </MemoryRouter>,
    );

    await startSignUp(user, "applicant@example.com");
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste(MOCK_OTP);
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
  });

  it("shows an error for an invalid mock OTP", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);

    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("111111");
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByText(OTP_INVALID_MESSAGE)).toBeInTheDocument();
  });

  it("keeps verify disabled until six digits are entered", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);

    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("123");

    expect(screen.getByRole("button", { name: "Verify email" })).toBeDisabled();
  });

  it("shows resend countdown after account creation", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);
    expect(await screen.findByRole("button", { name: /Resend code in \d+s/i })).toBeDisabled();
  });

  it("shows loading label while verifying", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await startSignUp(user);

    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste(MOCK_OTP);

    const verifyButton = screen.getByRole("button", { name: "Verify email" });
    expect(verifyButton).not.toBeDisabled();
  });

  it("shows the forgot password entry point in sign-in mode", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(screen.getByRole("button", { name: /Already have an account/i }));
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeInTheDocument();
  });

  it("switches between sign up and sign in modes", async () => {
    const user = userEvent.setup();
    renderSignIn();

    await user.click(screen.getByRole("button", { name: /Already have an account/i }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Need an account/i }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    });
  });
});
