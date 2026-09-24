import { describe, expect, it } from "vitest";
import { HACKATHON_SCHEDULE } from "../../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../../shared/hackathon/timeline";

describe("buildHackathonTimeline", () => {
  const baseHackathon = HACKATHON_SCHEDULE;

  it("returns the hackathon milestones in order", () => {
    const timeline = buildHackathonTimeline(baseHackathon);

    expect(timeline.map((event) => event.label)).toEqual([
      "Applications open",
      "Applications close",
      "Decisions go out",
      "RSVP due",
      "The hackathon begins",
    ]);
  });

  it("marks milestones complete once their date has passed", () => {
    const timeline = buildHackathonTimeline(
      baseHackathon,
      Date.parse("2026-11-08T12:00:00-06:00"),
    );

    expect(timeline.find((event) => event.id === "applications-open")?.complete).toBe(true);
    expect(timeline.find((event) => event.id === "application-deadline")?.complete).toBe(true);
    expect(timeline.find((event) => event.id === "decisions-out")).toMatchObject({
      complete: false,
      dateLabel: "To be announced",
      timestamp: null,
    });
    expect(timeline.find((event) => event.id === "rsvp-due")).toMatchObject({
      complete: false,
      dateLabel: "To be announced",
      timestamp: null,
    });
  });

  it("uses a confirmed decision date when organizers publish one", () => {
    const decisionsReleasedAt = Date.parse("2026-11-10T09:00:00-06:00");
    const timeline = buildHackathonTimeline({
      ...baseHackathon,
      decisionsReleasedAt,
    });

    expect(timeline.find((event) => event.id === "decisions-out")).toMatchObject({
      timestamp: decisionsReleasedAt,
      complete: false,
    });
    expect(timeline.find((event) => event.id === "decisions-out")?.dateLabel).toBeUndefined();
  });

  it("uses the canonical schedule constants", () => {
    expect(HACKATHON_SCHEDULE.registrationOpensAt).toBe(
      Date.parse("2026-09-21T00:00:00-05:00"),
    );
    expect(HACKATHON_SCHEDULE.startsAt).toBe(Date.parse("2026-11-14T09:00:00-06:00"));
  });
});
