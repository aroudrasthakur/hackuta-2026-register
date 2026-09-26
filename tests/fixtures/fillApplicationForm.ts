import { fireEvent, screen, within } from "@testing-library/react";
import {
  APPLICATION_QUESTIONS,
  MIN_GRADUATION_YEAR,
} from "../../shared/registration/constants";
import {
  VALID_COUNTRY,
  VALID_GENDER,
  VALID_LEVEL_OF_STUDY,
  VALID_MAJOR,
  VALID_SCHOOL,
} from "./validRegistrationForm";

function setInputValue(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

export function selectListboxOption(label: RegExp | string, optionName: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: optionName }));
}

function answerYesNo(group: RegExp, answer: "Yes" | "No") {
  fireEvent.click(within(screen.getByRole("group", { name: group })).getByLabelText(answer));
}

/**
 * Fills every required ApplicationForm field through the UI.
 * Callers must mock shared/registration/mlhSchools so VALID_SCHOOL is listed.
 */
export function fillValidApplicationForm() {
  setInputValue(/First name/, "Sam");
  setInputValue(/Last name/, "Test");
  setInputValue(/Phone number/, "2025550123");
  setInputValue(/Age/i, "20");
  setInputValue(/School \/ university/, "Texas at Arlington");
  fireEvent.click(screen.getByRole("button", { name: VALID_SCHOOL }));
  selectListboxOption(/Country of residence/, VALID_COUNTRY);
  selectListboxOption(/State of residence/, "Texas");
  answerYesNo(/Are you an international student/, "No");
  selectListboxOption(/Level of study/, VALID_LEVEL_OF_STUDY);
  selectListboxOption(/Major \/ field of study/, VALID_MAJOR);
  setInputValue(/Expected graduation year/, String(MIN_GRADUATION_YEAR));
  selectListboxOption(/^Gender/, VALID_GENDER);
  selectListboxOption(/T-shirt size/, "M");
  fireEvent.click(
    within(screen.getByRole("group", { name: /Dietary restrictions/ })).getByLabelText("No Beef"),
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: /Dietary restrictions/ })).getByLabelText("No Pork"),
  );
  setInputValue(/How many hackathons have you attended/, "1");
  selectListboxOption(/Experience level/, "Intermediate");
  setInputValue(
    new RegExp(APPLICATION_QUESTIONS.builtOrWantToBuild),
    "I built a campus events app with React and Convex.",
  );
  setInputValue(
    new RegExp(APPLICATION_QUESTIONS.shortDeadlineLearning),
    "Before a hackathon demo, I learned GitHub Actions in one night to deploy our project.",
  );
  selectListboxOption(/How did you hear about HackUTA/, "Discord");
  setInputValue(/Emergency contact name/, "Jane Test");
  setInputValue(/Emergency contact relationship/, "Parent");
  setInputValue(/Emergency contact phone/, "2025550124");
  fireEvent.click(screen.getByLabelText(/MLH Code of Conduct/));
  fireEvent.click(screen.getByLabelText(/authorize HackUTA to share my registration information/));
  fireEvent.click(
    screen.getByLabelText(/cannot guarantee that food served at this event/),
  );
}
