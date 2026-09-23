import { describe, expect, it } from "vitest";
import { INITIAL_FORM } from "../../shared/registration/types";
import { isClearedDraftValue } from "../../shared/registration/applicantFields";
import {
  formToDraftPatch,
  mergeDraftPatchIntoProfile,
} from "../../shared/registration/draftMapping";

describe("formToDraftPatch", () => {
  it("sends empty strings and nulls so the server can clear stored values", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      firstName: "",
      lastName: "Test",
      age: "",
      raceEthnicity: [],
      firstHackathon: null,
    });

    expect(patch.firstName).toBe("");
    expect(patch.lastName).toBe("Test");
    expect(patch.age).toBeNull();
    expect(patch.raceEthnicity).toEqual([]);
    expect(isClearedDraftValue(patch.firstName)).toBe(true);
    expect(isClearedDraftValue(patch.raceEthnicity)).toBe(true);
  });
});

describe("mergeDraftPatchIntoProfile", () => {
  it("removes cleared fields from the stored profile", () => {
    const profile = {
      _id: "profile1",
      _creationTime: 1,
      authUserId: "user1",
      email: "test@example.com",
      hackathonId: "hackuta-2026",
      status: "draft" as const,
      eligibilityStatus: "unreviewed" as const,
      confirmationStatus: "unconfirmed" as const,
      createdAt: 1,
      updatedAt: 1,
      firstName: "Old",
      lastName: "Name",
      phone: "5551234567",
      school: "Old School",
    };

    const merged = mergeDraftPatchIntoProfile(
      profile as never,
      formToDraftPatch({
        ...INITIAL_FORM,
        firstName: "",
        lastName: "Name",
        phone: "",
        school: "",
      }),
      {
        email: "test@example.com",
        updatedAt: 2,
      },
    );

    expect(merged.firstName).toBeUndefined();
    expect(merged.phone).toBeUndefined();
    expect(merged.school).toBeUndefined();
    expect(merged.lastName).toBe("Name");
    expect(merged.updatedAt).toBe(2);
  });
});
