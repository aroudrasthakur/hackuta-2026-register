import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { OdysseyButton } from "../../components/OdysseyButton";
import { PageShell } from "../../components/PageShell";
import { SignOutButton } from "../../components/SignOutButton";
import { StormPageFrame } from "../../components/StormPageFrame";
import { useMockAuth } from "../../hooks/useMockAuth";
import { getMyApplicantDashboardRef } from "../../convex/api";
import { getConvexClient } from "../../convex/client";
import { resolveHackathonTimelineSource } from "../../../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../../../shared/hackathon/timeline";
import { ApplicantTimeline } from "./ApplicantTimeline";
import { ProfileField } from "./ProfileField";
import { ProfileSection } from "./ProfileSection";
import {
  profileFieldGrid,
  profileFieldStack,
  profileMetaText,
  profilePageSubtitle,
  profilePageTitle,
  profileStatusBadge,
} from "./profileStyles";

const PROFILE_SHELL = {
  title: "Your Journey",
  subtitle: "HackUTA 2026 applicant dashboard",
} as const;

function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <StormPageFrame>
      <PageShell {...PROFILE_SHELL} frameless>
        {children}
      </PageShell>
    </StormPageFrame>
  );
}

export default function ProfilePage() {
  const mockAuth = useMockAuth();
  const client = getConvexClient();
  const dashboard = useQuery(
    getMyApplicantDashboardRef,
    client && !mockAuth.enabled ? {} : "skip",
  );

  if (!mockAuth.enabled && dashboard === undefined) {
    return (
      <ProfilePageShell>
        <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
          Loading your application…
        </p>
      </ProfilePageShell>
    );
  }

  const mockTimestamp = 1_700_000_000_000;
  const profile = mockAuth.enabled
    ? {
        profile: {
          displayName: "Sam Test",
          verifiedEmail: mockAuth.verifiedEmail,
        },
        registration: mockAuth.hasSubmittedRegistration
          ? {
              status: "submitted",
              eligibilityStatus: "unreviewed",
              submittedAt: mockTimestamp,
              updatedAt: mockTimestamp,
              resumeStatus: "none" as const,
              answers: {
                firstName: "Sam",
                lastName: "Test",
                school: "The University of Texas at Arlington",
                countryOfResidence: "United States of America",
                levelOfStudy: "Undergraduate University (3+ year)",
                graduationYear: 2026,
              },
            }
          : null,
        hackathon: null,
      }
    : dashboard;

  if (!profile) {
    return (
      <ProfilePageShell>
        <p className="text-sm text-red-600" role="alert">
          We couldn&apos;t load your application. Please try again.
        </p>
      </ProfilePageShell>
    );
  }

  const registration = profile.registration;
  const timeline = buildHackathonTimeline(
    resolveHackathonTimelineSource(profile.hackathon),
  );

  return (
    <ProfilePageShell>
      <div className="flex flex-col gap-10">
        <header className="border-b-2 border-(--sand) pb-6">
          <h2 className={profilePageTitle}>Your application</h2>
          <p className={profilePageSubtitle}>
            Track your HackUTA 2026 registration status.
          </p>
        </header>

        <ProfileSection title="Profile">
          <dl className={profileFieldStack}>
            <ProfileField
              label="Verified email"
              value={profile.profile.verifiedEmail ?? "—"}
            />
            {profile.profile.displayName ? (
              <ProfileField label="Name" value={profile.profile.displayName} />
            ) : null}
          </dl>
        </ProfileSection>

        {!registration ? (
          <section className="rounded-lg border-2 border-dashed border-(--sand) p-6">
            <p className={profileMetaText}>You haven&apos;t started an application yet.</p>
            <div className="mt-4 flex justify-center">
              <OdysseyButton href="/register">Start application</OdysseyButton>
            </div>
          </section>
        ) : (
          <>
            <ProfileSection title="Application status">
              <div className="space-y-4">
                <p>
                  <span className={profileStatusBadge}>
                    {registration.status.replace("-", " ")}
                  </span>
                </p>
                {registration.submittedAt ? (
                  <dl className={profileFieldStack}>
                    <ProfileField
                      label="Submitted"
                      value={new Date(registration.submittedAt).toLocaleString()}
                    />
                    <ProfileField
                      label="Resume"
                      value={
                        registration.resumeStatus === "attached"
                          ? "Uploaded"
                          : "Not uploaded"
                      }
                    />
                  </dl>
                ) : (
                  <div className="space-y-3">
                    <p className={profileMetaText}>Your application is incomplete.</p>
                    <div className="flex justify-center">
                      <OdysseyButton href="/register">Continue application</OdysseyButton>
                    </div>
                  </div>
                )}
              </div>
            </ProfileSection>

            {registration.answers ? (
              <ProfileSection title="Submitted details">
                <dl className={profileFieldGrid}>
                  {registration.answers.firstName ? (
                    <ProfileField
                      label="First name"
                      value={registration.answers.firstName}
                    />
                  ) : null}
                  {registration.answers.lastName ? (
                    <ProfileField
                      label="Last name"
                      value={registration.answers.lastName}
                    />
                  ) : null}
                  {registration.answers.school ? (
                    <ProfileField label="School" value={registration.answers.school} />
                  ) : null}
                  {registration.answers.countryOfResidence ? (
                    <ProfileField
                      label="Country of residence"
                      value={registration.answers.countryOfResidence}
                    />
                  ) : null}
                  {registration.answers.levelOfStudy ? (
                    <ProfileField
                      label="Level of study"
                      value={registration.answers.levelOfStudy}
                    />
                  ) : null}
                  {registration.answers.graduationYear ? (
                    <ProfileField
                      label="Graduation year"
                      value={registration.answers.graduationYear}
                    />
                  ) : null}
                </dl>
              </ProfileSection>
            ) : null}
          </>
        )}

        <ApplicantTimeline events={timeline} />

        <div className="border-t-2 border-(--sand) pt-6">
          <SignOutButton />
        </div>
      </div>
    </ProfilePageShell>
  );
}
