import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import { COUNTRIES_OF_RESIDENCE } from "../../shared/registration/countries";
import { MLH_SCHOOLS } from "../../shared/registration/mlhSchools";
import { validateApplicationForm } from "../../shared/registration/validation";
import { INITIAL_FORM, type ApplicationFormData, type RegistrationPayload } from "../../shared/registration/types";

export const VALID_SCHOOL = MLH_SCHOOLS[0];
export const VALID_COUNTRY = COUNTRIES_OF_RESIDENCE[0];
export const VALID_LEVEL_OF_STUDY = "Undergraduate University (3+ year)" as const;
export const VALID_MAJOR =
  "Computer science, computer engineering, or software engineering" as const;
export const VALID_GENDER = "Man" as const;

export function validRegistrationForm(): ApplicationFormData {
  return {
    ...INITIAL_FORM,
    firstName: "Sam",
    lastName: "Test",
    phone: "5551234567",
    age: "20",
    school: VALID_SCHOOL,
    countryOfResidence: VALID_COUNTRY,
    stateOfResidence: "Texas",
    internationalStudent: false,
    levelOfStudy: VALID_LEVEL_OF_STUDY,
    major: VALID_MAJOR,
    graduationYear: String(MIN_GRADUATION_YEAR),
    gender: VALID_GENDER,
    tshirtSize: "M",
    experienceLevel: "Intermediate",
    hackathonsAttended: "1",
    builtOrWantToBuild: "I built a campus events app with React and Convex.",
    shortDeadlineLearning:
      "Before a hackathon demo, I learned GitHub Actions in one night to deploy our project.",
    hearAbout: "Discord",
    emergencyContactName: "Jane Test",
    emergencyContactPhone: "5559876543",
    MLHcodeOfConductAgreed: true,
    mlhDataSharingConsent: true,
    foodAllergyWaiverAgreed: true,
  };
}

/** Valid server submission payload derived from the shared form fixture. */
export function validRegistrationPayload(): RegistrationPayload {
  const result = validateApplicationForm(validRegistrationForm());
  if (!result.success) {
    throw new Error(`Invalid registration fixture: ${JSON.stringify(result.errors)}`);
  }
  return result.payload;
}
