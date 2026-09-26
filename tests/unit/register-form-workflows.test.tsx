import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLICATION_QUESTIONS,
  GENDER_SELF_DESCRIBE_OPTION,
  HEAR_ABOUT_OTHER_OPTION,
  MAJOR_OTHER_OPTION,
  MAX_HACKATHONS_ATTENDED,
  SCHOOL_OTHER_OPTION,
} from "../../shared/registration/constants";
import {
  RESUME_MISSING_MESSAGE,
  RESUME_UPLOAD_EXPIRED_MESSAGE,
} from "../../shared/registration/resume";
import {
  DRAFT_SAVE_ERROR_MESSAGE,
  RESUME_REMOVE_ERROR_MESSAGE,
  RESUME_UPLOAD_ERROR_MESSAGE,
  SIGN_IN_REQUIRED_MESSAGE,
  SUBMIT_ERROR_MESSAGE,
} from "../../shared/registration/submitErrors";
import type { SavedResumeDraft } from "../../shared/registration/applicantFields";
import type { ApplicationFormData } from "../../shared/registration/types";
import { ApplicationForm } from "../../src/pages/Register/ApplicationForm";
import {
  discardResumeUpload,
  submitRegistration,
  uploadResume,
} from "../../src/pages/Register/registerApi";
import { fillValidApplicationForm, selectListboxOption } from "../fixtures/fillApplicationForm";
import { OTHER_OPTION_FIXTURES } from "../fixtures/otherOptionFixtures";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";

