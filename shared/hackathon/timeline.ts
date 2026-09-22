import type { HackathonTimelineSource } from "./schedule";

export type TimelineEvent = {
  id: string;
  label: string;
  timestamp: number | null;
  complete: boolean;
  dateLabel?: string;
};

export function buildHackathonTimeline(
  hackathon: HackathonTimelineSource,
  now = Date.now(),
): TimelineEvent[] {
  return [
    {
      id: "applications-open",
      label: "Applications open",
      timestamp: hackathon.registrationOpensAt,
      complete: now >= hackathon.registrationOpensAt,
    },
    {
      id: "application-deadline",
      label: "Deadline to apply",
      timestamp: hackathon.registrationClosesAt,
      complete: now >= hackathon.registrationClosesAt,
    },
    {
      id: "decisions-out",
      label: "Decisions are out",
      timestamp: null,
      complete: false,
      dateLabel: "TBD",
    },
    {
      id: "hackathon-begins",
      label: "Hackathon begins",
      timestamp: hackathon.startsAt,
      complete: now >= hackathon.startsAt,
    },
  ];
}
