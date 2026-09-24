import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SignInPasswordInput } from "../../src/components/SignInPasswordInput";

function renderPasswordField(id: string, label = "Password") {
  render(
    <div className="sign-in-field">
      <label className="sign-in-field__label" htmlFor={id}>
        {label}
      </label>
      <SignInPasswordInput id={id} />
    </div>,
  );

  return {
    input: screen.getByLabelText(label),
    toggle: screen.getByRole("button", { name: "Show password" }),
  };
}

describe("SignInPasswordInput", () => {
  it("masks the password initially", () => {
    const { input, toggle } = renderPasswordField("sign-in-password");

    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-label", "Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("reveals and hides the password when the toggle is clicked", async () => {
    const user = userEvent.setup();
    const { input } = renderPasswordField("sign-in-password");

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Hide password" }));

    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps each instance independent when multiple fields are rendered", async () => {
    const user = userEvent.setup();

    render(
      <>
        <div className="sign-in-field">
          <label className="sign-in-field__label" htmlFor="sign-in-password">
            Password
          </label>
          <SignInPasswordInput id="sign-in-password" />
        </div>
        <div className="sign-in-field">
          <label className="sign-in-field__label" htmlFor="sign-in-confirm-password">
            Confirm password
          </label>
          <SignInPasswordInput id="sign-in-confirm-password" />
        </div>
      </>,
    );

    const passwordInput = screen.getByLabelText("Password");
    const confirmInput = screen.getByLabelText("Confirm password");
    const [passwordToggle] = screen.getAllByRole("button", { name: "Show password" });

    await user.click(passwordToggle!);

    expect(passwordInput).toHaveAttribute("type", "text");
    expect(confirmInput).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("does not submit the surrounding form when the toggle is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <div className="sign-in-field">
          <label className="sign-in-field__label" htmlFor="sign-in-password">
            Password
          </label>
          <SignInPasswordInput id="sign-in-password" />
        </div>
        <button type="submit">Sign in</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Show password" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("type", "button");
  });

  it("toggles visibility from the keyboard without clearing the entered value", async () => {
    const user = userEvent.setup();
    const { input, toggle } = renderPasswordField("sign-in-password");

    await user.type(input, "Hackuta1");
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("Hackuta1");

    await user.keyboard(" ");

    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("Hackuta1");
  });
});
