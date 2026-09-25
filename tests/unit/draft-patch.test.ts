import { describe, expect, it } from "vitest";
import { INITIAL_FORM, type ApplicationFormData } from "../../shared/registration/types";
import {
  GENDER_SELF_DESCRIBE_OPTION,
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "../../shared/registration/constants";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";
import {
  APPLICANT_ANSWER_FIELD_KEYS,
  isClearedDraftValue,
} from "../../shared/registration/applicantFields";
import {
  applicationToDraftForm,
  formToDraftPatch,
  mergeDraftPatchIntoApplication,
  savedResumeFromStoredApplication,
} from "../../shared/registration/draftMapping";
describe("formToDraftPatch", () => {
  it("includes every registered applicant answer field in the autosave patch", () => {
    const patch = formToDraftPatch(validRegistrationForm());
    for (const key of APPLICANT_ANSWER_FIELD_KEYS) {
      expect(patch).toHaveProperty(key);
    }
  });

  it("sends empty strings and nulls so the server can clear stored values", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      firstName: "",
      lastName: "Test",
      age: "",
      raceEthnicity: [],
      hackathonsAttended: "",
      stateOfResidence: "",
      internationalStudent: null,
      dietaryRestrictions: ["No Beef", "No Pork"],
    });

    expect(patch.firstName).toBe("");
    expect(patch.lastName).toBe("Test");
    expect(patch.age).toBeNull();
    expect(patch.hackathonsAttended).toBeNull();
    expect(patch.raceEthnicity).toEqual([]);
    expect(patch.stateOfResidence).toBe("");
    expect(patch.internationalStudent).toBeNull();
    expect(patch.dietaryRestrictions).toEqual(["No Beef", "No Pork"]);
    expect(isClearedDraftValue(patch.dietaryRestrictions)).toBe(false);
    expect(isClearedDraftValue(patch.firstName)).toBe(true);
    expect(isClearedDraftValue(patch.raceEthnicity)).toBe(true);
    expect(patch.otherDietaryRestrictions).toBe("");
    expect(isClearedDraftValue(patch.otherDietaryRestrictions)).toBe(true);
  });

  it("normalizes student email in draft patches", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      studentEmail: "  Student@Mail.UTA.edu  ",
    });

    expect(patch.studentEmail).toBe("student@mail.uta.edu");
  });

  it("trims other dietary restrictions in draft patches", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      otherDietaryRestrictions: "  No shellfish  ",
    });

    expect(patch.otherDietaryRestrictions).toBe("No shellfish");
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
      gender: GENDER_SELF_DESCRIBE_OPTION,
      otherGender: " Genderfluid ",
    });

    expect(patch.otherSchool).toBe("Mars Academy");
    expect(patch.otherMajor).toBe("Space Law");
    expect(patch.otherHearAbout).toBe("A friend");
    expect(patch.otherGender).toBe("Genderfluid");
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
      gender: "Man",
      otherGender: "Genderfluid",
    });

    expect(patch.otherSchool).toBe("");
    expect(patch.otherMajor).toBe("");
    expect(patch.otherHearAbout).toBe("");
    expect(patch.otherGender).toBe("");
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

