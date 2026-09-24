import type { TimelineEvent } from "../../../shared/hackathon/timeline";
import { formatTimelineDate } from "./timelineDate";

function eventDateLabel(event: TimelineEvent) {
  if (event.dateLabel) return event.dateLabel;
  if (event.timestamp) return formatTimelineDate(event.timestamp);
  return "To be announced";
}

export function ApplicantTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  const nextUpId = events.find((event) => !event.complete)?.id;

  return (
    <section aria-label="Application timeline">
      <h3 className="sr-only">Timeline</h3>
      <ol className="divide-y divide-(--sand)">
        {events.map((event) => {
          const isNextUp = event.id === nextUpId;

          return (
            <li
              key={event.id}
              data-complete={event.complete ? "true" : "false"}
              className={`grid gap-1 py-4 first:pt-0 last:pb-0 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-6 ${
                event.complete ? "opacity-70" : ""
              }`}
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-(--mist)">
                {eventDateLabel(event)}
              </p>
              <div>
                {isNextUp ? (
                  <p className="mb-1 text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-(--ocean)">
                    Next up
                  </p>
                ) : null}
                <p className="text-base font-semibold text-(--ink)">{event.label}</p>
                {event.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-(--mist)">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
