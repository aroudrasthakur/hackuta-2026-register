import { describe, expect, it } from "vitest";
import { getApplicantStatusLabel } from "../../src/pages/Profile/applicantStatus";

describe("getApplicantStatusLabel", () => {
  it("returns Under review only for submitted applications awaiting a decision", () => {
    expect(
      getApplicantStatusLabel({ status: "submitted", submittedAt: 1 }),
    ).toBe("Under review");
  });

  it("does not label missing or draft applications as under review", () => {
    expect(getApplicantStatusLabel(null)).toBeNull();
    expect(getApplicantStatusLabel({ status: "draft", submittedAt: null })).toBeNull();
    expect(getApplicantStatusLabel({ status: "draft", submittedAt: 1 })).toBeNull();
    expect(getApplicantStatusLabel({ status: "submitted", submittedAt: null })).toBeNull();
  });

  it("returns the decision status after organizers decide", () => {
    expect(getApplicantStatusLabel({ status: "accepted", submittedAt: 1 })).toBe("accepted");
    expect(getApplicantStatusLabel({ status: "waitlisted", submittedAt: 1 })).toBe("waitlisted");
    expect(getApplicantStatusLabel({ status: "rejected", submittedAt: 1 })).toBe("rejected");
  });
});
