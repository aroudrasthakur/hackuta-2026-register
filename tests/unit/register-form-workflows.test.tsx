import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  SCHOOL_OTHER_OPTION,
} from "../../shared/registration/constants";
import {
  DRAFT_SAVE_ERROR_MESSAGE,
  SIGN_IN_REQUIRED_MESSAGE,
  SUBMIT_ERROR_MESSAGE,
} from "../../shared/registration/submitErrors";
import type { ApplicationFormData } from "../../shared/registration/types";
import { ApplicationForm } from "../../src/pages/Register/ApplicationForm";
import {
  discardResumeUpload,
  submitRegistration,
  uploadResume,
} from "../../src/pages/Register/registerApi";
import { fillValidApplicationForm, selectListboxOption } from "../fixtures/fillApplicationForm";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";

const env = vi.hoisted(() => ({
  authenticated: true,
  hasClient: true,
  draft: undefined as { status: string; draft: Partial<ApplicationFormData> } | null | undefined,
  saveDraft: undefined as unknown as ReturnType<typeof vi.fn>,
  fetchAccessToken: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: () => ({ isLoading: false, isAuthenticated: env.authenticated, signOut: vi.fn() }),
}));
vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => ({
    isLoading: false,
    isAuthenticated: env.authenticated,
    verifiedEmail: env.authenticated ? "applicant@example.com" : null,
    hasSubmittedRegistration: false,
  }),
}));
vi.mock("../../src/pages/Register/registerApi", () => ({
  submitRegistration: vi.fn(),
  uploadResume: vi.fn(),
  discardResumeUpload: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: (_ref: unknown, args: unknown) => (args === "skip" ? null : env.draft),
  useMutation: () => env.saveDraft,
}));
vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ fetchAccessToken: env.fetchAccessToken }),
}));
vi.mock("../../src/convex/client", () => ({
  getConvexClient: () => (env.hasClient ? {} : null),
}));
vi.mock("../../shared/registration/mlhSchools", () => ({
  MLH_SCHOOLS: ["The University of Texas at Arlington", "Test University"],
  MLH_SCHOOLS_SET: new Set(["The University of Texas at Arlington", "Test University"]),
}));
vi.mock("../../shared/registration/mlhTexasSchools", () => ({
  MLH_TEXAS_SCHOOLS: ["The University of Texas at Arlington"],
}));

const pdf = (name = "resume.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf", lastModified: 1 });

function renderValidForm(onSubmitted = vi.fn()) {
  env.draft = { status: "draft", draft: validRegistrationForm() };
  const view = render(<ApplicationForm onSubmitted={onSubmitted} />);
  return { ...view, onSubmitted };
}

