export const SUBMIT_ERROR_MESSAGE =
  "We couldn't submit your application. Please try again.";

export const RESUME_UPLOAD_ERROR_MESSAGE =
  "We couldn't upload your resume. Please try again.";

export const SIGN_IN_REQUIRED_MESSAGE =
  "Please sign in to submit your application.";

/** Server messages safe to show applicants in production. */
const USER_FACING_SERVER_MESSAGES = new Set([
  SIGN_IN_REQUIRED_MESSAGE,
  "You have already submitted an application.",
  "Please upload a valid PDF resume of 5 MB or smaller.",
  "This resume is already attached to another application.",
  "That email address is already associated with another account. Sign in with that email or contact us for help.",
  "Too many resume upload attempts. Please wait a few minutes and try again.",
]);

/** Submission failures that should highlight the resume field. */
const RESUME_FIELD_MESSAGES = new Set([
  "Please select a PDF file.",
  "Your PDF is empty. Please select another file.",
  "Your PDF must be 5 MB or smaller.",
  "Please upload a PDF.",
  "The PDF is too large.",
  "The PDF must be between 1 byte and 5 MB.",
  "The file is not a valid PDF.",
  "The file is not a valid PDF. Please choose another file.",
  "Content-Length header is required.",
  "Invalid upload request.",
  "The PDF has too many pages.",
  "Too many uploads. Please try again later.",
  "Too many resume upload attempts. Please wait a few minutes and try again.",
  "Please upload a valid PDF resume of 5 MB or smaller.",
  "This resume is already attached to another application.",
  RESUME_UPLOAD_ERROR_MESSAGE,
  "Resume upload is unavailable. Please try again later or contact us.",
  "We couldn't upload your resume. Check your connection and try again.",
]);

export function isResumeFieldMessage(message: string) {
  return RESUME_FIELD_MESSAGES.has(message);
}

const UPLOAD_SERVER_MESSAGE_ALIASES: Record<string, string> = {
  "Content-Length header is required.": "We couldn't upload your resume. Please try again.",
  "Invalid upload request.": "We couldn't upload your resume. Please try again.",
  "Origin is not allowed.": "Resume upload is unavailable. Please try again later or contact us.",
  "The resume could not be stored.": RESUME_UPLOAD_ERROR_MESSAGE,
  "Please upload a PDF.": "Please select a PDF file.",
};

function normalizeUploadServerMessage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (UPLOAD_SERVER_MESSAGE_ALIASES[trimmed]) {
    return UPLOAD_SERVER_MESSAGE_ALIASES[trimmed];
  }
  if (isResumeFieldMessage(trimmed)) {
    return trimmed;
  }
  return null;
}

export function mapUploadError(error: unknown): string {
  if (error instanceof Error) {
    const normalized = normalizeUploadServerMessage(error.message);
    if (normalized) return normalized;
  }
  return RESUME_UPLOAD_ERROR_MESSAGE;
}

export function mapConvexErrorToUserMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.trim() : "";
  if (USER_FACING_SERVER_MESSAGES.has(detail)) {
    return detail;
  }
  if (isResumeFieldMessage(detail)) {
    return detail;
  }
  return SUBMIT_ERROR_MESSAGE;
}

export function mapResumeUploadHttpError(
  status: number,
  body: unknown,
): string {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    const normalized = normalizeUploadServerMessage(body.error);
    if (normalized) return normalized;
  }

  switch (status) {
    case 400:
    case 411:
      return "We couldn't upload your resume. Please try again.";
    case 413:
      return "Your PDF must be 5 MB or smaller.";
    case 415:
      return "Please select a PDF file.";
    case 422:
      return "The file is not a valid PDF. Please choose another file.";
    case 429:
      return "Too many upload attempts. Please wait a few minutes and try again.";
    case 403:
      return "Resume upload is unavailable. Please try again later or contact us.";
    default:
      return RESUME_UPLOAD_ERROR_MESSAGE;
  }
}
