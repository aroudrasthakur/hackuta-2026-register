import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "../../src/components/MockAuthProvider";
import { OtpCodeInput } from "../../src/components/OtpCodeInput";
import { ProtectedRoute } from "../../src/components/ProtectedRoute";
import { SignOutButton } from "../../src/components/SignOutButton";
import { MOCK_OTP } from "../../src/constants/mockAuth";
import { defaultMockAuthValue } from "../../src/hooks/mockAuthContext";
import { useMockAuth } from "../../src/hooks/useMockAuth";

const routing = vi.hoisted(() => ({
  value: { isLoading: false, isAuthenticated: false, verifiedEmail: null as string | null, hasSubmittedRegistration: false },
}));
const session = vi.hoisted(() => ({ signOut: vi.fn(async () => undefined) }));

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => routing.value,
}));
vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    sessionKey: "test-user",
    signOut: session.signOut,
  }),
}));

beforeEach(() => {
  vi.unstubAllEnvs();
  routing.value = { isLoading: false, isAuthenticated: false, verifiedEmail: null, hasSubmittedRegistration: false };
  session.signOut = vi.fn(async () => undefined);
});

function ControlledOtp({ initial = "", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <OtpCodeInput
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <output data-testid="otp-value">{value}</output>
    </>
  );
}

describe("OtpCodeInput", () => {
  it("advances focus as digits are typed and ignores non-digits", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp />);
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.keyboard("1a2");
    expect(screen.getByTestId("otp-value")).toHaveTextContent("12");
    expect(cells[2]).toHaveFocus();
  });

  it("fills every cell from a multi-digit autofill into one cell", () => {
    render(<ControlledOtp />);
    const cells = screen.getAllByRole("textbox");
    fireEvent.change(cells[0]!, { target: { value: "98-76" } });
    expect(screen.getByTestId("otp-value")).toHaveTextContent("9876");
    expect(cells[4]).toHaveFocus();
  });

  it("clears a digit when a cell is emptied", () => {
    render(<ControlledOtp initial="123456" />);
    const cells = screen.getAllByRole("textbox");
    fireEvent.change(cells[5]!, { target: { value: "" } });
    expect(screen.getByTestId("otp-value")).toHaveTextContent("12345");
  });

  it("moves focus with Backspace on an empty cell and with arrow keys", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp initial="12" />);
    const cells = screen.getAllByRole("textbox");

    await user.click(cells[2]!);
    await user.keyboard("{Backspace}");
    expect(cells[1]).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(cells[0]).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(cells[0]).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(cells[1]).toHaveFocus();
    await user.click(cells[5]!);
    await user.keyboard("{ArrowRight}");
    expect(cells[5]).toHaveFocus();
  });

  it("does not move focus with Backspace on the first cell", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp />);
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[0]!);
    await user.keyboard("{Backspace}");
    expect(cells[0]).toHaveFocus();
  });

  it("strips formatting from pasted codes and truncates to six digits", async () => {
    const user = userEvent.setup();
    render(<ControlledOtp />);
    const cells = screen.getAllByRole("textbox");
    await user.click(cells[3]!);
    await user.paste("12 34-56 78");
    expect(screen.getByTestId("otp-value")).toHaveTextContent("123456");
    expect(cells[5]).toHaveFocus();
  });

  it("marks every cell invalid and disabled when requested", () => {
    render(<OtpCodeInput value="" onChange={vi.fn()} disabled invalid />);
    for (const cell of screen.getAllByRole("textbox")) {
      expect(cell).toBeDisabled();
      expect(cell).toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("autocomplete", "one-time-code");
  });
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="from">{(location.state as { from?: string } | null)?.from ?? ""}</div>;
}

