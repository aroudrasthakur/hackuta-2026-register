import type { z } from "zod";
import type { CountryOfResidence } from "./countries";
import type {
  DIETARY_OPTIONS,
  GENDERS,
  HEAR_ABOUT_OPTIONS,
  LEVELS_OF_STUDY,
  MAJORS,
  RACE_ETHNICITY_OPTIONS,
  SCHOOL_OTHER_OPTION,
  TSHIRT_SIZES,
} from "./constants";
import type { StateOfResidence } from "./usStates";
import type { MlhSchool } from "./mlhSchools";
import { createEmptyApplicantFormValues } from "./applicantFields";
import { registrationPayloadSchema } from "./schema";

export type LevelOfStudy = (typeof LEVELS_OF_STUDY)[number];
export type Gender = (typeof GENDERS)[number];
export type RaceEthnicity = (typeof RACE_ETHNICITY_OPTIONS)[number];
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];
export type Major = (typeof MAJORS)[number];
export type TshirtSize = (typeof TSHIRT_SIZES)[number];
export type HearAboutOption = (typeof HEAR_ABOUT_OPTIONS)[number];

/** UI form state — union refinements for selects; `resume` is client-only. */
export type ApplicationFormData = {
  firstName: string;
  lastName: string;
  phone: string;
  age: string;
  school: MlhSchool | typeof SCHOOL_OTHER_OPTION | "";
  otherSchool: string;
  countryOfResidence: CountryOfResidence | "";
  stateOfResidence: StateOfResidence | "";
  internationalStudent: boolean | null;
  levelOfStudy: LevelOfStudy | "";
  major: Major | "";
  otherMajor: string;
  graduationYear: string;
  gender: Gender | "";
  raceEthnicity: RaceEthnicity[];
  otherRaceEthnicity: string;
  dietaryRestrictions: DietaryOption[];
  otherDietary: string;
  eatsBeef: boolean | null;
  tshirtSize: TshirtSize | "";
  firstHackathon: boolean | null;
  hearAbout: HearAboutOption | "";
  otherHearAbout: string;
  resume: File | null;
  linkedin: string;
  devpost: string;
  github: string;
  portfolio: string;
  accessibilityNeeds: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  codeOfConductAgreed: boolean;
  mlhDataSharingConsent: boolean;
  mlhCommunicationsConsent: boolean;
};

export type RegistrationPayload = z.infer<typeof registrationPayloadSchema>;

export type FieldName = keyof ApplicationFormData;

export const FIELD_ORDER: FieldName[] = [
  "firstName",
  "lastName",
  "phone",
  "age",
  "school",
  "otherSchool",
  "countryOfResidence",
  "stateOfResidence",
  "internationalStudent",
  "levelOfStudy",
  "major",
  "otherMajor",
  "graduationYear",
  "gender",
  "otherRaceEthnicity",
  "otherDietary",
  "eatsBeef",
  "tshirtSize",
  "firstHackathon",
  "hearAbout",
  "otherHearAbout",
  "resume",
  "linkedin",
  "github",
  "portfolio",
  "devpost",
  "emergencyContactName",
  "emergencyContactPhone",
  "codeOfConductAgreed",
  "mlhDataSharingConsent",
];

export const INITIAL_FORM: ApplicationFormData = {
  ...(createEmptyApplicantFormValues() as Omit<ApplicationFormData, "resume">),
  resume: null,
};

/** Maps validation keys to DOM ids used for focus management. */
export const FIELD_FOCUS_IDS: Partial<Record<FieldName, string>> = {
  firstHackathon: "firstHackathon-yes",
  internationalStudent: "internationalStudent-yes",
  eatsBeef: "eatsBeef-yes",
  resume: "resume-upload",
  codeOfConductAgreed: "codeOfConductAgreed",
  mlhDataSharingConsent: "mlhDataSharingConsent",
};
