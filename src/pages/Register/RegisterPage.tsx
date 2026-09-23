import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../../components/PageShell";
import { SignOutButton } from "../../components/SignOutButton";
import { StormPageFrame } from "../../components/StormPageFrame";
import { ApplicationForm } from "./ApplicationForm";
import { SuccessStep } from "./SuccessStep";

type RegisterStep = "application" | "success";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegisterStep>("application");

  return (
    <StormPageFrame>
      <PageShell
        frameless
        {...(step === "application"
          ? {
              title: "Join the Odyssey",
              subtitle: "Register for HackUTA 2026",
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
          <ApplicationForm
            onSubmitted={() => {
              setStep("success");
              window.setTimeout(() => navigate("/profile", { replace: true }), 1500);
            }}
          />
        ) : (
          <SuccessStep />
        )}
      </PageShell>
    </StormPageFrame>
  );
}
