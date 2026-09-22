import {
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "./constants";
import type { ApplicationFormData } from "./types";

export function formToDraftPatch(form: ApplicationFormData) {
  const age =
    form.age.trim() === "" ? undefined : Number.parseInt(form.age.trim(), 10);
  const graduationYear =
    form.graduationYear.trim() === ""
      ? undefined
      : Number.parseInt(form.graduationYear.trim(), 10);

  return {
    firstName: form.firstName.trim() || undefined,
    lastName: form.lastName.trim() || undefined,
    phone: form.phone.trim() || undefined,
    age: age !== undefined && !Number.isNaN(age) ? age : undefined,
    school: form.school || undefined,
    otherSchool:
      form.school === SCHOOL_OTHER_OPTION ? form.otherSchool.trim() || undefined : undefined,
    countryOfResidence: form.countryOfResidence || undefined,
    levelOfStudy: form.levelOfStudy || undefined,
    major: form.major || undefined,
    otherMajor:
      form.major === MAJOR_OTHER_OPTION ? form.otherMajor.trim() || undefined : undefined,
    graduationYear:
      graduationYear !== undefined && !Number.isNaN(graduationYear)
        ? graduationYear
        : undefined,
    gender: form.gender || undefined,
    raceEthnicity: form.raceEthnicity.length > 0 ? form.raceEthnicity : undefined,
    otherRaceEthnicity: form.otherRaceEthnicity.trim() || undefined,
    dietaryRestrictions:
      form.dietaryRestrictions.length > 0 ? form.dietaryRestrictions : undefined,
    otherDietary: form.otherDietary.trim() || undefined,
    tshirtSize: form.tshirtSize || undefined,
    firstHackathon: form.firstHackathon ?? undefined,
    hearAbout: form.hearAbout || undefined,
    otherHearAbout:
      form.hearAbout === HEAR_ABOUT_OTHER_OPTION
        ? form.otherHearAbout.trim() || undefined
        : undefined,
    linkedin: form.linkedin.trim() || undefined,
    github: form.github.trim() || undefined,
    portfolio: form.portfolio.trim() || undefined,
    devpost: form.devpost.trim() || undefined,
    accessibilityNeeds: form.accessibilityNeeds.trim() || undefined,
    emergencyContactName: form.emergencyContactName.trim() || undefined,
    emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
    codeOfConductAgreed: form.codeOfConductAgreed || undefined,
    mlhDataSharingConsent: form.mlhDataSharingConsent || undefined,
    mlhCommunicationsConsent: form.mlhCommunicationsConsent,
  };
}
