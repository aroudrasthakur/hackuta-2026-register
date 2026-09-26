import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_FAILED_MESSAGE,
  OTP_INVALID_MESSAGE,
} from "../../shared/auth/errorMessages";
import { OTP_HOURLY_LIMIT_MESSAGE } from "../../shared/auth/otpRateLimit";
import { PASSWORD_REQUIREMENTS_MESSAGE } from "../../shared/auth/password";
import {
  PASSWORD_RESET_FAILED_MESSAGE,
  PASSWORD_RESET_HOURLY_LIMIT_MESSAGE,
  PASSWORD_RESET_REQUESTED_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
  PASSWORD_REUSE_MESSAGE,
} from "../../shared/auth/passwordResetMessages";
import { SessionAuthProvider } from "../../src/hooks/useSessionAuth";
import { ForgotPasswordFlow } from "../../src/pages/SignIn/ForgotPasswordFlow";
import SignInPage from "../../src/pages/SignIn/SignInPage";

type SignInResult = { signingIn: boolean };

const state = vi.hoisted(() => ({
  signIn: undefined as unknown as ReturnType<typeof vi.fn>,
  signOut: undefined as unknown as ReturnType<typeof vi.fn>,
  fetchAccessToken: undefined as unknown as ReturnType<typeof vi.fn>,
  ensureApplication: undefined as unknown as ReturnType<typeof vi.fn>,
  invalidateSessions: undefined as unknown as ReturnType<typeof vi.fn>,
  clientMutation: undefined as unknown as ReturnType<typeof vi.fn>,
  hasClient: true,
  isAuthenticated: false,
  isLoading: false,
  routing: undefined as
    | { authenticated: boolean; verifiedEmail: string | null; hasSubmittedRegistration: boolean }
    | undefined,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: state.signIn, signOut: state.signOut }),
  useConvexAuth: () => ({
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    fetchAccessToken: state.fetchAccessToken,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (_ref: unknown, args: unknown) => (args === "skip" ? undefined : state.routing),
  useMutation: (ref: unknown) =>
    getFunctionName(ref as never) === "applicant:ensureApplicantApplication"
      ? state.ensureApplication
      : state.invalidateSessions,
}));

vi.mock("../../src/convex/client", () => ({
  getConvexClient: () => (state.hasClient ? { mutation: state.clientMutation } : null),
}));

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: () => null,
}));

const PASSWORD = "Hackuta1";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderSignIn() {
  return render(
    <MemoryRouter initialEntries={["/sign-in"]}>
      <SessionAuthProvider>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/register" element={<div>Register Page</div>} />
          <Route path="/profile" element={<div>Profile Page</div>} />
        </Routes>
      </SessionAuthProvider>
    </MemoryRouter>,
  );
}

function formDataOf(call: unknown[] | undefined) {
  return Object.fromEntries((call?.[1] as FormData).entries());
}

async function fillSignUp(user: ReturnType<typeof userEvent.setup>, email = " New@Example.COM ") {
  await user.type(screen.getByLabelText(/^Email$/i), email);
  await user.type(screen.getByLabelText(/^Password$/i), PASSWORD);
  await user.type(screen.getByLabelText(/^Confirm password$/i), PASSWORD);
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code = "123456") {
  const cells = await screen.findAllByRole("textbox");
  await user.click(cells[0]!);
  await user.paste(code);
}

async function switchToSignIn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Already have an account/i }));
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_USE_MOCK_API", "false");
  state.signIn = vi.fn(async (): Promise<SignInResult> => ({ signingIn: false }));
  state.signOut = vi.fn(async () => undefined);
  state.fetchAccessToken = vi.fn(async () => "token");
  state.ensureApplication = vi.fn(async () => ({ applicationId: "p1", status: "draft" }));
  state.invalidateSessions = vi.fn(async () => undefined);
  state.clientMutation = vi.fn(async () => ({ waitSeconds: 0, hourlyLimitReached: false }));
  state.hasClient = true;
  state.isAuthenticated = false;
  state.isLoading = false;
  state.routing = undefined;
});

