import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApplicantTimeline } from "../../src/pages/Profile/ApplicantTimeline";

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
    expect(
      screen.getByRole("heading", { name: "Timeline" }),
    ).toBeInTheDocument();
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

    const formattedDate = new Date(timestamp).toLocaleString();
    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });

  it("shows 'Pending' for events without timestamp", () => {
    const events = [
      {
        id: "future-event",
        label: "Future event",
        timestamp: null,
        complete: false,
      },
    ];
    render(<ApplicantTimeline events={events} />);

    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("applies correct styling for completed events", () => {
    const events = [
      {
        id: "completed",
        label: "Completed event",
        timestamp: Date.now(),
        complete: true,
      },
    ];
    const { container } = render(<ApplicantTimeline events={events} />);

    const indicator = container.querySelector('span[aria-hidden="true"]');
    expect(indicator).toHaveClass("border-(--ocean)");
    expect(indicator).toHaveClass("bg-(--ocean)");
  });

  it("applies correct styling for incomplete events", () => {
    const events = [
      {
        id: "incomplete",
        label: "Incomplete event",
        timestamp: null,
        complete: false,
      },
    ];
    const { container } = render(<ApplicantTimeline events={events} />);

    const indicator = container.querySelector('span[aria-hidden="true"]');
    expect(indicator).toHaveClass("border-(--sand)");
    expect(indicator).toHaveClass("bg-white");
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
    const { container } = render(<ApplicantTimeline events={events} />);

    const labels = container.querySelectorAll("li p:first-of-type");
    expect(labels[0]).toHaveTextContent("First");
    expect(labels[1]).toHaveTextContent("Second");
    expect(labels[2]).toHaveTextContent("Third");
  });
});
