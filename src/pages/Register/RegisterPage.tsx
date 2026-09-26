import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../../components/PageShell";
import { OdysseyButton } from "../../components/OdysseyButton";
import { SignOutButton } from "../../components/SignOutButton";
import { formatCentralDeadline } from "../../../shared/hackathon/schedule";
import { APPLICATION_CLOSED_MESSAGE } from "../../../shared/registration/submitErrors";
import { StormPageFrame } from "../../components/StormPageFrame";
import { useHackathonConfig, useRegistrationClosed } from "../../hooks/useHackathonName";
import { ApplicationForm } from "./ApplicationForm";
import { SuccessStep } from "./SuccessStep";

type RegisterStep = "application" | "success";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegisterStep>("application");
  const { name: hackathonName, registrationClosesAt, isLoading } = useHackathonConfig();
  const closed = useRegistrationClosed(registrationClosesAt);

  return (
    <StormPageFrame>
      <PageShell
        frameless
        {...(step === "application"
          ? {
              title: closed ? "Applications are closed" : "Join the Odyssey",
              subtitle: `Register for ${hackathonName}`,
            }
          : {})}
        footer={
          <div className="mt-8 flex flex-col items-center gap-4">
            {step === "application" ? <SignOutButton /> : null}
            <p className="text-center text-xs text-(--mist)">
              Questions?{" "}
              <a
                href="mailto:hello@hackuta.org"
                className="text-(--ocean) underline decoration-1 underline-offset-2 transition-colors hover:text-(--ink)"
              >
                Contact us
              </a>
            </p>
          </div>
        }
      >
        {step === "application" ? (
          isLoading ? (
            <p role="status" className="text-sm text-(--ocean)">Loading registration…</p>
          ) : closed ? (
            <div className="flex flex-col items-start gap-4 text-(--ocean)">
              <p>{APPLICATION_CLOSED_MESSAGE}</p>
              {registrationClosesAt !== null ? (
                <p>Deadline: {formatCentralDeadline(registrationClosesAt)}</p>
              ) : null}
              <p>Your saved draft is retained, but applications can no longer be submitted.</p>
              <OdysseyButton href="/profile">View your profile</OdysseyButton>
            </div>
          ) : (
            <ApplicationForm
              onSubmitted={() => {
                setStep("success");
                window.setTimeout(() => navigate("/profile", { replace: true }), 1500);
              }}
            />
          )
        ) : (
          <SuccessStep />
        )}
      </PageShell>
    </StormPageFrame>
  );
}