function renderGuard(guard: Parameters<typeof ProtectedRoute>[0], path = "/register") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<ProtectedRoute {...guard} />} />
        <Route path="/sign-in" element={<><div>Sign In Page</div><LocationProbe /></>} />
        <Route path="/profile" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("shows an accessible loading state while routing resolves", () => {
    routing.value.isLoading = true;
    renderGuard({ children: <div>Secret</div> });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("sends signed-out users to sign in and remembers where they were going", () => {
    renderGuard({ children: <div>Secret</div> });
    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
    expect(screen.getByTestId("from")).toHaveTextContent("/register");
  });

  it("sends applicants who already submitted away from the registration form", () => {
    routing.value = { ...routing.value, isAuthenticated: true, hasSubmittedRegistration: true };
    renderGuard({ children: <div>Secret</div>, requireNoSubmittedRegistration: true });
    expect(screen.getByText("Profile Page")).toBeInTheDocument();
  });

  it("renders children for authorised applicants", () => {
    routing.value = { ...routing.value, isAuthenticated: true };
    renderGuard({ children: <div>Secret</div>, requireNoSubmittedRegistration: true });
    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("allows public routes without authentication", () => {
    renderGuard({ children: <div>Public</div>, requireAuth: false });
    expect(screen.getByText("Public")).toBeInTheDocument();
  });
});

describe("SignOutButton", () => {
  function renderSignOut(props: Parameters<typeof SignOutButton>[0] = {}) {
    return render(
      <MockAuthProvider>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<SignOutButton {...props} />} />
            <Route path="/sign-in" element={<div>Sign In Page</div>} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>,
    );
  }

  it("signs out through the session and returns to sign in", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    const user = userEvent.setup();
    renderSignOut({ className: "wrapper", buttonClassName: "custom-button" });
    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button.className).toContain("custom-button");
    await user.click(button);
    expect(session.signOut).toHaveBeenCalled();
    expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
  });

  it("uses the mock sign-out in mock mode without touching the real session", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    const user = userEvent.setup();
    renderSignOut();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(session.signOut).not.toHaveBeenCalled();
    expect(await screen.findByText("Sign In Page")).toBeInTheDocument();
  });
});

describe("MockAuthProvider", () => {
  function renderMockAuth() {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    return renderHook(() => useMockAuth(), { wrapper: MockAuthProvider });
  }

  it("moves through OTP request, verification, and sign-out", () => {
    const { result } = renderMockAuth();
    expect(result.current).toMatchObject({ enabled: true, isAuthenticated: false, verifiedEmail: null });

    act(() => result.current.requestOtp("pending@example.com"));
    expect(result.current).toMatchObject({ isAuthenticated: false, verifiedEmail: "pending@example.com" });

    let ok = true;
    act(() => {
      ok = result.current.verifyOtp("000000");
    });
    expect(ok).toBe(false);

    act(() => {
      ok = result.current.verifyOtp(MOCK_OTP);
    });
    expect(ok).toBe(true);
    expect(result.current).toMatchObject({
      isAuthenticated: true,
      verifiedEmail: "pending@example.com",
      hasSubmittedRegistration: false,
    });

    act(() => result.current.signOut());
    expect(result.current).toMatchObject({ isAuthenticated: false, verifiedEmail: null });
  });

  it("supports explicit scenarios and resets identity when signed out", () => {
    const { result } = renderMockAuth();
    act(() => result.current.setScenario("signedInReturning"));
    expect(result.current).toMatchObject({
      isAuthenticated: true,
      verifiedEmail: "applicant@example.com",
      hasSubmittedRegistration: true,
    });

    act(() => result.current.setScenario("signedInNew"));
    expect(result.current.hasSubmittedRegistration).toBe(false);

    act(() => result.current.requestOtp("x@example.com"));
    act(() => result.current.setScenario("signedOut"));
    expect(result.current).toMatchObject({ isAuthenticated: false, verifiedEmail: null });
  });

  it("verifies with a default email when no OTP was requested", () => {
    const { result } = renderMockAuth();
    act(() => {
      result.current.verifyOtp(MOCK_OTP);
    });
    expect(result.current.verifiedEmail).toBe("applicant@example.com");
  });

  it("is inert when the mock API is disabled", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    const { result } = renderHook(() => useMockAuth(), { wrapper: MockAuthProvider });
    expect(result.current).toBe(defaultMockAuthValue);
  });

  it("provides safe no-op defaults outside the provider", () => {
    expect(defaultMockAuthValue.verifyOtp(MOCK_OTP)).toBe(false);
    expect(defaultMockAuthValue.requestOtp("a@b.co")).toBeUndefined();
    expect(defaultMockAuthValue.setScenario("signedInNew")).toBeUndefined();
    expect(defaultMockAuthValue.signOut()).toBeUndefined();
  });
});
