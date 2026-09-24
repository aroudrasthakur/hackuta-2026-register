import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePasswordConfirmation,
  validatePasswordRequirements,
} from "../../../shared/auth/password";
import {
  cooldownStatusFromExpiry,
  formatOtpResendLabel,
  getCooldownWaitSeconds,
  mergeCooldownExpiry,
  OTP_HOURLY_LIMIT_MESSAGE,
  OTP_RESEND_COOLDOWN_SECONDS,
  startCooldownExpiry,
} from "../../../shared/auth/otpRateLimit";
import {
  AUTH_FAILED_MESSAGE,
  mapAuthError,
  OTP_INVALID_MESSAGE,
} from "../../../shared/auth/errorMessages";
import { isValidEmailSyntax, normalizeEmail } from "../../../shared/lib/normalizeEmail";
import { OtpCodeInput } from "../../components/OtpCodeInput";
import { SignInShell } from "../../components/SignInShell";
import { useMockAuth } from "../../hooks/useMockAuth";
import {
  ensureApplicantProfileRef,
  getOtpSendCooldownRef,
  invalidateSessionsAfterPasswordResetRef,
} from "../../convex/api";
import { ForgotPasswordFlow } from "./ForgotPasswordFlow";
import { getConvexClient } from "../../convex/client";
import { useApplicantRouting } from "../../hooks/useApplicantRouting";
import { useSessionAuth } from "../../hooks/useSessionAuth";

type AuthMode = "signUp" | "signIn";
type SignInStep = "credentials" | "verify";
type SignInView = "auth" | "forgotPassword";

type ConvexPasswordSignIn = (
  provider: string,
  formData: FormData,
) => Promise<{ signingIn: boolean }>;

type EnsureProfileMutation = (args: Record<string, never>) => Promise<unknown>;
type FetchAccessToken = (args: { forceRefreshToken: boolean }) => Promise<string | null>;

type ConvexSignOut = () => Promise<void>;

