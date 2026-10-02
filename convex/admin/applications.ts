import { SCHOOL_OTHER_OPTION } from "../../shared/registration/constants";
import { query } from "../_generated/server";
import { getOrganizerRole } from "./access";

export function queueStatus(review: {
  status: string; reviewedAt?: number; reviewedBy?: string; legacyReviewedBy?: string;
} | null) {
  if (!review) return "Unreviewed" as const;
  switch (review.status) {
    case "accepted": return "Accepted" as const;
    case "waitlisted": return "Waitlisted" as const;
    case "rejected": return "Rejected" as const;
    case "under_review":
      return review.reviewedAt !== undefined || review.reviewedBy !== undefined || review.legacyReviewedBy !== undefined
        ? "Under Review" as const : "Unreviewed" as const;
    default: return null;
  }
}

// A query context cannot write applications, reviews, or logs.
export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getOrganizerRole(ctx))) throw new Error("Organizer access required.");
    const applications = await ctx.db.query("applications").collect();
    const reviews = await ctx.db.query("applicationReviews").collect();
    const byApplication = new Map(reviews.map((review) => [review.applicationId, review]));
    return applications.flatMap((application) => {
      // Drafts have no submission time and are not part of the review queue.
      if (application.submittedAt === undefined) return [];
      const status = queueStatus(byApplication.get(application._id) ?? null);
      if (status === null) return []; // Withdrawn applications are outside the active queue.
      return [{
        id: application._id,
        firstName: application.firstName ?? "",
        lastName: application.lastName ?? "",
        email: application.email,
        school: (application.school === SCHOOL_OTHER_OPTION || application.school === "Other") ? application.otherSchool ?? "Other" : application.school ?? "",
        status,
        submittedAt: application.submittedAt,
      }];
    });
  },
});
