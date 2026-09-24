export function formatTimelineDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  })
    .format(new Date(timestamp))
    .toUpperCase();
}
