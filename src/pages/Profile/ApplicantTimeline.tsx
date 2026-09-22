import { profileSection, profileSectionTitle } from "./profileStyles";

type TimelineEvent = {
  id: string;
  label: string;
  timestamp: number | null;
  complete: boolean;
  dateLabel?: string;
};

export function ApplicantTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className={profileSection} aria-label="Application timeline">
      <h3 className={profileSectionTitle}>Timeline</h3>
      <ol className="space-y-5 border-l-2 border-(--sand) pl-5">
        {events.map((event) => (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-[1.625rem] top-1.5 h-3 w-3 rounded-full border-2 ${
                event.complete
                  ? "border-(--ocean) bg-(--ocean)"
                  : "border-(--sand) bg-white"
              }`}
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-(--ink)">{event.label}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-(--mist)">
              {event.dateLabel ??
                (event.timestamp
                  ? new Date(event.timestamp).toLocaleString()
                  : "Pending")}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
