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
import { getApplicantStatusLabel } from "./applicantStatus";
import { ApplicantTimeline } from "./ApplicantTimeline";
import { ProfileAsset } from "./ProfileAsset";
import { ProfileField } from "./ProfileField";
import {
  profileFieldStack,
  profileMetaText,
  profileCompactButton,
  profileOverviewGrid,
  profileOverviewPanel,
  profilePageSubtitle,
  profilePageTitle,
} from "./profileStyles";

const PROFILE_SHELL = {
  title: "Your Journey",
  subtitle: "HackUTA 2026 applicant dashboard",
} as const;

function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <StormPageFrame>
      <ProfileAsset />
      <PageShell {...PROFILE_SHELL} frameless wide compact>
        {children}
      </PageShell>
    </StormPageFrame>
  );
}

function applicantName(
  displayName: string | null | undefined,
  answers: { firstName?: string | null; lastName?: string | null } | null,
) {
  if (displayName?.trim()) return displayName.trim();
  const first = answers?.firstName?.trim();
  const last = answers?.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  return first || last || "—";
}

function yearOfStudy(answers: {
  graduationYear?: number | string | null;
  levelOfStudy?: string | null;
} | null) {
  if (answers?.graduationYear) return String(answers.graduationYear);
  if (answers?.levelOfStudy?.trim()) return answers.levelOfStudy.trim();
  return "—";
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
  const answers = registration?.answers ?? null;
  const timeline = buildHackathonTimeline(
    resolveHackathonTimelineSource(profile.hackathon),
  );
  const submitted = Boolean(registration?.submittedAt && registration.status !== "draft");
  const statusLabel = getApplicantStatusLabel(registration);
  const name = applicantName(profile.profile.displayName, answers);
  const school = answers?.school?.trim() || "—";
  const studyYear = yearOfStudy(answers);

  return (
    <ProfilePageShell>
      <div className="flex flex-col gap-6">
        <header>
          <h2 className={profilePageTitle}>
            {submitted ? "Your application is in" : "Your application"}
          </h2>
          <p className={profilePageSubtitle}>
            {submitted
              ? "Nothing left to do. We'll email you when decisions go out."
              : "Start or finish your application before the deadline. Your progress is saved automatically."}
          </p>
        </header>

        <div className={profileOverviewGrid}>
          <aside className={profileOverviewPanel}>
            <dl className={profileFieldStack}>
              <ProfileField label="Name" value={name} />
              <ProfileField label="School" value={school} />
              <ProfileField label="Year of study" value={studyYear} />
              {statusLabel ? (
                <ProfileField label="Status" value={statusLabel} />
              ) : null}
            </dl>

            {!submitted ? (
              <div className="flex justify-center">
                <OdysseyButton href="/register" className={profileCompactButton}>
                  {registration ? "Continue application" : "Start application"}
                </OdysseyButton>
              </div>
            ) : null}

            <SignOutButton buttonClassName={profileCompactButton} />
          </aside>

          <div className={profileOverviewPanel}>
            <ApplicantTimeline events={timeline} />
            {!registration ? (
              <p className={profileMetaText}>You haven&apos;t started an application yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </ProfilePageShell>
  );
}
