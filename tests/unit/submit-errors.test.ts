import { describe, expect, it } from "vitest";
import {
  isResumeFieldMessage,
  mapConvexErrorToUserMessage,
  mapResumeUploadHttpError,
  mapUploadError,
  SUBMIT_ERROR_MESSAGE,
} from "../../shared/registration/submitErrors";
import {
  RESUME_EMPTY_ERROR_MESSAGE,
  RESUME_SIZE_ERROR_MESSAGE,
} from "../../shared/registration/resume";

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
    expect(mapResumeUploadHttpError(413, {})).toBe(RESUME_SIZE_ERROR_MESSAGE);
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

  it("does not map empty uploads to the size-limit message", () => {
    expect(mapResumeUploadHttpError(413, { error: RESUME_EMPTY_ERROR_MESSAGE })).toBe(
      RESUME_EMPTY_ERROR_MESSAGE,
    );
    expect(mapResumeUploadHttpError(413, { error: RESUME_EMPTY_ERROR_MESSAGE })).not.toBe(
      RESUME_SIZE_ERROR_MESSAGE,
    );
    expect(mapResumeUploadHttpError(413, { error: "The PDF is empty." })).toBe(
      RESUME_EMPTY_ERROR_MESSAGE,
    );
    expect(mapUploadError(new Error("The PDF is empty."))).toBe(RESUME_EMPTY_ERROR_MESSAGE);
  });

  it.each([
    "The PDF is too large.",
    "The PDF must be between 1 byte and 2 MB.",
    "The PDF must be between 1 byte and 5 MB.",
  ])("normalizes legacy oversized upload messages: %s", (legacyMessage) => {
    expect(mapUploadError(new Error(legacyMessage))).toBe(RESUME_SIZE_ERROR_MESSAGE);
    expect(mapResumeUploadHttpError(413, { error: legacyMessage })).toBe(
      RESUME_SIZE_ERROR_MESSAGE,
    );
    expect(mapConvexErrorToUserMessage(new Error(legacyMessage))).toBe(
      RESUME_SIZE_ERROR_MESSAGE,
    );
  });

  it("keeps invalid MIME or upload-session errors separate from size errors", () => {
    const validationMessage = "Please upload a valid PDF resume of 2 MB or smaller.";

    expect(mapConvexErrorToUserMessage(new Error(validationMessage))).toBe(
      validationMessage,
    );
    expect(mapConvexErrorToUserMessage(new Error(validationMessage))).not.toBe(
      RESUME_SIZE_ERROR_MESSAGE,
    );
  });

  it("ignores malformed error bodies", () => {
    expect(mapResumeUploadHttpError(429, { error: "  " })).toBe(
      "Too many upload attempts. Please wait a few minutes and try again.",
    );
    expect(mapConvexErrorToUserMessage("not an error")).toBe(SUBMIT_ERROR_MESSAGE);
  });
});
