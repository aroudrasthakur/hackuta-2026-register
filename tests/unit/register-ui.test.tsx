import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationFormData } from "../../shared/registration/types";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import {
  VALID_COUNTRY,
  VALID_GENDER,
  VALID_LEVEL_OF_STUDY,
  VALID_MAJOR,
  VALID_SCHOOL,
  validRegistrationForm,
} from "../fixtures/validRegistrationForm";
import { LANDING_URL } from "../../src/constants/site";
import { ApplicationForm } from "../../src/pages/Register/ApplicationForm";
import { SuccessStep } from "../../src/pages/Register/SuccessStep";

vi.mock("../../src/hooks/useSessionAuth", () => ({
  useSessionAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
    signOut: vi.fn(),
  }),
}));

vi.mock("../../src/hooks/useApplicantRouting", () => ({
  useApplicantRouting: () => ({
    isLoading: false,
    isAuthenticated: true,
    verifiedEmail: "applicant@example.com",
    hasSubmittedRegistration: false,
  }),
}));

vi.mock("../../src/pages/Register/registerApi", () => ({
  submitRegistration: vi.fn(),
  uploadResume: vi.fn(),
  discardResumeUpload: vi.fn(),
}));

const draftApi = vi.hoisted(() => ({
  result: null as { status: string; draft: Partial<ApplicationFormData> } | null | undefined,
  save: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => draftApi.result,
  useMutation: () => draftApi.save,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({
    fetchAccessToken: vi.fn().mockResolvedValue("test-auth-token"),
  }),
}));

vi.mock("../../src/convex/client", () => ({
  getConvexClient: () => ({}),
}));

vi.mock("../../shared/registration/mlhSchools", () => ({
  MLH_SCHOOLS: ["The University of Texas at Arlington", "Test University"],
  MLH_SCHOOLS_SET: new Set(["The University of Texas at Arlington", "Test University"]),
}));

vi.mock("../../shared/registration/mlhTexasSchools", () => ({
  MLH_TEXAS_SCHOOLS: ["The University of Texas at Arlington"],
}));

function setInputValue(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function setInputValueById(id: string, value: string) {
  const input = document.getElementById(id);
  if (!input) {
    throw new Error(`Expected input #${id}`);
  }
  fireEvent.change(input, { target: { value } });
}

function selectListboxOption(label: RegExp | string, optionName: string) {
  fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: optionName }));
}

function selectSearchableOption(label: RegExp | string, optionName: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: optionName } });
  fireEvent.click(screen.getByRole("button", { name: optionName }));
}

function fillValidApplicationForm() {
  setInputValue(/First name/, "Sam");
  setInputValue(/Last name/, "Test");
  setInputValue(/Phone number/, "5551234567");
  setInputValue(/Age/i, "20");
  setInputValue(/School \/ university/, "Texas at Arlington");
  fireEvent.click(screen.getByRole("button", { name: VALID_SCHOOL }));
  selectListboxOption(/Country of residence/, VALID_COUNTRY);
  selectListboxOption(/State of residence/, "Texas");
  fireEvent.click(
    within(screen.getByRole("group", { name: /Are you an international student/ }))
      .getByLabelText("No"),
  );
  selectListboxOption(/Level of study/, VALID_LEVEL_OF_STUDY);
  selectListboxOption(/Major \/ field of study/, VALID_MAJOR);
  setInputValue(/Expected graduation year/, String(MIN_GRADUATION_YEAR));
  selectListboxOption(/^Gender/, VALID_GENDER);
  selectListboxOption(/T-shirt size/, "M");
  fireEvent.click(
    within(screen.getByRole("group", { name: /Do you eat beef/ }))
      .getByLabelText("No"),
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: /Do you eat pork/ }))
      .getByLabelText("No"),
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: /Is this your first hackathon/ }))
      .getByLabelText("Yes"),
  );
  selectListboxOption(/How did you hear about HackUTA/, "Discord");
  setInputValue(/Emergency contact name/, "Jane Test");
  setInputValue(/Emergency contact phone/, "5559876543");
  fireEvent.click(screen.getByLabelText(/MLH Code of Conduct/));
  fireEvent.click(
    screen.getByLabelText(
      /authorize HackUTA to share my registration information/,
    ),
  );
}

