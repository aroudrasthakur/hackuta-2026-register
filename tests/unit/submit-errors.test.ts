import { describe, expect, it } from "vitest";
import {
  isResumeFieldMessage,
  mapConvexErrorToUserMessage,
  mapResumeUploadHttpError,
  mapUploadError,
  SUBMIT_ERROR_MESSAGE,
} from "../../shared/registration/submitErrors";

describe("submit error mapping", () => {
  it("passes through known server messages in production mode", () => {
    expect(
      mapConvexErrorToUserMessage(new Error("You have already submitted an application.")),
    ).toBe("You have already submitted an application.");
  });

  it("maps unknown server failures to a friendly default", () => {
    expect(mapConvexErrorToUserMessage(new Error("Invalid registration data."))).toBe(
      SUBMIT_ERROR_MESSAGE,
    );
  });

  it("treats resume validation messages as field errors", () => {
    expect(mapConvexErrorToUserMessage(new Error("Please select a PDF file."))).toBe(
      "Please select a PDF file.",
    );
    expect(isResumeFieldMessage("Please select a PDF file.")).toBe(true);
  });

  it("maps resume upload HTTP statuses to applicant-friendly copy", () => {
    expect(mapResumeUploadHttpError(422, {})).toBe(
      "The file is not a valid PDF. Please choose another file.",
    );
    expect(mapResumeUploadHttpError(429, { error: "Too many uploads. Please try again later." }))
      .toBe("Too many uploads. Please try again later.");
    expect(mapResumeUploadHttpError(413, {})).toBe("Your PDF must be 5 MB or smaller.");
    expect(mapResumeUploadHttpError(415, {})).toBe("Please select a PDF file.");
    expect(mapResumeUploadHttpError(403, {})).toBe(
      "Resume upload is unavailable. Please try again later or contact us.",
    );
    expect(mapResumeUploadHttpError(500, {})).toBe(
      "We couldn't upload your resume. Please try again.",
    );
  });

  it("translates technical upload server messages into applicant-friendly copy", () => {
    expect(mapResumeUploadHttpError(403, { error: "Origin is not allowed." })).toBe(
      "Resume upload is unavailable. Please try again later or contact us.",
    );
    expect(mapResumeUploadHttpError(411, { error: "Content-Length header is required." })).toBe(
      "We couldn't upload your resume. Please try again.",
    );
    expect(mapUploadError(new Error("The PDF has too many pages."))).toBe(
      "The PDF has too many pages.",
    );
    expect(mapUploadError(new Error("Unexpected server failure"))).toBe(
      "We couldn't upload your resume. Please try again.",
    );
  });

  it("ignores malformed error bodies", () => {
    expect(mapResumeUploadHttpError(429, { error: "  " })).toBe(
      "Too many upload attempts. Please wait a few minutes and try again.",
    );
    expect(mapConvexErrorToUserMessage("not an error")).toBe(SUBMIT_ERROR_MESSAGE);
  });
});
