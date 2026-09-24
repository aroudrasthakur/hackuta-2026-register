/** Single source of truth for HackUTA 2026 schedule dates. Name lives in eventConfig. */
export const HACKATHON_SCHEDULE = {
  registrationOpensAt: Date.parse("2026-09-25T00:00:00-05:00"),
  registrationClosesAt: null,
  startsAt: Date.parse("2026-11-14T09:00:00-06:00"),
  endsAt: Date.parse("2026-11-15T18:00:00-06:00"),
} as const;

export type HackathonTimelineSource = {
  registrationOpensAt: number;
  registrationClosesAt: number | null;
  decisionsReleasedAt?: number | null;
  startsAt: number;
};

export function resolveHackathonTimelineSource(
  hackathon: HackathonTimelineSource | null | undefined,
): HackathonTimelineSource {
  return {
    ...HACKATHON_SCHEDULE,
    decisionsReleasedAt: hackathon?.decisionsReleasedAt ?? null,
  };
}
