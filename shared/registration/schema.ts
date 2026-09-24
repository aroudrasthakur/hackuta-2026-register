import { z } from "zod";
import { containsDangerousMarkup, sanitizePlainText } from "../lib/sanitizeInput";
import { COUNTRIES_OF_RESIDENCE } from "./countries";
import {
  DIETARY_OPTIONS,
  FIELD_LIMITS,
  GENDERS,
  HEAR_ABOUT_OPTIONS,
  HEAR_ABOUT_OTHER_OPTION,
  LEVELS_OF_STUDY,
  MAJOR_OTHER_OPTION,
  MAJORS,
  MAX_AGE,
  MAX_GRADUATION_YEAR,
  MIN_AGE,
  MIN_GRADUATION_YEAR,
  RACE_ETHNICITY_OPTIONS,
  SCHOOL_OTHER_OPTION,
  STATES_OF_RESIDENCE,
  TSHIRT_SIZES,
} from "./constants";
import { isValidEmailSyntax, normalizeEmail } from "../lib/normalizeEmail";
import { MLH_SCHOOLS_SET } from "./mlhSchools";

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function safePlainText(options: {
  max: number;
  min?: number;
  message?: string;
  allowNewlines?: boolean;
}) {
  const { max, min = 1, message = "Invalid input.", allowNewlines = false } = options;
  return z
    .string()
    .transform((value) => sanitizePlainText(value, { allowNewlines }))
    .pipe(
      z
        .string()
        .min(min, message)
        .max(max)
        .refine(
          (value) => !containsDangerousMarkup(value),
          "Please remove HTML or script content.",
        ),
    );
}

function safeOptionalPlainText(options: {
  max: number;
  allowNewlines?: boolean;
  tooLongMessage?: string;
}) {
  const {
    max,
    allowNewlines = false,
    tooLongMessage = "Text is too long.",
  } = options;
  return z
    .string()
    .transform((value) => sanitizePlainText(value, { allowNewlines }))
    .pipe(
      z
        .string()
        .max(max, tooLongMessage)
        .refine(
          (value) => value === "" || !containsDangerousMarkup(value),
          "Please remove HTML or script content.",
        ),
    )
    .optional()
    .transform((value) => value || undefined);
}

function optionalEmail(message = "Enter a valid student email address.") {
  return z
    .string()
    .transform((value) => sanitizePlainText(value).trim())
    .pipe(
      z
        .string()
        .max(FIELD_LIMITS.email, "Student email is too long.")
        .refine(
          (value) => value === "" || !containsDangerousMarkup(value),
          "Please remove HTML or script content.",
        ),
    )
    .optional()
    .transform((value) => normalizeEmail(value))
    .refine(
      (value) => value === undefined || isValidEmailSyntax(value),
      message,
    );
}

function optionalHttpUrl(label: string) {
  return z
    .string()
    .trim()
    .max(FIELD_LIMITS.url, `${label} is too long.`)
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => value === undefined || isValidHttpUrl(value), {
      message: `Enter a valid ${label.toLowerCase()} URL.`,
    });
}

const COUNTRIES_SET = new Set<string>(COUNTRIES_OF_RESIDENCE);
const MAJORS_SET = new Set<string>(MAJORS);
const HEAR_ABOUT_OPTIONS_SET = new Set<string>(HEAR_ABOUT_OPTIONS);

const levelOfStudySchema = z.enum(LEVELS_OF_STUDY, {
  message: "Please select a level of study.",
});
const genderSchema = z.enum(GENDERS, { message: "Please select a gender." });
const raceEthnicitySchema = z.enum(RACE_ETHNICITY_OPTIONS);
const dietaryOptionSchema = z.enum(DIETARY_OPTIONS);
const tshirtSizeSchema = z.enum(TSHIRT_SIZES, {
  message: "Please select a t-shirt size.",
});
const requiredInteger = (label: string, min: number, max: number) =>
  z
    .number({ message: `${label} is required.` })
    .refine((value) => !Number.isNaN(value), `${label} is required.`)
    .pipe(
      z
        .number()
        .int(`${label} must be a whole number.`)
        .min(min, `${label} must be between ${min} and ${max}.`)
        .max(max, `${label} must be between ${min} and ${max}.`),
    );

