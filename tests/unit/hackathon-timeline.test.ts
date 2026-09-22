import { describe, expect, it } from "vitest";
import { HACKATHON_SCHEDULE } from "../../shared/hackathon/schedule";
import { buildHackathonTimeline } from "../../shared/hackathon/timeline";

describe("buildHackathonTimeline", () => {
  const baseHackathon = HACKATHON_SCHEDULE;

  it("returns the four hackathon milestones in order", () => {
    const timeline = buildHackathonTimeline(baseHackathon);

    expect(timeline.map((event) => event.label)).toEqual([
      "Applications open",
      "Deadline to apply",
      "Decisions are out",
      "Hackathon begins",
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
      dateLabel: "TBD",
      timestamp: null,
    });
  });

  it("uses the canonical schedule constants", () => {
    expect(HACKATHON_SCHEDULE.registrationOpensAt).toBe(
      Date.parse("2026-09-21T00:00:00-05:00"),
    );
    expect(HACKATHON_SCHEDULE.startsAt).toBe(Date.parse("2026-11-14T09:00:00-06:00"));
  });
});