describe("SuccessStep", () => {
  it("focuses the success heading and links back to the landing site", () => {
    render(
      <MemoryRouter>
        <SuccessStep />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByRole("heading", { name: "Your Journey Begins!" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      LANDING_URL,
    );
    expect(
      screen.getByRole("link", { name: "View your application" }),
    ).toHaveAttribute("href", "/profile");
  });
});

describe("ApplicationForm", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    draftApi.result = null;
    draftApi.save.mockClear();
    const api = await import("../../src/pages/Register/registerApi");
    vi.mocked(api.submitRegistration).mockResolvedValue({ ok: true });
    vi.mocked(api.uploadResume).mockResolvedValue({
      storageId: "resume-id",
      uploadToken: "upload-token",
    });
    vi.mocked(api.discardResumeUpload).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([true, false])("autosaves and restores new answers on remount (answer=%s)", async (answer) => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.useFakeTimers();
    const view = render(<ApplicationForm onSubmitted={vi.fn()} />);
    selectListboxOption(/State of residence/, "Outside the United States");
    for (const name of [/Are you an international student/, /Do you eat beef/, /Do you eat pork/]) {
      fireEvent.click(within(screen.getByRole("group", { name })).getByLabelText(answer ? "Yes" : "No"));
    }
    fireEvent.click(within(screen.getByRole("group", { name: /Dietary restrictions/ })).getByLabelText("Halal"));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(draftApi.save).toHaveBeenCalledOnce();
    const savedCall = draftApi.save.mock.calls[0];
    if (!savedCall) throw new Error("Expected autosave to capture the form");
    const { patch } = savedCall[0];
    expect(patch).toMatchObject({
      stateOfResidence: "Outside the United States",
      internationalStudent: answer,
      eatsBeef: answer,
      eatsPork: answer,
      dietaryRestrictions: ["Halal"],
    });

    view.unmount();
    // Simulate a fresh page waiting for its persisted draft query.
    draftApi.result = undefined;
    const refreshed = render(<ApplicationForm onSubmitted={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(draftApi.save).toHaveBeenCalledOnce();
    draftApi.result = { status: "draft", draft: patch };
    refreshed.rerender(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByLabelText(/State of residence/)).toHaveTextContent(
      "Outside the United States",
    );
    for (const name of [/Are you an international student/, /Do you eat beef/, /Do you eat pork/]) {
      const group = within(screen.getByRole("group", { name }));
      expect(group.getByLabelText(answer ? "Yes" : "No")).toBeChecked();
      expect(group.getByLabelText(answer ? "No" : "Yes")).not.toBeChecked();
    }
    expect(screen.getByLabelText("Halal")).toBeChecked();
    refreshed.unmount();
  }, 15_000);

  it("loads a legacy draft with the new questions unanswered", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    draftApi.result = { status: "draft", draft: { firstName: "Returning" } };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue("Returning");
    expect(screen.getByLabelText(/State of residence/)).toHaveTextContent("Select one");
    for (const name of [/Are you an international student/, /Do you eat beef/, /Do you eat pork/]) {
      const group = within(screen.getByRole("group", { name }));
      expect(group.getByLabelText("Yes")).not.toBeChecked();
      expect(group.getByLabelText("No")).not.toBeChecked();
    }
  });

  it.each([
    ["stateOfResidence", "stateOfResidence"],
    ["internationalStudent", "internationalStudent-yes"],
    ["eatsBeef", "eatsBeef-yes"],
    ["eatsPork", "eatsPork-yes"],
  ] as const)("focuses unanswered %s on submit", (field, focusId) => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    draftApi.result = { status: "draft", draft: {
      ...validRegistrationForm(),
      [field]: field === "stateOfResidence" ? "" : null,
    } };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(document.getElementById(focusId)).toHaveFocus();
  });

  it("shows the verified email as read-only context", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
  });

  it("starts new answers empty and associates residence help and errors", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    const state = screen.getByLabelText(/State of residence/);
    expect(state).toHaveTextContent("Select one");
    expect(state).toHaveAttribute("aria-describedby", "stateOfResidence-helper");
    expect(screen.getByText("Select the state or territory where you currently live."))
      .toBeInTheDocument();
    const international = within(
      screen.getByRole("group", { name: /Are you an international student/ }),
    );
    const beef = within(screen.getByRole("group", { name: /Do you eat beef/ }));
    const pork = within(screen.getByRole("group", { name: /Do you eat pork/ }));
    expect(international.getByLabelText("Yes")).not.toBeChecked();
    expect(international.getByLabelText("No")).not.toBeChecked();
    expect(beef.getByLabelText("Yes")).not.toBeChecked();
    expect(beef.getByLabelText("No")).not.toBeChecked();
    expect(pork.getByLabelText("Yes")).not.toBeChecked();
    expect(pork.getByLabelText("No")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(state).toHaveAttribute(
      "aria-describedby",
      "stateOfResidence-helper stateOfResidence-error",
    );
    expect(screen.getByText("Please select your state or territory of residence."))
      .toBeInTheDocument();
    expect(screen.getByText("Please let us know if you are an international student."))
      .toBeInTheDocument();
    expect(screen.getByText("Please let us know if you eat beef."))
      .toBeInTheDocument();
    expect(screen.getByText("Please let us know if you eat pork."))
      .toBeInTheDocument();
  });

  it("corrects validation errors and submits optional details with a PDF only once", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    const { submitRegistration, uploadResume } =
      await import("../../src/pages/Register/registerApi");
    let finish!: (value: { ok: true }) => void;
    vi.mocked(uploadResume)
      .mockClear()
      .mockResolvedValue({
        storageId: "resume-id",
        uploadToken: "upload-token",
      });
    vi.mocked(submitRegistration)
      .mockClear()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );

    render(<ApplicationForm onSubmitted={onSubmitted} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    fillValidApplicationForm();
    expect(
      screen.queryByText("First name is required."),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(
        screen.getByRole("group", { name: /Dietary restrictions/ }),
      ).getByLabelText(/^Allergies$/),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(
      screen.getByText("Please describe your food allergies."),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText("Please describe your food allergies"),
      {
        target: { value: "No peanuts" },
      },
    );
    setInputValueById("linkedin", "https://linkedin.com/in/sam");
    setInputValueById("portfolio", "https://example.com/sam");
    setInputValueById("devpost", "https://devpost.com/software/hackuta-project");
    setInputValue(/Accessibility needs/, "Step-free access");
    fireEvent.click(
      within(screen.getByRole("group", { name: /Is this your first hackathon/ }))
        .getByLabelText("No"),
    );

    const resume = new File(["%PDF-1.7"], "resume.pdf", {
      type: "application/pdf",
    });
    const resumeInput = document.getElementById(
      "resume-upload",
    ) as HTMLInputElement;
    await user.upload(resumeInput, resume);

    const button = screen.getByRole("button", { name: "Submit application" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Resume (optional)")).toBeDisabled();

    await waitFor(() => expect(submitRegistration).toHaveBeenCalledTimes(1));
    expect(uploadResume).toHaveBeenCalledWith(resume, "test-auth-token");
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        otherDietary: "No peanuts",
        linkedin: "https://linkedin.com/in/sam",
        portfolio: "https://example.com/sam",
        devpost: "https://devpost.com/software/hackuta-project",
        accessibilityNeeds: "Step-free access",
        stateOfResidence: "Texas",
        internationalStudent: false,
        eatsBeef: false,
        eatsPork: false,
        firstHackathon: false,
      }),
      { storageId: "resume-id", uploadToken: "upload-token" },
    );

    finish({ ok: true });
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledOnce());
  }, 15_000);

  it("submits a valid application", async () => {
    const onSubmitted = vi.fn();
    const { submitRegistration } =
      await import("../../src/pages/Register/registerApi");
    vi.mocked(submitRegistration).mockResolvedValue({ ok: true });

    render(<ApplicationForm onSubmitted={onSubmitted} />);
    fillValidApplicationForm();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => {
      expect(submitRegistration).toHaveBeenCalled();
      expect(onSubmitted).toHaveBeenCalled();
    });
  });

  it("renders optional profile URL fields including Devpost", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    expect(screen.getByLabelText(/LinkedIn \(optional\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub \(optional\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Portfolio \(optional\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Devpost \(optional\)/)).toBeInTheDocument();
  });

  it("shows follow-up fields when Other options are selected", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    selectListboxOption(/Major \/ field of study/, "Other (please specify)");
    expect(
      screen.getByLabelText(/Describe your major \/ field of study/),
    ).toBeInTheDocument();

    selectListboxOption(/How did you hear about HackUTA/, "Other");
    expect(
      screen.getByLabelText(/Tell us how you heard about HackUTA/),
    ).toBeInTheDocument();

    selectSearchableOption(/School \/ university/, "Other:");
    expect(
      screen.getByLabelText(/Enter your school \/ university/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByLabelText(/^Other \(Please Specify\)$/),
    );
    expect(
      screen.getByPlaceholderText("Please specify your race or ethnicity"),
    ).toBeInTheDocument();
  });

  it("requires follow-up answers for Other selections before submit", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fillValidApplicationForm();

    selectListboxOption(/Major \/ field of study/, "Other (please specify)");
    selectListboxOption(/How did you hear about HackUTA/, "Other");
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(
      screen.getByText("Please describe your major or field of study."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please tell us how you heard about HackUTA."),
    ).toBeInTheDocument();
  });

  it("shows a Devpost validation error for invalid URLs", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fillValidApplicationForm();
    setInputValueById("devpost", "not-a-url");
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(screen.getByText("Enter a valid devpost URL.")).toBeInTheDocument();
  });
});
