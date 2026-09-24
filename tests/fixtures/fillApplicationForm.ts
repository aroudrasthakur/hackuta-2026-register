import { fireEvent, screen, within } from "@testing-library/react";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
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
  setInputValue(/Phone number/, "5551234567");
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
  answerYesNo(/Do you eat beef/, "No");
  answerYesNo(/Do you eat pork/, "No");
  answerYesNo(/Is this your first hackathon/, "Yes");
  selectListboxOption(/How did you hear about HackUTA/, "Discord");
  setInputValue(/Emergency contact name/, "Jane Test");
  setInputValue(/Emergency contact phone/, "5559876543");
  fireEvent.click(screen.getByLabelText(/MLH Code of Conduct/));
  fireEvent.click(screen.getByLabelText(/authorize HackUTA to share my registration information/));
}