describe("SignInPage with Convex auth: sign up and verification", () => {
  it("creates the account with a normalised email and moves to OTP verification", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user);

    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(state.signIn).toHaveBeenCalledTimes(1);
    expect(state.signIn.mock.calls[0]?.[0]).toBe("password");
    expect(formDataOf(state.signIn.mock.calls[0])).toEqual({
      email: "new@example.com",
      password: PASSWORD,
      flow: "signUp",
    });
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  it("verifies the code, provisions the application, and routes to registration", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Verify your email" });

    state.signIn.mockResolvedValueOnce({ signingIn: true });
    await enterCode(user, "654321");
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
    expect(formDataOf(state.signIn.mock.calls[1])).toEqual({
      email: "new@example.com",
      code: "654321",
      flow: "email-verification",
    });
    expect(state.fetchAccessToken).toHaveBeenCalledWith({ forceRefreshToken: true });
    expect(state.ensureApplication).toHaveBeenCalledWith({});
  });

  it.each([
    ["the server does not start a session", () => state.signIn.mockResolvedValueOnce({ signingIn: false })],
    ["the server rejects the code", () => state.signIn.mockRejectedValueOnce(new Error("Invalid code"))],
  ])("shows the invalid-code error when %s and stays on the step", async (_label, arrange) => {
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Verify your email" });

    arrange();
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(OTP_INVALID_MESSAGE);
    expect(screen.getByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    expect(state.ensureApplication).not.toHaveBeenCalled();
  });

  it("shows a loading label and disables the button while verifying", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Verify your email" });

    const pending = deferred<SignInResult>();
    state.signIn.mockReturnValueOnce(pending.promise);
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(screen.getByRole("button", { name: "Verifying…" })).toBeDisabled();
    await act(async () => pending.resolve({ signingIn: false }));
    expect(screen.getByRole("button", { name: "Verify email" })).toBeEnabled();
  });

  it("blocks account creation for weak passwords without calling the server", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.type(screen.getByLabelText(/^Email$/i), "weak@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "password");
    await user.type(screen.getByLabelText(/^Confirm password$/i), "password");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_REQUIREMENTS_MESSAGE);
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("maps duplicate-account errors and clears the error once the user edits", async () => {
    state.signIn.mockRejectedValueOnce(new Error("Account already exists"));
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user, "dupe@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists. Sign in instead.",
    );
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText(/^Email$/i), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toHaveAttribute("aria-invalid", "false");
  });

  it("returns to the credentials step from verification", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await fillSignUp(user);
    await screen.findByRole("heading", { name: "Verify your email" });
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
});

describe("SignInPage with Convex auth: resend code", () => {
  async function reachVerifyWithExpiredCooldown(user: ReturnType<typeof userEvent.setup>) {
    renderSignIn();
    await fillSignUp(user, "resend@example.com");
    await screen.findByRole("heading", { name: "Verify your email" });
    const later = Date.now() + 31_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    return screen.findByRole("button", { name: "Resend code" }, { timeout: 2_500 });
  }

  it("resends once the cooldown expires and restarts the countdown", async () => {
    const user = userEvent.setup();
    const resend = await reachVerifyWithExpiredCooldown(user);
    await user.click(resend);

    await waitFor(() => expect(state.signIn).toHaveBeenCalledTimes(2));
    expect(formDataOf(state.signIn.mock.calls[1])).toMatchObject({ flow: "signUp", email: "resend@example.com" });
    expect(state.clientMutation).toHaveBeenCalledWith(expect.anything(), { email: "resend@example.com" });
    expect(await screen.findByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
  });

  it("locks resend when the server reports the hourly limit", async () => {
    state.clientMutation.mockResolvedValue({ waitSeconds: 0, hourlyLimitReached: true });
    const user = userEvent.setup();
    await user.click(await reachVerifyWithExpiredCooldown(user));

    expect(await screen.findByRole("button", { name: OTP_HOURLY_LIMIT_MESSAGE })).toBeDisabled();
  });

  it("recovers from a failed cooldown lookup by applying the default cooldown", async () => {
    state.clientMutation.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    await user.click(await reachVerifyWithExpiredCooldown(user));

    expect(await screen.findByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows server rate-limit errors from resend and re-enables the button", async () => {
    const user = userEvent.setup();
    const resend = await reachVerifyWithExpiredCooldown(user);
    state.signIn.mockRejectedValueOnce(new Error("Please wait before requesting another code."));
    await user.click(resend);

    expect(await screen.findByRole("alert")).toHaveTextContent("Please wait before requesting another code.");
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });
});

describe("SignInPage with Convex auth: sign in", () => {
  it("requires a password", async () => {
    const user = userEvent.setup();
    renderSignIn();
    await switchToSignIn(user);
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Password is required.");
    expect(state.signIn).not.toHaveBeenCalled();
  });

  it("signs in, provisions the profile, and routes to registration", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: true });
    const user = userEvent.setup();
    renderSignIn();
    await switchToSignIn(user);
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
    expect(formDataOf(state.signIn.mock.calls[0])).toMatchObject({ flow: "signIn" });
  });

  it("still routes when profile provisioning fails", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: true });
    state.ensureApplication.mockRejectedValueOnce(new Error("transient"));
    const user = userEvent.setup();
    renderSignIn();
    await switchToSignIn(user);
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
  });

  it("skips profile provisioning when no access token is available", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: true });
    state.fetchAccessToken.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderSignIn();
    await switchToSignIn(user);
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Register Page")).toBeInTheDocument();
    expect(state.ensureApplication).not.toHaveBeenCalled();
  });

  it("shows a pending label, then a generic error for bad credentials", async () => {
    const pending = deferred<SignInResult>();
    state.signIn.mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    renderSignIn();
    await switchToSignIn(user);
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "Wrong1234");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await act(async () => pending.reject(new Error("[CONVEX A(auth:signIn)] Server Error")));
    expect(screen.getByRole("alert")).toHaveTextContent(AUTH_FAILED_MESSAGE);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("redirects already-authenticated returning applicants to their profile", async () => {
    state.isAuthenticated = true;
    state.routing = { authenticated: true, verifiedEmail: "a@example.com", hasSubmittedRegistration: true };
    renderSignIn();
    expect(await screen.findByText("Profile Page")).toBeInTheDocument();
  });

  it("waits for auth to finish loading before redirecting", () => {
    state.isAuthenticated = true;
    state.isLoading = true;
    renderSignIn();
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });
});

