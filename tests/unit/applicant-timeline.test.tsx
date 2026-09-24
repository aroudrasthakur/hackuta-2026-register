import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicantTimeline } from "../../src/pages/Profile/ApplicantTimeline";
import { formatTimelineDate } from "../../src/pages/Profile/timelineDate";

describe("ApplicantTimeline", () => {
  it("renders nothing when events array is empty", () => {
    const { container } = render(<ApplicantTimeline events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders timeline heading when events exist", () => {
    const events = [
      {
        id: "email-verified",
        label: "Email verified",
        timestamp: Date.now(),
        complete: true,
      },
    ];
    render(<ApplicantTimeline events={events} />);
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
  });

  it("renders all timeline events", () => {
    const events = [
      {
        id: "email-verified",
        label: "Email verified",
        timestamp: 1700000000000,
        complete: true,
      },
      {
        id: "registration-started",
        label: "Registration started",
        timestamp: 1700100000000,
        complete: true,
      },
      {
        id: "registration-submitted",
        label: "Registration submitted",
        timestamp: null,
        complete: false,
      },
    ];
    render(<ApplicantTimeline events={events} />);

    expect(screen.getByText("Email verified")).toBeInTheDocument();
    expect(screen.getByText("Registration started")).toBeInTheDocument();
    expect(screen.getByText("Registration submitted")).toBeInTheDocument();
  });

  it("displays timestamp for completed events", () => {
    const timestamp = 1700000000000;
    const events = [
      {
        id: "email-verified",
        label: "Email verified",
        timestamp,
        complete: true,
      },
    ];
    render(<ApplicantTimeline events={events} />);

    expect(screen.getByText(formatTimelineDate(timestamp))).toBeInTheDocument();
  });

  it("shows 'To be announced' for events without timestamp", () => {
    const events = [
      {
        id: "future-event",
        label: "Future event",
        timestamp: null,
        complete: false,
      },
    ];
    render(<ApplicantTimeline events={events} />);

    expect(screen.getByText("To be announced")).toBeInTheDocument();
  });

  it("marks completed events in the list", () => {
    const events = [
      {
        id: "completed",
        label: "Completed event",
        timestamp: Date.now(),
        complete: true,
      },
    ];
    const { container } = render(<ApplicantTimeline events={events} />);

    expect(container.querySelector("li")).toHaveAttribute("data-complete", "true");
  });

  it("marks incomplete events in the list", () => {
    const events = [
      {
        id: "incomplete",
        label: "Incomplete event",
        timestamp: null,
        complete: false,
      },
    ];
    const { container } = render(<ApplicantTimeline events={events} />);

    expect(container.querySelector("li")).toHaveAttribute("data-complete", "false");
  });

  it("renders timeline with proper semantic structure", () => {
    const events = [
      {
        id: "event-1",
        label: "Event 1",
        timestamp: Date.now(),
        complete: true,
      },
    ];
    render(<ApplicantTimeline events={events} />);

    const section = screen.getByLabelText("Application timeline");
    expect(section).toBeInTheDocument();
  });

  it("maintains event order", () => {
    const events = [
      { id: "first", label: "First", timestamp: 1, complete: true },
      { id: "second", label: "Second", timestamp: 2, complete: true },
      { id: "third", label: "Third", timestamp: 3, complete: false },
    ];
    render(<ApplicantTimeline events={events} />);

    const labels = screen.getAllByText(/^(First|Second|Third)$/);
    expect(labels[0]).toHaveTextContent("First");
    expect(labels[1]).toHaveTextContent("Second");
    expect(labels[2]).toHaveTextContent("Third");
  });

  it("marks the first incomplete event as next up", () => {
    const events = [
      { id: "first", label: "First", timestamp: 1, complete: true },
      { id: "second", label: "Second", timestamp: 2, complete: false },
      { id: "third", label: "Third", timestamp: 3, complete: false },
    ];
    render(<ApplicantTimeline events={events} />);

    expect(screen.getByText("Next up")).toBeInTheDocument();
  });
});
