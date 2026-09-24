import { describe, expect, it } from "vitest";
import { INITIAL_FORM, type ApplicationFormData } from "../../shared/registration/types";
import {
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "../../shared/registration/constants";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";
import { isClearedDraftValue } from "../../shared/registration/applicantFields";
import {
  formToDraftPatch,
  mergeDraftPatchIntoProfile,
  profileToDraftForm,
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
      stateOfResidence: "",
      internationalStudent: null,
      eatsBeef: false,
      eatsPork: true,
    });

    expect(patch.firstName).toBe("");
    expect(patch.lastName).toBe("Test");
    expect(patch.age).toBeNull();
    expect(patch.raceEthnicity).toEqual([]);
    expect(patch.stateOfResidence).toBe("");
    expect(patch.internationalStudent).toBeNull();
    expect(patch.eatsBeef).toBe(false);
    expect(patch.eatsPork).toBe(true);
    expect(isClearedDraftValue(patch.eatsBeef)).toBe(false);
    expect(isClearedDraftValue(patch.eatsPork)).toBe(false);
    expect(isClearedDraftValue(patch.firstName)).toBe(true);
    expect(isClearedDraftValue(patch.raceEthnicity)).toBe(true);
  });
});

describe("formToDraftPatch conditional fields", () => {
  it("keeps trimmed 'Other' answers only when the matching Other option is selected", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      school: SCHOOL_OTHER_OPTION,
      otherSchool: "  Mars Academy  ",
      major: MAJOR_OTHER_OPTION,
      otherMajor: " Space Law ",
      hearAbout: HEAR_ABOUT_OTHER_OPTION,
      otherHearAbout: " A friend ",
    });

    expect(patch.otherSchool).toBe("Mars Academy");
    expect(patch.otherMajor).toBe("Space Law");
    expect(patch.otherHearAbout).toBe("A friend");
  });

  it("clears stale 'Other' answers when a listed option is chosen instead", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      school: "The University of Texas at Arlington",
      otherSchool: "Mars Academy",
      major: "Computer science, computer engineering, or software engineering",
      otherMajor: "Space Law",
      hearAbout: "Discord",
      otherHearAbout: "A friend",
    });

    expect(patch.otherSchool).toBe("");
    expect(patch.otherMajor).toBe("");
    expect(patch.otherHearAbout).toBe("");
  });

  it("parses integer fields and treats non-numeric input as cleared", () => {
    expect(formToDraftPatch({ ...INITIAL_FORM, age: " 21 " }).age).toBe(21);
    expect(formToDraftPatch({ ...INITIAL_FORM, age: "abc" }).age).toBeNull();
    expect(formToDraftPatch({ ...INITIAL_FORM, graduationYear: "2028" }).graduationYear).toBe(2028);
  });

  it("copies array answers so later form edits cannot mutate the saved patch", () => {
    const form: ApplicationFormData = { ...INITIAL_FORM, dietaryRestrictions: ["Vegan"] };
    const patch = formToDraftPatch(form);
    form.dietaryRestrictions.push("Halal");
    expect(patch.dietaryRestrictions).toEqual(["Vegan"]);
  });
});

describe("profileToDraftForm", () => {
  it("round-trips a fully answered form through the draft patch", () => {
    const form = validRegistrationForm();
    const { resume: _resume, ...expected } = form;
    void _resume;
    expect(profileToDraftForm(formToDraftPatch(form))).toEqual(expected);
  });

  it("defaults every field for an empty profile", () => {
    const restored = profileToDraftForm({});
    expect(restored.firstName).toBe("");
    expect(restored.otherSchool).toBe("");
    expect(restored.age).toBe("");
    expect(restored.raceEthnicity).toEqual([]);
    expect(restored.firstHackathon).toBeNull();
    expect(restored.codeOfConductAgreed).toBe(false);
    expect(restored.mlhCommunicationsConsent).toBe(false);
  });

  it("converts stored numbers to strings and keeps explicit null integers blank", () => {
    const restored = profileToDraftForm({ age: 0, graduationYear: null });
    expect(restored.age).toBe("0");
    expect(restored.graduationYear).toBe("");
  });

  it("loads older drafts without new answers as unanswered", () => {
    const restored = profileToDraftForm({ firstName: "Returning" });
    expect(restored.stateOfResidence).toBe("");
    expect(restored.internationalStudent).toBeNull();
    expect(restored.eatsBeef).toBeNull();
    expect(restored.eatsPork).toBeNull();
  });
});

describe("mergeDraftPatchIntoProfile", () => {
  it("removes cleared fields from the stored profile", () => {
    const profile = {
      _id: "profile1",
      _creationTime: 1,
      authUserId: "user1",
      email: "test@example.com",
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
    expect(merged).not.toHaveProperty("_id");
    expect(merged).not.toHaveProperty("_creationTime");
  });

  it("keeps explicit false answers and stamps verification metadata", () => {
    const merged = mergeDraftPatchIntoProfile(
      { authUserId: "user1", eatsBeef: true } as Record<string, unknown>,
      formToDraftPatch({ ...INITIAL_FORM, eatsBeef: false }),
      { email: "a@b.co", emailVerificationTime: 9, updatedAt: 3 },
    );
    expect(merged.eatsBeef).toBe(false);
    expect(merged.emailVerificationTime).toBe(9);
    expect(merged.authUserId).toBe("user1");
  });
});