const env = vi.hoisted(() => ({
  authenticated: true,
  hasClient: true,
  draft: undefined as
    | {
        status: string;
        draft: Partial<ApplicationFormData>;
        savedResume?: SavedResumeDraft | null;
        resumeMissing?: boolean;
      }
    | null
    | undefined,
  saveDraft: undefined as unknown as ReturnType<typeof vi.fn>,
  fetchAccessToken: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: () => ({
    isLoading: false,
    isAuthenticated: env.authenticated,
    sessionKey: env.authenticated ? "test-user" : "signed-out",
    signOut: vi.fn(),
  }),
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

  it("hydrates a saved resume after the draft query resolves", async () => {
    env.draft = undefined;
    const { rerender } = render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your saved application…");

    env.draft = {
      status: "draft",
      draft: validRegistrationForm(),
      savedResume: { storageId: "saved-resume", filename: "saved.pdf" },
    };
    rerender(<ApplicationForm onSubmitted={vi.fn()} />);

    expect(await screen.findByText("saved.pdf")).toBeInTheDocument();
    expect(screen.getByText("Saved to your application")).toBeInTheDocument();
  });

  it("shows a missing-resume message after draft hydration when storage is gone", async () => {
    env.draft = undefined;
    const { rerender } = render(<ApplicationForm onSubmitted={vi.fn()} />);

    env.draft = {
      status: "draft",
      draft: validRegistrationForm(),
      savedResume: null,
      resumeMissing: true,
    };
    rerender(<ApplicationForm onSubmitted={vi.fn()} />);

    expect(await screen.findByText(RESUME_MISSING_MESSAGE)).toBeInTheDocument();
  });

  it(
    "shows a retry control when autosave fails and clears it after a successful retry",
    async () => {
      vi.useFakeTimers();
      env.saveDraft.mockRejectedValueOnce(new Error("offline"));
      renderValidForm();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(screen.getByText(DRAFT_SAVE_ERROR_MESSAGE)).toBeInTheDocument();

      vi.useRealTimers();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
      });
      await waitFor(() => {
        expect(env.saveDraft).toHaveBeenCalledTimes(2);
      });
      expect(screen.queryByText(DRAFT_SAVE_ERROR_MESSAGE)).not.toBeInTheDocument();
    },
    15_000,
  );

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

  it("autosaves student email with the rest of the draft patch", async () => {
    vi.useFakeTimers();
    renderValidForm();
    fireEvent.change(document.getElementById("studentEmail")!, {
      target: { value: "student@mail.utexas.edu" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(env.saveDraft).toHaveBeenCalledOnce();
    expect(env.saveDraft.mock.calls[0]?.[0].patch.studentEmail).toBe(
      "student@mail.utexas.edu",
    );
  });

  it("never sends resume fields with autosave so a stale tab cannot detach the resume", async () => {
    vi.useFakeTimers();
    env.draft = { status: "draft", draft: validRegistrationForm(), savedResume: null };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Sam" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(env.saveDraft).toHaveBeenCalledOnce();
    const patch = env.saveDraft.mock.calls[0]?.[0].patch;
    expect(patch).not.toHaveProperty("resumeStorageId");
    expect(patch).not.toHaveProperty("resumeFilename");
  });

  it("autosaves other dietary restrictions with the rest of the draft patch", async () => {
    vi.useFakeTimers();
    renderValidForm();
    fireEvent.change(document.getElementById("otherDietaryRestrictions")!, {
      target: { value: "No shellfish" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(env.saveDraft).toHaveBeenCalledOnce();
    expect(env.saveDraft.mock.calls[0]?.[0].patch.otherDietaryRestrictions).toBe(
      "No shellfish",
    );
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
    const scroll = vi.spyOn(document.getElementById("resume-upload")!, "scrollIntoView");
    await chooseResume(pdf());

    expect(screen.getByText("Too many uploads. Please try again later.")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(uploadResume).toHaveBeenCalledWith(expect.any(File), "jwt");
  });

  it("maps unknown upload failures to the generic resume error", async () => {
    vi.mocked(uploadResume).mockRejectedValueOnce(new Error("socket hang up"));
    renderValidForm();
    await chooseResume(pdf());
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
    expect(submitRegistration).toHaveBeenLastCalledWith(
      expect.objectContaining({ resumeStorageId: "s1" }),
      null,
    );
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");
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

  it("replaces a saved resume when the applicant picks a different file", async () => {
    vi.mocked(uploadResume)
      .mockResolvedValueOnce({ storageId: "s1", uploadToken: "t1" })
      .mockResolvedValueOnce({ storageId: "s2", uploadToken: "t2" });
    renderValidForm();
    await chooseResume(pdf("first.pdf"));
    expect(env.saveDraft).toHaveBeenCalledWith({
      patch: expect.objectContaining({
        resumeStorageId: "s1",
        resumeFilename: "first.pdf",
      }),
    });

    await chooseResume(pdf("second.pdf"));
    expect(env.saveDraft).toHaveBeenLastCalledWith({
      patch: expect.objectContaining({
        resumeStorageId: "s2",
        resumeFilename: "second.pdf",
      }),
    });
    expect(screen.getByText("second.pdf")).toBeInTheDocument();
  });

  it("clears a saved resume from the draft when it is removed", async () => {
    renderValidForm();
    await chooseResume(pdf());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove resume" }));
    });
    expect(env.saveDraft).toHaveBeenLastCalledWith({
      patch: expect.objectContaining({
        resumeStorageId: null,
        resumeFilename: "",
      }),
    });
    expect(screen.queryByText("resume.pdf")).not.toBeInTheDocument();
  });

  it("restores a saved resume after reload and submits without re-uploading", async () => {
    env.draft = {
      status: "draft",
      draft: validRegistrationForm(),
      savedResume: { storageId: "saved-resume", filename: "saved.pdf" },
    };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText("saved.pdf")).toBeInTheDocument();
    expect(screen.getByText("Saved to your application")).toBeInTheDocument();

    await submit();
    await waitFor(() => expect(submitRegistration).toHaveBeenCalledOnce());
    expect(uploadResume).not.toHaveBeenCalled();
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ resumeStorageId: "saved-resume" }),
      null,
    );
  });

  it("cleans up a pending upload when the page unloads or the form unmounts", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    const { unmount } = render(<ApplicationForm onSubmitted={vi.fn()} />);
    await chooseResume(pdf());
    await waitFor(() => expect(uploadResume).toHaveBeenCalledOnce());

    window.dispatchEvent(new Event("beforeunload"));
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");

    vi.mocked(discardResumeUpload).mockClear();
    unmount();
    expect(discardResumeUpload).toHaveBeenCalledWith("t1");
  });

  it("discards an upload when saving it to the draft fails", async () => {
    env.saveDraft.mockRejectedValueOnce(new Error("offline"));
    renderValidForm();
    await chooseResume(pdf());
    await waitFor(() => expect(discardResumeUpload).toHaveBeenCalledWith("t1"));
    expect(screen.getByText(RESUME_UPLOAD_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Saved to your application")).not.toBeInTheDocument();
  });

  it("shows resume-specific draft save failures on the resume field", async () => {
    env.saveDraft.mockRejectedValueOnce(new Error(RESUME_UPLOAD_EXPIRED_MESSAGE));
    renderValidForm();
    await chooseResume(pdf());
    expect(await screen.findByText(RESUME_UPLOAD_EXPIRED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(DRAFT_SAVE_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it("saves the latest form answers with a resume that finishes uploading later", async () => {
    let finishUpload!: () => void;
    vi.mocked(uploadResume).mockImplementationOnce(
      () => new Promise((resolve) => {
        finishUpload = () => resolve({ storageId: "s1", uploadToken: "t1" });
      }),
    );
    renderValidForm();
    await chooseResume(pdf());
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: "Updated" } });
    await act(async () => finishUpload());

    await waitFor(() =>
      expect(env.saveDraft).toHaveBeenCalledWith({
        patch: expect.objectContaining({ firstName: "Updated", resumeStorageId: "s1" }),
      }),
    );
  });

  it("keeps the saved resume and explains when removing it fails", async () => {
    env.draft = {
      status: "draft",
      draft: validRegistrationForm(),
      savedResume: { storageId: "saved-resume", filename: "saved.pdf" },
    };
    env.saveDraft.mockRejectedValueOnce(new Error("offline"));
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove resume" }));
    });

    expect(screen.getByText(RESUME_REMOVE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText("saved.pdf")).toBeInTheDocument();
  });

  it("tells the applicant when their saved resume file is missing", () => {
    env.draft = {
      status: "draft",
      draft: validRegistrationForm(),
      savedResume: null,
      resumeMissing: true,
    };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText(RESUME_MISSING_MESSAGE)).toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText(/Enter your school \/ university/), {
      target: { value: "Mars Academy" },
    });

    selectListboxOption(/Gender/, GENDER_SELF_DESCRIBE_OPTION);
    fireEvent.change(screen.getByPlaceholderText(/Describe your gender/), {
      target: { value: "Genderfluid" },
    });

    selectListboxOption(/Major \/ field of study/, MAJOR_OTHER_OPTION);
    fireEvent.change(screen.getByPlaceholderText(/Describe your major/), {
      target: { value: "Space Law" },
    });

    selectListboxOption(/How did you hear about HackUTA/, HEAR_ABOUT_OTHER_OPTION);
    fireEvent.change(screen.getByPlaceholderText(/Tell us how you heard about HackUTA/), {
      target: { value: "Professor announcement" },
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
        school: SCHOOL_OTHER_OPTION,
        otherSchool: "Mars Academy",
        gender: GENDER_SELF_DESCRIBE_OPTION,
        otherGender: "Genderfluid",
        major: MAJOR_OTHER_OPTION,
        otherMajor: "Space Law",
        hearAbout: HEAR_ABOUT_OTHER_OPTION,
        otherHearAbout: OTHER_OPTION_FIXTURES.hearAbout,
        mlhCodeOfConductAgreed: true,
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

describe("ApplicationForm application questions and hackathon count", () => {
  it("renders the mandatory application question textareas with character limits", () => {
    renderValidForm();

    expect(screen.getByRole("heading", { name: "Application Questions" })).toBeInTheDocument();
    expect(
      screen.getByLabelText(APPLICATION_QUESTIONS.builtOrWantToBuild, { exact: false }),
    ).toHaveAttribute("maxlength", "2000");
    expect(
      screen.getByLabelText(APPLICATION_QUESTIONS.shortDeadlineLearning, { exact: false }),
    ).toHaveAttribute("maxlength", "2000");
    expect(screen.getAllByText(/Up to 2,000 characters\./)).toHaveLength(2);
    expect(
      screen.getByLabelText(/How many hackathons have you attended/, { exact: false }),
    ).toHaveAttribute("max", String(MAX_HACKATHONS_ATTENDED));
  });

  it("hydrates saved application questions and hackathonsAttended from the draft", async () => {
    env.draft = undefined;
    const { rerender } = render(<ApplicationForm onSubmitted={vi.fn()} />);

    env.draft = {
      status: "draft",
      draft: {
        ...validRegistrationForm(),
        builtOrWantToBuild: "Built a campus map app.",
        shortDeadlineLearning: "Learned Convex in one weekend.",
        hackathonsAttended: "3",
        experienceLevel: "Expert",
      },
    };
    rerender(<ApplicationForm onSubmitted={vi.fn()} />);

    expect(
      await screen.findByDisplayValue("Built a campus map app."),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Learned Convex in one weekend.")).toBeInTheDocument();
    expect(screen.getByLabelText(/How many hackathons have you attended/)).toHaveValue(3);
    expect(screen.getByLabelText(/Experience level/)).toHaveTextContent("Expert");
  });

  it("blocks submit until both application questions are answered", async () => {
    renderValidForm();
    fireEvent.change(
      screen.getByLabelText(APPLICATION_QUESTIONS.builtOrWantToBuild, { exact: false }),
      { target: { value: "" } },
    );

    await submit();
    expect(
      screen.getByText(`${APPLICATION_QUESTIONS.builtOrWantToBuild}.`),
    ).toBeInTheDocument();
    expect(submitRegistration).not.toHaveBeenCalled();
  });

  it("includes application questions and hackathonsAttended in the submitted payload", async () => {
    const onSubmitted = vi.fn();
    renderValidForm(onSubmitted);
    await submit();

    await waitFor(() => expect(submitRegistration).toHaveBeenCalledOnce());
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        builtOrWantToBuild: expect.stringContaining("campus events app"),
        shortDeadlineLearning: expect.stringContaining("GitHub Actions"),
        hackathonsAttended: 1,
        experienceLevel: "Intermediate",
      }),
      null,
    );
  });

  it("autosaves experienceLevel with the rest of the draft patch", async () => {
    vi.useFakeTimers();
    renderValidForm();
    await selectListboxOption(/Experience level/, "Advanced");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(env.saveDraft).toHaveBeenCalledOnce();
    expect(env.saveDraft.mock.calls[0]?.[0].patch.experienceLevel).toBe("Advanced");
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
    await waitFor(() =>
      expect(uploadResume).toHaveBeenCalledWith(resume, "mock-auth-token"),
    );
    await submit();

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
    expect(uploadResume).toHaveBeenCalledOnce();
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ resumeStorageId: "s1" }),
      { storageId: "s1", uploadToken: "t1" },
    );
    expect(env.fetchAccessToken).not.toHaveBeenCalled();
  }, 15_000);
});