function SignInPageContent({
  convexSignIn,
  convexSignOut,
  ensureProfile,
  fetchAccessToken,
  invalidateSessionsAfterReset,
}: {
  convexSignIn: ConvexPasswordSignIn | null;
  convexSignOut?: ConvexSignOut | null;
  ensureProfile: EnsureProfileMutation | null;
  fetchAccessToken?: FetchAccessToken | null;
  invalidateSessionsAfterReset?: (() => Promise<void>) | null;
}) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useSessionAuth();
  const mockAuth = useMockAuth();
  const routing = useApplicantRouting();
  const client = getConvexClient();

  const [view, setView] = useState<SignInView>("auth");
  const [mode, setMode] = useState<AuthMode>("signUp");
  const [step, setStep] = useState<SignInStep>("credentials");
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);
  const [hourlyLimitReached, setHourlyLimitReached] = useState(false);
  const [cooldownTick, setCooldownTick] = useState(0);

  const cooldown = cooldownStatusFromExpiry(cooldownExpiresAt, hourlyLimitReached);

  useEffect(() => {
    if (getCooldownWaitSeconds(cooldownExpiresAt) <= 0) return;
    const timer = window.setTimeout(() => setCooldownTick((value) => value + 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownExpiresAt, cooldownTick]);

  const routeAfterSignIn = useCallback(async () => {
    if (mockAuth.enabled) {
      navigate(mockAuth.hasSubmittedRegistration ? "/profile" : "/register", { replace: true });
      return;
    }

    if (client && ensureProfile && fetchAccessToken) {
      const token = await fetchAccessToken({ forceRefreshToken: true });
      if (token) {
        await ensureProfile({}).catch(() => undefined);
      }
    }

    navigate(routing.hasSubmittedRegistration ? "/profile" : "/register", { replace: true });
  }, [client, ensureProfile, fetchAccessToken, mockAuth, navigate, routing.hasSubmittedRegistration]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !routing.isLoading && routing.isAuthenticated) {
      void routeAfterSignIn();
    }
  }, [isAuthenticated, isLoading, routeAfterSignIn, routing.isAuthenticated, routing.isLoading]);

  if (
    view === "auth" &&
    !isLoading &&
    isAuthenticated &&
    routing.isAuthenticated
  ) {
    return (
      <Navigate
        to={routing.hasSubmittedRegistration ? "/profile" : "/register"}
        replace
      />
    );
  }

  if (view === "forgotPassword") {
    return (
      <ForgotPasswordFlow
        convexSignIn={convexSignIn}
        convexSignOut={convexSignOut ?? null}
        invalidateSessions={invalidateSessionsAfterReset ?? null}
        onComplete={(message) => {
          setResetSuccessMessage(message);
          setView("auth");
          setMode("signIn");
          setStep("credentials");
          setError(null);
        }}
        onCancel={() => {
          setView("auth");
          setMode("signIn");
          setError(null);
        }}
      />
    );
  }

  const fetchOtpCooldown = async (normalized: string) => {
    if (mockAuth.enabled || !client) {
      return { waitSeconds: 0, hourlyLimitReached: false };
    }
    try {
      return await client.mutation(getOtpSendCooldownRef, { email: normalized });
    } catch {
      return { waitSeconds: 0, hourlyLimitReached: false };
    }
  };

  const handleCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !isValidEmailSyntax(normalized)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === "signUp") {
      try {
        validatePasswordRequirements(password);
        validatePasswordConfirmation(password, confirmPassword);
      } catch (err) {
        setError(mapAuthError(err, mode));
        return;
      }
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (mockAuth.enabled) {
        if (mode === "signUp") {
          mockAuth.requestOtp(normalized);
          setEmail(normalized);
          setStep("verify");
          setCode("");
          setCooldownExpiresAt(startCooldownExpiry(OTP_RESEND_COOLDOWN_SECONDS));
        } else {
          await routeAfterSignIn();
        }
        return;
      }

      const formData = new FormData();
      formData.set("email", normalized);
      formData.set("password", password);
      formData.set("flow", mode);

      if (!convexSignIn) {
        throw new Error(AUTH_FAILED_MESSAGE);
      }

      const result = await convexSignIn("password", formData);
      if (result.signingIn) {
        await routeAfterSignIn();
        return;
      }

      setEmail(normalized);
      setStep("verify");
      setCode("");
      setCooldownExpiresAt(startCooldownExpiry(OTP_RESEND_COOLDOWN_SECONDS));
    } catch (err) {
        setError(mapAuthError(err, mode));
    } finally {
      setPending(false);
    }
  };

  const handleVerifySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const normalized = normalizeEmail(email);
    const trimmedCode = code.trim();
    if (!normalized || trimmedCode.length !== 6) {
      setError(OTP_INVALID_MESSAGE);
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (mockAuth.enabled) {
        const ok = mockAuth.verifyOtp(trimmedCode);
        if (!ok) {
          setError(OTP_INVALID_MESSAGE);
          return;
        }
        await routeAfterSignIn();
        return;
      }

      const formData = new FormData();
      formData.set("email", normalized);
      formData.set("code", trimmedCode);
      formData.set("flow", "email-verification");

      if (!convexSignIn) {
        throw new Error(AUTH_FAILED_MESSAGE);
      }

      const result = await convexSignIn("password", formData);
      if (!result.signingIn) {
        setError(OTP_INVALID_MESSAGE);
        return;
      }

      await routeAfterSignIn();
    } catch {
      setError(OTP_INVALID_MESSAGE);
    } finally {
      setPending(false);
    }
  };

  const handleResendCode = async () => {
    if (pending || cooldown.waitSeconds > 0 || cooldown.hourlyLimitReached) return;

    const normalized = normalizeEmail(email);
    if (!normalized || !password) return;

    setPending(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("email", normalized);
      formData.set("password", password);
      formData.set("flow", mode);

      if (!convexSignIn) {
        throw new Error(AUTH_FAILED_MESSAGE);
      }

      await convexSignIn("password", formData);
      const status = await fetchOtpCooldown(normalized);
      setHourlyLimitReached(status.hourlyLimitReached);
      setCooldownExpiresAt(mergeCooldownExpiry(null, status));
      if (!status.hourlyLimitReached) {
        setCooldownExpiresAt(startCooldownExpiry(OTP_RESEND_COOLDOWN_SECONDS));
      }
    } catch (err) {
      setError(mapAuthError(err, mode));
    } finally {
      setPending(false);
    }
  };

  const shellTitle =
    step === "credentials"
      ? mode === "signUp"
        ? "Create your account"
        : "Welcome back"
      : "Verify your email";

  const shellSubtitle: ReactNode =
    step === "credentials" ? (
      mode === "signUp" ? (
        "Enter your email and choose a password to begin your application."
      ) : (
        "Sign in with your email and password to continue your application."
      )
    ) : (
      <>
        We sent a 6-digit code to{" "}
        <span className="sign-in-card__subtitle-email">{email}</span>.
      </>
    );

  const resendLabel = cooldown.hourlyLimitReached
    ? OTP_HOURLY_LIMIT_MESSAGE
    : formatOtpResendLabel(cooldown.waitSeconds);

  return (
    <SignInShell title={shellTitle} subtitle={shellSubtitle}>
      {step === "credentials" ? (
        <form onSubmit={handleCredentialsSubmit} noValidate className="sign-in-form">
          <label className="sign-in-field" htmlFor="sign-in-email">
            <span className="sign-in-field__label">Email</span>
            <input
              id="sign-in-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              className="sign-in-field__input"
              aria-invalid={!!error}
            />
          </label>

          <label className="sign-in-field" htmlFor="sign-in-password">
            <span className="sign-in-field__label">Password</span>
            <input
              id="sign-in-password"
              type="password"
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              placeholder="••••••••"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              className="sign-in-field__input"
              aria-invalid={!!error}
            />
          </label>

          {mode === "signUp" ? (
            <label className="sign-in-field" htmlFor="sign-in-confirm-password">
              <span className="sign-in-field__label">Confirm password</span>
              <input
                id="sign-in-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setError(null);
                }}
                className="sign-in-field__input"
                aria-invalid={!!error}
              />
            </label>
          ) : null}

          {mode === "signUp" ? (
            <p className="sign-in-message">{PASSWORD_REQUIREMENTS_MESSAGE}</p>
          ) : null}

          {resetSuccessMessage ? (
            <p className="sign-in-message sign-in-message--info" role="status" aria-live="polite">
              {resetSuccessMessage}
            </p>
          ) : null}

          {error ? (
            <p className="sign-in-message sign-in-message--error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button type="submit" className="sign-in-btn" disabled={pending}>
            {pending
              ? mode === "signUp"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signUp"
                ? "Create account"
                : "Sign in"}
          </button>

          {mode === "signIn" ? (
            <button
              type="button"
              className="sign-in-link"
              onClick={() => {
                setView("forgotPassword");
                setError(null);
                setResetSuccessMessage(null);
              }}
            >
              Forgot password?
            </button>
          ) : null}

          <button
            type="button"
            className="sign-in-link"
            onClick={() => {
              setMode(mode === "signUp" ? "signIn" : "signUp");
              setError(null);
              setConfirmPassword("");
              setResetSuccessMessage(null);
            }}
          >
            {mode === "signUp"
              ? "Already have an account? Sign in"
              : "Need an account? Create one"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} noValidate className="sign-in-form">
          <OtpCodeInput
            value={code}
            onChange={setCode}
            disabled={pending}
            invalid={!!error}
          />

          {error ? (
            <p className="sign-in-message sign-in-message--error" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}

          <button type="submit" className="sign-in-btn" disabled={pending || code.length !== 6}>
            {pending ? "Verifying…" : "Verify email"}
          </button>

          <div className="sign-in-otp__footer">
            <button
              type="button"
              className="sign-in-resend"
              disabled={pending || cooldown.waitSeconds > 0 || cooldown.hourlyLimitReached}
              onClick={() => void handleResendCode()}
            >
              {resendLabel}
            </button>
            <button
              type="button"
              className="sign-in-link"
              onClick={() => {
                setStep("credentials");
                setCode("");
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </div>
        </form>
      )}
    </SignInShell>
  );
}

function SignInPageWithConvex() {
  const { signIn, signOut } = useAuthActions();
  const { fetchAccessToken } = useConvexAuth();
  const ensureProfile = useMutation(ensureApplicantProfileRef);
  const invalidateSessionsAfterReset = useMutation(
    invalidateSessionsAfterPasswordResetRef,
  );
  return (
    <SignInPageContent
      convexSignIn={signIn}
      convexSignOut={signOut}
      ensureProfile={ensureProfile}
      fetchAccessToken={fetchAccessToken}
      invalidateSessionsAfterReset={() => invalidateSessionsAfterReset({})}
    />
  );
}

export default function SignInPage() {
  const mockAuth = useMockAuth();
  if (mockAuth.enabled) {
    return <SignInPageContent convexSignIn={null} ensureProfile={null} />;
  }
  return <SignInPageWithConvex />;
}
