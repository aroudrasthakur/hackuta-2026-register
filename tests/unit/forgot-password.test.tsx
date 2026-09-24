import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OTP_INVALID_MESSAGE } from "../../shared/auth/errorMessages";
import {
  PASSWORD_RESET_REQUESTED_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "../../shared/auth/passwordResetMessages";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { MOCK_OTP } from "../../src/constants/mockAuth";
import { ForgotPasswordFlow } from "../../src/pages/SignIn/ForgotPasswordFlow";

vi.mock("../../src/components/SignInStormBackdrop", () => ({
  SignInStormBackdrop: () => null,
}));

const TEST_PASSWORD = "Hackuta1";

function renderFlow(props: Partial<Parameters<typeof ForgotPasswordFlow>[0]> = {}) {
  vi.stubEnv("VITE_USE_MOCK_API", "true");
  const onComplete = vi.fn();
  const onCancel = vi.fn();

  render(
    <MockAuthProvider>
      <ForgotPasswordFlow
        convexSignIn={null}
        convexSignOut={null}
        invalidateSessions={null}
        onComplete={onComplete}
        onCancel={onCancel}
        {...props}
      />
    </MockAuthProvider>,
  );

  return { onComplete, onCancel };
}

describe("ForgotPasswordFlow", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the email step and neutral send confirmation", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(await screen.findByText(PASSWORD_RESET_REQUESTED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enter your reset code" })).toBeInTheDocument();
  });

  it("validates email format before sending a reset code", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText(/^Email$/i), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  });

  it("advances to the new password step after a valid mock OTP", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste(MOCK_OTP);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
  });

  it("rejects an invalid mock OTP", async () => {
    const user = userEvent.setup();
    renderFlow();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("111111");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText(OTP_INVALID_MESSAGE)).toBeInTheDocument();
  });

  it("completes the mock reset flow with matching passwords", async () => {
    const user = userEvent.setup();
    const { onComplete } = renderFlow();

    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste(MOCK_OTP);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(screen.getByLabelText(/^New password$/i), TEST_PASSWORD);
    await user.type(screen.getByLabelText(/^Confirm new password$/i), TEST_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Save new password" }));

    expect(onComplete).toHaveBeenCalledWith(PASSWORD_RESET_SUCCESS_MESSAGE);
  });

  it("rejects a short reset code submitted with the Enter key", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));

    const cells = await screen.findAllByRole("textbox");
    await user.click(cells[0]!);
    await user.paste("12");
    fireEvent.submit(cells[0]!.closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(OTP_INVALID_MESSAGE);
    expect(screen.getByRole("heading", { name: "Enter your reset code" })).toBeInTheDocument();
  });

  it("resends a mock reset code once the cooldown expires", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.type(screen.getByLabelText(/^Email$/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(await screen.findByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
    await user.click(await screen.findByRole("button", { name: "Resend code" }, { timeout: 2_500 }));

    expect(await screen.findByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
    expect(screen.getByText(PASSWORD_RESET_REQUESTED_MESSAGE)).toBeInTheDocument();
  });

  it("calls onCancel from the email step", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderFlow();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