// The form stores the file only after discarding any pending upload (async), so flush inside act.
async function chooseResume(file: File) {
  await act(async () => {
    fireEvent.change(document.getElementById("resume-upload")!, { target: { files: [file] } });
  });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_USE_MOCK_API", "false");
  env.authenticated = true;
  env.hasClient = true;
  env.draft = null;
  env.saveDraft = vi.fn().mockResolvedValue({ ok: true });
  env.fetchAccessToken = vi.fn().mockResolvedValue("jwt");
  vi.mocked(submitRegistration).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(uploadResume).mockReset().mockResolvedValue({ storageId: "s1", uploadToken: "t1" });
  vi.mocked(discardResumeUpload).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("ApplicationForm draft loading and autosave", () => {
  it("shows a loading state until the saved draft arrives", () => {
    env.draft = undefined;
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your saved application…");
  });

  it("shows a retry control when autosave fails and clears it after a successful retry", async () => {
    vi.useFakeTimers();
    env.saveDraft.mockRejectedValueOnce(new Error("offline"));
    renderValidForm();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(screen.getByText(DRAFT_SAVE_ERROR_MESSAGE)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    });
    expect(env.saveDraft).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(DRAFT_SAVE_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it("logs autosave failures in development builds", async () => {
    vi.stubEnv("DEV", true);
    vi.useFakeTimers();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    env.saveDraft.mockRejectedValueOnce(new Error("offline"));
    renderValidForm();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(consoleError).toHaveBeenCalledWith("Draft save failed:", expect.any(Error));
  });

  it("debounces autosave so rapid edits produce one save", async () => {
    vi.useFakeTimers();
    renderValidForm();
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "S" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Sa" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(env.saveDraft).toHaveBeenCalledTimes(1);
    expect(env.saveDraft.mock.calls[0]?.[0].patch.firstName).toBe("Sa");
  });

  it("never autosaves over an already-submitted application", async () => {
    vi.useFakeTimers();
    env.draft = { status: "submitted", draft: {} };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(env.saveDraft).not.toHaveBeenCalled();
  });

  it("does not autosave without a Convex client", async () => {
    vi.useFakeTimers();
    env.hasClient = false;
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(env.saveDraft).not.toHaveBeenCalled();
  });
});

describe("ApplicationForm submission failures and recovery", () => {
  it("asks signed-out applicants to sign in instead of submitting", async () => {
    env.authenticated = false;
    renderValidForm();
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(SIGN_IN_REQUIRED_MESSAGE);
    expect(submitRegistration).not.toHaveBeenCalled();
  });

  it("aborts submission when the final draft save fails", async () => {
    env.saveDraft.mockRejectedValue(new Error("offline"));
    renderValidForm();
    await submit();
    expect(screen.getByText(DRAFT_SAVE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(submitRegistration).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled();
  });

  it("shows upload failures on the resume field, scrolls to it, and does not submit", async () => {
    vi.mocked(uploadResume).mockRejectedValueOnce(new Error("Too many uploads. Please try again later."));
    renderValidForm();
    await chooseResume(pdf());
    const scroll = vi.spyOn(document.getElementById("resume-upload")!, "scrollIntoView");
    await submit();

    expect(screen.getByText("Too many uploads. Please try again later.")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(submitRegistration).not.toHaveBeenCalled();
    expect(uploadResume).toHaveBeenCalledWith(expect.any(File), "jwt");
  });

  it("maps unknown upload failures to the generic resume error", async () => {
    vi.mocked(uploadResume).mockRejectedValueOnce(new Error("socket hang up"));
    renderValidForm();
    await chooseResume(pdf());
    await submit();
    expect(screen.getByText("We couldn't upload your resume. Please try again.")).toBeInTheDocument();
  });

  it("retries a failed submission without re-uploading the same resume", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitRegistration).mockRejectedValueOnce(new Error("Service unavailable"));
    const { onSubmitted } = renderValidForm();
    await chooseResume(pdf());

    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(SUBMIT_ERROR_MESSAGE);
    expect(onSubmitted).not.toHaveBeenCalled();

    await submit();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(uploadResume).toHaveBeenCalledTimes(1);
    expect(submitRegistration).toHaveBeenLastCalledWith(expect.any(Object), { storageId: "s1", uploadToken: "t1" });
    expect(discardResumeUpload).not.toHaveBeenCalled();
  });

  it("routes resume-related submission failures to the resume field", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitRegistration).mockRejectedValueOnce(
      new Error("This resume is already attached to another application."),
    );
    renderValidForm();
    await chooseResume(pdf());
    const scroll = vi.spyOn(document.getElementById("resume-upload")!, "scrollIntoView");
    await submit();

    expect(screen.getByText("This resume is already attached to another application.")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(screen.queryByText(SUBMIT_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it("discards the previous upload when the applicant picks a different resume", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitRegistration).mockRejectedValueOnce(new Error("Service unavailable"));
    vi.mocked(uploadResume)
      .mockResolvedValueOnce({ storageId: "s1", uploadToken: "t1" })
      .mockResolvedValueOnce({ storageId: "s2", uploadToken: "t2" });
    const { onSubmitted } = renderValidForm();
    await chooseResume(pdf("first.pdf"));
    await submit();

    await chooseResume(pdf("second.pdf"));
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");

    await submit();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(submitRegistration).toHaveBeenLastCalledWith(expect.any(Object), { storageId: "s2", uploadToken: "t2" });
  });

  it("discards an uploaded resume that was removed before resubmitting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitRegistration).mockRejectedValueOnce(new Error("Service unavailable"));
    const { onSubmitted } = renderValidForm();
    await chooseResume(pdf());
    await submit();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove resume" }));
    });
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");

    await submit();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(submitRegistration).toHaveBeenLastCalledWith(expect.any(Object), null);
  });

  it("cleans up a pending upload when the page unloads or the form unmounts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitRegistration).mockRejectedValue(new Error("Service unavailable"));
    const { unmount } = renderValidForm();
    await chooseResume(pdf());
    await submit();

    window.dispatchEvent(new Event("beforeunload"));
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");

    vi.mocked(discardResumeUpload).mockClear();
    unmount();
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");
  });

  it("does not attempt cleanup on unload when nothing is pending", () => {
    renderValidForm();
    window.dispatchEvent(new Event("beforeunload"));
    expect(discardResumeUpload).not.toHaveBeenCalled();
  });

  it("shows invalid resume selections inline and clears them once a PDF is chosen", async () => {
    renderValidForm();
    await chooseResume(new File(["x"], "resume.docx", { type: "application/msword" }));
    expect(screen.getByText("Please select a PDF file.")).toBeInTheDocument();

    await chooseResume(pdf());
    expect(screen.queryByText("Please select a PDF file.")).not.toBeInTheDocument();
  });

  it("disables the submit button and shows progress while submitting", async () => {
    let finish!: () => void;
    vi.mocked(submitRegistration).mockImplementationOnce(
      () => new Promise((resolve) => {
        finish = () => resolve({ ok: true });
      }),
    );
    renderValidForm();
    await submit();
    const button = screen.getByRole("button", { name: "Submitting your application…" });
    expect(button).toBeDisabled();

    fireEvent.submit(button.closest("form")!);
    expect(submitRegistration).toHaveBeenCalledTimes(1);
    await act(async () => finish());
  });
});

describe("ApplicationForm conditional answers", () => {
  it("submits the typed 'Other' answers and optional consents", async () => {
    const { onSubmitted } = renderValidForm();

    const school = screen.getByLabelText(/School \/ university/);
    fireEvent.focus(school);
    fireEvent.change(school, { target: { value: SCHOOL_OTHER_OPTION } });
    fireEvent.click(screen.getByRole("button", { name: SCHOOL_OTHER_OPTION }));
    fireEvent.change(screen.getByLabelText(/Enter your school \/ university/), {
      target: { value: "Mars Academy" },
    });

    selectListboxOption(/Major \/ field of study/, MAJOR_OTHER_OPTION);
    fireEvent.change(screen.getByLabelText(/Describe your major/), { target: { value: "Space Law" } });

    selectListboxOption(/How did you hear about HackUTA/, HEAR_ABOUT_OTHER_OPTION);
    fireEvent.change(screen.getByLabelText(/Tell us how you heard about HackUTA/), {
      target: { value: "A friend" },
    });

    fireEvent.click(
      within(screen.getByRole("group", { name: /Race/ })).getByLabelText(/^Other \(Please Specify\)$/),
    );
    fireEvent.change(screen.getByPlaceholderText("Please specify your race or ethnicity"), {
      target: { value: "Custom" },
    });

    fireEvent.change(document.getElementById("github")!, { target: { value: "https://github.com/sam" } });
    fireEvent.click(screen.getByLabelText(/authorize MLH to send me occasional emails/));

    await submit();
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        school: "Mars Academy",
        major: "Space Law",
        hearAbout: "A friend",
        otherRaceEthnicity: "Custom",
        github: "https://github.com/sam",
        mlhCommunicationsConsent: true,
      }),
      null,
    );
  });

  it("clears a field error as soon as the applicant edits that field", async () => {
    env.draft = { status: "draft", draft: { ...validRegistrationForm(), firstName: "" } };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    await submit();
    expect(screen.getByText("First name is required.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Sam" } });
    expect(screen.queryByText("First name is required.")).not.toBeInTheDocument();
    expect(screen.queryByText(/One or more of your answers is invalid/)).not.toBeInTheDocument();
  });
});

describe("ApplicationForm in mock API mode", () => {
  it("starts empty, never autosaves, and uploads with the mock auth token", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.useFakeTimers();
    const onSubmitted = vi.fn();
    render(<ApplicationForm onSubmitted={onSubmitted} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(env.saveDraft).not.toHaveBeenCalled();
    vi.useRealTimers();

    fillValidApplicationForm();
    const resume = pdf();
    await chooseResume(resume);
    await submit();

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(uploadResume).toHaveBeenCalledWith(resume, "mock-auth-token");
    expect(env.fetchAccessToken).not.toHaveBeenCalled();
  });
});
