import { cronJobs } from "convex/server";
import { makeFunctionReference } from "convex/server";

const crons = cronJobs();

crons.interval(
  "delete expired unassociated resume uploads",
  { minutes: 15 },
  makeFunctionReference<"mutation">("resumeUploads:cleanupExpiredUploadSessions"),
  {},
);

crons.interval(
  "prune expired rate limit rows",
  { minutes: 15 },
  makeFunctionReference<"mutation">("rateLimits:pruneExpiredRateLimits"),
  {},
);

crons.daily(
  "prune old email delivery rows",
  { hourUTC: 6, minuteUTC: 0 },
  makeFunctionReference<"mutation">("maintenance:pruneOldEmailDeliveries"),
  {},
);

export default crons;