describe("applicationToDraftForm", () => {
  it("round-trips a fully answered form through the draft patch", () => {
    const form = { ...validRegistrationForm(), sponsorSharingConsent: true };
    const { resume: _resume, ...expected } = form;
    void _resume;
    expect(applicationToDraftForm(formToDraftPatch(form))).toEqual(expected);
  });

  it("hydrates legacy merged school text as Other + otherSchool", () => {
    const restored = applicationToDraftForm({
      school: "Mars Academy",
    });

    expect(restored.school).toBe(SCHOOL_OTHER_OPTION);
    expect(restored.otherSchool).toBe("Mars Academy");
  });

  it("normalizes the legacy school Other sentinel on hydration", () => {
    const restored = applicationToDraftForm({
      school: "Other:",
      otherSchool: "Mars Academy",
    });

    expect(restored.school).toBe(SCHOOL_OTHER_OPTION);
    expect(restored.otherSchool).toBe("Mars Academy");
  });

  it("hydrates legacy merged major and hear-about text", () => {
    const restored = applicationToDraftForm({
      major: "Biomedical engineering",
      hearAbout: "Professor announcement",
    });

    expect(restored.major).toBe(MAJOR_OTHER_OPTION);
    expect(restored.otherMajor).toBe("Biomedical engineering");
    expect(restored.hearAbout).toBe(HEAR_ABOUT_OTHER_OPTION);
    expect(restored.otherHearAbout).toBe("Professor announcement");
  });

  it("hydrates legacy merged gender text as self-describe + otherGender", () => {
    const restored = applicationToDraftForm({
      gender: "Genderfluid",
    });

    expect(restored.gender).toBe(GENDER_SELF_DESCRIBE_OPTION);
    expect(restored.otherGender).toBe("Genderfluid");
  });

  it("defaults every field for an empty application", () => {
    const restored = applicationToDraftForm({});
    expect(restored.firstName).toBe("");
    expect(restored.otherSchool).toBe("");
    expect(restored.age).toBe("");
    expect(restored.raceEthnicity).toEqual([]);
    expect(restored.hackathonsAttended).toBe("");
    expect(restored.codeOfConductAgreed).toBe(false);
    expect(restored.mlhCommunicationsConsent).toBe(false);
    expect(restored.sponsorSharingConsent).toBe(false);
    expect(restored.foodAllergyWaiverAgreed).toBe(false);
  });

  it("converts stored numbers to strings and keeps explicit null integers blank", () => {
    const restored = applicationToDraftForm({ age: 0, graduationYear: null });
    expect(restored.age).toBe("0");
    expect(restored.graduationYear).toBe("");
  });

  it("maps legacy firstHackathon answers to hackathonsAttended counts", () => {
    const legacy = (value: Record<string, unknown>) =>
      applicationToDraftForm(value as Parameters<typeof applicationToDraftForm>[0]);

    expect(legacy({ firstHackathon: true }).hackathonsAttended).toBe("0");
    expect(legacy({ firstHackathon: false }).hackathonsAttended).toBe("1");
    expect(legacy({ firstHackathon: false, hackathonsAttended: 4 }).hackathonsAttended).toBe(
      "4",
    );
  });

  it("loads older drafts without new answers as unanswered", () => {
    const restored = applicationToDraftForm({ firstName: "Returning" });
    expect(restored.stateOfResidence).toBe("");
    expect(restored.internationalStudent).toBeNull();
    expect(restored.dietaryRestrictions).toEqual([]);
    expect(restored.otherDietaryRestrictions).toBe("");
  });

  it("persists saved resume metadata in draft patches and restores it for the form", () => {
    const patch = formToDraftPatch(validRegistrationForm(), {
      storageId: "resume-123",
      filename: "my-resume.pdf",
    });
    expect(patch.resumeStorageId).toBe("resume-123");
    expect(patch.resumeFilename).toBe("my-resume.pdf");

    expect(
      savedResumeFromStoredApplication({
        resumeStorageId: "resume-123",
        resumeFilename: "my-resume.pdf",
      }),
    ).toEqual({
      storageId: "resume-123",
      filename: "my-resume.pdf",
    });

    const cleared = formToDraftPatch(validRegistrationForm(), null);
    expect(cleared.resumeStorageId).toBeNull();
    expect(cleared.resumeFilename).toBe("");

    const autosave = formToDraftPatch(validRegistrationForm());
    expect(autosave).not.toHaveProperty("resumeStorageId");
    expect(autosave).not.toHaveProperty("resumeFilename");
  });

  it("only writes a resume filename together with its storage reference", () => {
    const meta = { email: "a@example.com", updatedAt: 1 };
    const existing = { resumeStorageId: "resume-1", resumeFilename: "keep.pdf" };

    expect(
      mergeDraftPatchIntoApplication(existing, { resumeFilename: "hijack.pdf" } as never, meta),
    ).toMatchObject({ resumeStorageId: "resume-1", resumeFilename: "keep.pdf" });
    expect(
      mergeDraftPatchIntoApplication(
        existing,
        { resumeStorageId: "resume-2", resumeFilename: "  new.pdf  " } as never,
        meta,
      ),
    ).toMatchObject({ resumeStorageId: "resume-2", resumeFilename: "new.pdf" });
  });

  it("clears state in draft patches and restored forms when the country is not the United States", () => {
    const patch = formToDraftPatch({
      ...INITIAL_FORM,
      countryOfResidence: "Canada",
      stateOfResidence: "Texas",
    });
    expect(patch.stateOfResidence).toBe("");

    const restored = applicationToDraftForm({
      countryOfResidence: "Canada",
      stateOfResidence: "Outside the United States",
    });
    expect(restored.stateOfResidence).toBe("");
  });

  it("restores stored other dietary restrictions", () => {
    const restored = applicationToDraftForm({
      otherDietaryRestrictions: "No shellfish",
    });
    expect(restored.otherDietaryRestrictions).toBe("No shellfish");
  });

  it("defaults missing student email on older applications", () => {
    const restored = applicationToDraftForm({ firstName: "Returning" });
    expect(restored.studentEmail).toBe("");
  });

  it("restores stored student email", () => {
    const restored = applicationToDraftForm({ studentEmail: "student@mail.utexas.edu" });
    expect(restored.studentEmail).toBe("student@mail.utexas.edu");
  });
});

describe("mergeDraftPatchIntoApplication", () => {
  it("removes cleared fields from the stored application", () => {
    const application = {
      _id: "application1",
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

    const merged = mergeDraftPatchIntoApplication(
      application as never,
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

  it("keeps dietary restriction selections and stamps verification metadata", () => {
    const merged = mergeDraftPatchIntoApplication(
      { authUserId: "user1", dietaryRestrictions: ["Halal"] } as Record<string, unknown>,
      formToDraftPatch({ ...INITIAL_FORM, dietaryRestrictions: ["Halal", "No Beef"] }),
      { email: "a@b.co", emailVerificationTime: 9, updatedAt: 3 },
    );
    expect(merged.dietaryRestrictions).toEqual(["Halal", "No Beef"]);
    expect(merged.emailVerificationTime).toBe(9);
    expect(merged.authUserId).toBe("user1");
  });

  it("persists other dietary restrictions and clears them when blank", () => {
    const withValue = mergeDraftPatchIntoApplication(
      { authUserId: "user1" } as Record<string, unknown>,
      formToDraftPatch({ ...INITIAL_FORM, otherDietaryRestrictions: "Low sodium" }),
      { email: "a@b.co", updatedAt: 3 },
    );
    expect(withValue.otherDietaryRestrictions).toBe("Low sodium");

    const cleared = mergeDraftPatchIntoApplication(
      { authUserId: "user1", otherDietaryRestrictions: "Low sodium" } as Record<string, unknown>,
      formToDraftPatch({ ...INITIAL_FORM, otherDietaryRestrictions: "" }),
      { email: "a@b.co", updatedAt: 4 },
    );
    expect(cleared.otherDietaryRestrictions).toBeUndefined();
  });
});
