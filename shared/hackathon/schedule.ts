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
    registrationClosesAt: hackathon?.registrationClosesAt ?? null,
    decisionsReleasedAt: hackathon?.decisionsReleasedAt ?? null,
  };
}

export function isRegistrationClosed(closesAt: number | null, now = Date.now()) {
  return closesAt !== null && now >= closesAt;
}

export function formatCentralDeadline(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(new Date(timestamp));
}
