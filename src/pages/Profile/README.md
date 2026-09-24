# Profile page (`src/pages/Profile`)

Authenticated applicant dashboard: status, submitted answers, hackathon timeline.

## Overview

| File | Summary |
| --- | --- |
| [ProfilePage.tsx](ProfilePage.tsx) | Loads dashboard query; mock fixture when mock auth on |
| [ProfileSection.tsx](ProfileSection.tsx) | Titled section wrapper |
| [ProfileField.tsx](ProfileField.tsx) | Label + value row (dt/dd) |
| [ApplicantTimeline.tsx](ApplicantTimeline.tsx) | Vertical timeline of hackathon milestones |
| [profileStyles.ts](profileStyles.ts) | Shared typography/layout Tailwind tokens |

## Data flow

| Source | When |
| --- | --- |
| getMyApplicantDashboardRef | Live Convex ([convex/api.ts](../../convex/api.ts)) |
| Inline mock object | useMockAuth().enabled |
| Timeline events | buildHackathonTimeline from [shared/hackathon/](../../../shared/hackathon/) |

## Usage

| Export | Used by |
| --- | --- |
| ProfilePage | [main.tsx](../../main.tsx) route /profile |
| ProfileSection, ProfileField, ApplicantTimeline, profileStyles | ProfilePage only |

## Related

| Location | Role |
| --- | --- |
| [convex/applications.ts](../../../convex/applications.ts) | getMyApplicantDashboard handler |
| [tests/unit/profile-page.test.tsx](../../../tests/unit/profile-page.test.tsx) | Dashboard UI tests |

Parent index: [../README.md](../README.md).