export const registrationPayloadSchema = z
  .object({
    firstName: safePlainText({
      max: FIELD_LIMITS.name,
      message: "First name is required.",
    }),
    lastName: safePlainText({
      max: FIELD_LIMITS.name,
      message: "Last name is required.",
    }),
    phone: safePlainText({
      max: FIELD_LIMITS.phone,
      message: "Phone number is required.",
    }).refine(isValidPhone, "Enter a valid phone number."),
    age: requiredInteger("Age", MIN_AGE, MAX_AGE),
    school: safePlainText({
      max: FIELD_LIMITS.school,
      message: "Please select a school or university.",
    }).refine(
      (value) =>
        MLH_SCHOOLS_SET.has(value) ||
        (value !== SCHOOL_OTHER_OPTION && value.length > 0),
      "Please select a school from the list or enter your school name.",
    ),
    studentEmail: optionalEmail(),
    countryOfResidence: safePlainText({
      max: 100,
      message: "Please select your country of residence.",
    }).refine((value) => COUNTRIES_SET.has(value), "Please select a country from the list."),
    stateOfResidence: z.enum(STATES_OF_RESIDENCE, {
      message: "Please select your state or territory of residence.",
    }),
    internationalStudent: z.boolean({
      message: "Please let us know if you are an international student.",
    }),
    levelOfStudy: levelOfStudySchema,
    major: safePlainText({
      max: FIELD_LIMITS.major,
      message: "Please select a major or field of study.",
    }).refine(
      (value) => MAJORS_SET.has(value) || (value !== MAJOR_OTHER_OPTION && value.length > 0),
      "Please select a major from the list or describe your field of study.",
    ),
    graduationYear: requiredInteger(
      "Graduation year",
      MIN_GRADUATION_YEAR,
      MAX_GRADUATION_YEAR,
    ),
    gender: genderSchema,
    raceEthnicity: z.array(raceEthnicitySchema).default([]),
    otherRaceEthnicity: safeOptionalPlainText({
      max: FIELD_LIMITS.otherRaceEthnicity,
      tooLongMessage: "Race / ethnicity details are too long.",
    }),
    dietaryRestrictions: z.array(dietaryOptionSchema).default([]),
    otherDietary: safeOptionalPlainText({
      max: FIELD_LIMITS.otherDietary,
      tooLongMessage: "Dietary details are too long.",
    }),
    otherDietaryRestrictions: safeOptionalPlainText({
      max: FIELD_LIMITS.otherDietaryRestrictions,
      tooLongMessage: "Other dietary restrictions are too long.",
    }),
    tshirtSize: tshirtSizeSchema,
    firstHackathon: z.boolean({
      message: "Please let us know if this is your first hackathon.",
    }),
    hearAbout: safePlainText({
      max: FIELD_LIMITS.hearAbout,
      message: "Please select how you heard about HackUTA.",
    }).refine(
      (value) =>
        HEAR_ABOUT_OPTIONS_SET.has(value) ||
        (value !== HEAR_ABOUT_OTHER_OPTION && value.length > 0),
      "Please select how you heard about HackUTA or describe how you heard about us.",
    ),
    resumeStorageId: z.string().min(1).max(128).optional(),
    linkedin: optionalHttpUrl("LinkedIn"),
    github: optionalHttpUrl("GitHub"),
    portfolio: optionalHttpUrl("Portfolio"),
    devpost: optionalHttpUrl("Devpost"),
    accessibilityNeeds: safeOptionalPlainText({
      max: FIELD_LIMITS.accessibilityNeeds,
      allowNewlines: true,
      tooLongMessage: "Accessibility details are too long.",
    }),
    emergencyContactName: safePlainText({
      max: FIELD_LIMITS.name,
      message: "Emergency contact name is required.",
    }),
    emergencyContactPhone: safePlainText({
      max: FIELD_LIMITS.phone,
      message: "Emergency contact phone is required.",
    }).refine(isValidPhone, "Enter a valid phone number."),
    codeOfConductAgreed: z.literal(true, {
      message: "You must agree to the MLH Code of Conduct to continue.",
    }),
    mlhDataSharingConsent: z.literal(true, {
      message: "You must authorize sharing your info with MLH to register.",
    }),
    mlhCommunicationsConsent: z.boolean(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.dietaryRestrictions.includes("Allergies") && !data.otherDietary) {
      ctx.addIssue({
        code: "custom",
        path: ["otherDietary"],
        message: "Please describe your food allergies.",
      });
    }
    if (data.raceEthnicity.includes("Other (Please Specify)") && !data.otherRaceEthnicity) {
      ctx.addIssue({
        code: "custom",
        path: ["otherRaceEthnicity"],
        message: "Please specify your race or ethnicity.",
      });
    }
  });