describe("ForgotPasswordFlow with Convex auth", () => {
  async function openForgotPassword(user: ReturnType<typeof userEvent.setup>) {
    renderSignIn();
    await switchToSignIn(user);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  }

  async function requestCode(user: ReturnType<typeof userEvent.setup>, email = "Reset@Example.com") {
    await user.type(screen.getByLabelText(/^Email$/i), email);
    await user.click(screen.getByRole("button", { name: "Send code" }));
  }

  async function reachPasswordStep(user: ReturnType<typeof userEvent.setup>) {
    await openForgotPassword(user);
    await requestCode(user);
    await screen.findByRole("heading", { name: "Enter your reset code" });
    await enterCode(user, "112233");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
  }

  async function submitNewPassword(user: ReturnType<typeof userEvent.setup>, password = "NewPass12", confirm = password) {
    await user.type(screen.getByLabelText(/^New password$/i), password);
    await user.type(screen.getByLabelText(/^Confirm new password$/i), confirm);
    await user.click(screen.getByRole("button", { name: "Save new password" }));
  }

  it.each(["Reset@Example.com", "Missing@Example.com"])("shows the same reset confirmation for %s", async (email) => {
    // The backend returns the same non-session result for either account status.
    state.signIn.mockResolvedValueOnce({ signingIn: false });
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user, email);

    expect(await screen.findByText(PASSWORD_RESET_REQUESTED_MESSAGE)).toBeInTheDocument();
    expect(formDataOf(state.signIn.mock.calls[0])).toEqual({ email: email.toLowerCase(), flow: "reset" });
    expect(screen.getByRole("heading", { name: "Enter your reset code" })).toBeInTheDocument();
    expect(screen.getByText(email.toLowerCase())).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stays on the email step after an operational failure with a generic error", async () => {
    state.signIn.mockRejectedValueOnce(new Error("Network unavailable"));
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user, "missing@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_RESET_FAILED_MESSAGE);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Enter your reset code" })).not.toBeInTheDocument();
  });

  it("surfaces reset rate limits and stays on the email step", async () => {
    state.signIn.mockRejectedValueOnce(new Error("Too many reset requests. Please try again later."));
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_RESET_HOURLY_LIMIT_MESSAGE);
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("locks the resend button when the reset hourly limit is reached", async () => {
    state.clientMutation.mockResolvedValue({ waitSeconds: 0, hourlyLimitReached: true });
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user);

    expect(await screen.findByRole("button", { name: PASSWORD_RESET_HOURLY_LIMIT_MESSAGE })).toBeDisabled();
  });

  it("resends a reset code after the cooldown and recovers from lookup failures", async () => {
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user);
    await screen.findByRole("heading", { name: "Enter your reset code" });

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
    state.clientMutation.mockRejectedValueOnce(new Error("offline"));
    await user.click(await screen.findByRole("button", { name: "Resend code" }, { timeout: 2_500 }));

    await waitFor(() => expect(state.signIn).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
  });

  it("resets the password, revokes other sessions, signs out, and returns to sign in", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: false }).mockResolvedValueOnce({ signingIn: true });
    const user = userEvent.setup();
    await reachPasswordStep(user);
    await submitNewPassword(user);

    expect(await screen.findByText(PASSWORD_RESET_SUCCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(formDataOf(state.signIn.mock.calls[1])).toEqual({
      email: "reset@example.com",
      code: "112233",
      newPassword: "NewPass12",
      flow: "reset-verification",
    });
    expect(state.invalidateSessions).toHaveBeenCalledWith({});
    expect(state.signOut).toHaveBeenCalled();
  });

  it("completes the reset even when session cleanup fails", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: false }).mockResolvedValueOnce({ signingIn: true });
    state.invalidateSessions.mockRejectedValueOnce(new Error("offline"));
    state.signOut.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    await reachPasswordStep(user);
    await submitNewPassword(user);

    expect(await screen.findByText(PASSWORD_RESET_SUCCESS_MESSAGE)).toBeInTheDocument();
  });

  it("rejects an invalid reset code without leaving the password step", async () => {
    state.signIn.mockResolvedValueOnce({ signingIn: false }).mockResolvedValueOnce({ signingIn: false });
    const user = userEvent.setup();
    await reachPasswordStep(user);
    await submitNewPassword(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(OTP_INVALID_MESSAGE);
    expect(state.invalidateSessions).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
  });

  it("explains password reuse rejections", async () => {
    state.signIn
      .mockResolvedValueOnce({ signingIn: false })
      .mockRejectedValueOnce(Object.assign(new Error("Server Error"), { data: PASSWORD_REUSE_MESSAGE }));
    const user = userEvent.setup();
    await reachPasswordStep(user);
    await submitNewPassword(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_REUSE_MESSAGE);
  });

  it("validates new password strength and confirmation locally", async () => {
    const user = userEvent.setup();
    await reachPasswordStep(user);

    await submitNewPassword(user, "weakpass");
    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_REQUIREMENTS_MESSAGE);

    await user.clear(screen.getByLabelText(/^New password$/i));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText(/^Confirm new password$/i));
    await submitNewPassword(user, "NewPass12", "NewPass13");
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(state.signIn).toHaveBeenCalledTimes(1);
  });

  it("navigates back through the steps and cancels to sign in", async () => {
    const user = userEvent.setup();
    await reachPasswordStep(user);

    await user.click(screen.getByRole("button", { name: "Back to reset code" }));
    expect(screen.getByRole("heading", { name: "Enter your reset code" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change email" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("requires a full six digit code before continuing", async () => {
    const user = userEvent.setup();
    await openForgotPassword(user);
    await requestCode(user);
    await enterCode(user, "123");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("ForgotPasswordFlow without an auth client", () => {
  it("fails safely when sign-in is unavailable", async () => {
    state.hasClient = false;
    const user = userEvent.setup();
    render(
      <ForgotPasswordFlow
        convexSignIn={null}
        convexSignOut={null}
        invalidateSessions={null}
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    // No reset request can be sent, so the flow must not advance to the code step.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("fails safely on the password step when sign-in is unavailable", async () => {
    state.hasClient = false;
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    const onComplete = vi.fn();
    const user = userEvent.setup();
    const signIn = vi.fn(async () => ({ signingIn: false }));
    const { rerender } = render(
      <ForgotPasswordFlow
        convexSignIn={signIn}
        convexSignOut={null}
        invalidateSessions={null}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/^Email$/i), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    await enterCode(user);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    rerender(
      <ForgotPasswordFlow
        convexSignIn={null}
        convexSignOut={null}
        invalidateSessions={null}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText(/^New password$/i), "NewPass12");
    await user.type(screen.getByLabelText(/^Confirm new password$/i), "NewPass12");
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(PASSWORD_RESET_FAILED_MESSAGE);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
