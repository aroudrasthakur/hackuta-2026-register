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
import { AGE_TOO_HIGH_MESSAGE } from "../../shared/registration/constants";
import type { ApplicationFormData } from "../../shared/registration/types";
import { validRegistrationForm } from "../fixtures/validRegistrationForm";
import {
  fillValidApplicationForm,
  selectListboxOption,
} from "../fixtures/fillApplicationForm";
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
  result: null as
    { status: string; draft: Partial<ApplicationFormData> } | null | undefined,
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
  MLH_SCHOOLS_SET: new Set([
    "The University of Texas at Arlington",
    "Test University",
  ]),
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

function selectSearchableOption(label: RegExp | string, optionName: string) {
  const input = screen.getByLabelText(label);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: optionName } });
  fireEvent.click(screen.getByRole("button", { name: optionName }));
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

  it.each([true, false])(
    "autosaves and restores new answers on remount (answer=%s)",
    async (answer) => {
      vi.stubEnv("VITE_USE_MOCK_API", "false");
      vi.useFakeTimers();
      const view = render(<ApplicationForm onSubmitted={vi.fn()} />);
      selectListboxOption(/Country of residence/, "Canada");
      fireEvent.click(
        within(
          screen.getByRole("group", {
            name: /Are you an international student/,
          }),
        ).getByLabelText(answer ? "Yes" : "No"),
      );
      fireEvent.click(
        within(
          screen.getByRole("group", { name: /Dietary restrictions/ }),
        ).getByLabelText("Halal"),
      );
      if (!answer) {
        fireEvent.click(
          within(
            screen.getByRole("group", { name: /Dietary restrictions/ }),
          ).getByLabelText("No Beef"),
        );
        fireEvent.click(
          within(
            screen.getByRole("group", { name: /Dietary restrictions/ }),
          ).getByLabelText("No Pork"),
        );
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(draftApi.save).toHaveBeenCalledOnce();
      const savedCall = draftApi.save.mock.calls[0];
      if (!savedCall) throw new Error("Expected autosave to capture the form");
      const { patch } = savedCall[0];
      expect(patch).toMatchObject({
        countryOfResidence: "Canada",
        stateOfResidence: "",
        internationalStudent: answer,
        dietaryRestrictions: answer
          ? ["Halal"]
          : ["Halal", "No Beef", "No Pork"],
      });

      view.unmount();
      // Simulate a fresh page waiting for its persisted draft query.
      draftApi.result = undefined;
      const refreshed = render(<ApplicationForm onSubmitted={vi.fn()} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(800);
      });
      expect(draftApi.save).toHaveBeenCalledOnce();
      draftApi.result = { status: "draft", draft: patch };
      refreshed.rerender(<ApplicationForm onSubmitted={vi.fn()} />);
      expect(screen.getByLabelText(/Country of residence/)).toHaveTextContent(
        "Canada",
      );
      expect(screen.getByLabelText(/State of residence/)).toHaveTextContent(
        "Select one",
      );
      expect(screen.getByLabelText(/State of residence/)).toBeDisabled();
      const international = within(
        screen.getByRole("group", { name: /Are you an international student/ }),
      );
      expect(international.getByLabelText(answer ? "Yes" : "No")).toBeChecked();
      expect(
        international.getByLabelText(answer ? "No" : "Yes"),
      ).not.toBeChecked();
      expect(screen.getByLabelText("Halal")).toBeChecked();
      if (answer) {
        expect(screen.getByLabelText("No Beef")).not.toBeChecked();
        expect(screen.getByLabelText("No Pork")).not.toBeChecked();
      } else {
        expect(screen.getByLabelText("No Beef")).toBeChecked();
        expect(screen.getByLabelText("No Pork")).toBeChecked();
      }
      refreshed.unmount();
    },
    15_000,
  );

  it("loads a sparse legacy draft with dietary restrictions unanswered", () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    draftApi.result = { status: "draft", draft: { firstName: "Returning" } };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue("Returning");
    expect(screen.getByLabelText(/State of residence/)).toHaveTextContent(
      "Select one",
    );
    const international = within(
      screen.getByRole("group", { name: /Are you an international student/ }),
    );
    expect(international.getByLabelText("Yes")).not.toBeChecked();
    expect(international.getByLabelText("No")).not.toBeChecked();
    expect(screen.getByLabelText("No Beef")).not.toBeChecked();
    expect(screen.getByLabelText("No Pork")).not.toBeChecked();
  });

  it("shows optional student email near the school field", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(
      screen.getByLabelText(/Student email \(optional\)/),
    ).toBeInTheDocument();
    expect(document.getElementById("studentEmail")).toHaveAttribute(
      "autocomplete",
      "section-student email",
    );
    expect(
      screen.getByText(
        "If you signed up with a personal email, you can provide your school email here.",
      ),
    ).toBeInTheDocument();
  });

  it("autosaves and restores student email", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.useFakeTimers();
    const view = render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.change(document.getElementById("studentEmail")!, {
      target: { value: "student@mail.utexas.edu" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(draftApi.save).toHaveBeenCalledOnce();
    const { patch } = draftApi.save.mock.calls[0]![0];
    expect(patch.studentEmail).toBe("student@mail.utexas.edu");

    view.unmount();
    draftApi.result = { status: "draft", draft: patch };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(document.getElementById("studentEmail")).toHaveValue(
      "student@mail.utexas.edu",
    );
  });

  it("shows a student email validation error for malformed addresses", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.change(document.getElementById("studentEmail")!, {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(
      screen.getByText("Enter a valid student email address."),
    ).toBeInTheDocument();
  });

  it("shows optional other dietary restrictions below the checkboxes", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(
      screen.getByLabelText(/Other dietary restrictions \(optional\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Please describe any dietary restrictions not listed above.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the allergy description above other dietary restrictions", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    fireEvent.click(
      within(
        screen.getByRole("group", { name: /Dietary restrictions/ }),
      ).getByLabelText(/^Allergies$/),
    );

    const allergyField = screen.getByPlaceholderText(
      "Please describe your food allergies",
    );
    const otherDietaryField = screen.getByLabelText(
      /Other dietary restrictions \(optional\)/,
    );

    expect(
      allergyField.compareDocumentPosition(otherDietaryField) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("autosaves and restores other dietary restrictions", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.useFakeTimers();
    const view = render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.change(document.getElementById("otherDietaryRestrictions")!, {
      target: { value: "No shellfish" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(draftApi.save).toHaveBeenCalledOnce();
    const { patch } = draftApi.save.mock.calls[0]![0];
    expect(patch.otherDietaryRestrictions).toBe("No shellfish");

    view.unmount();
    draftApi.result = { status: "draft", draft: patch };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(document.getElementById("otherDietaryRestrictions")).toHaveValue(
      "No shellfish",
    );
  });

  it("does not render standalone beef or pork questions", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(
      screen.queryByRole("group", { name: /Do you eat beef/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /Do you eat pork/i }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: /Dietary restrictions/ }),
      ).getByLabelText("No Beef"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: /Dietary restrictions/ }),
      ).getByLabelText("No Pork"),
    ).toBeInTheDocument();
  });

  it.each([
    ["stateOfResidence", "stateOfResidence"],
    ["internationalStudent", "internationalStudent-yes"],
  ] as const)("focuses unanswered %s on submit", (field, focusId) => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    draftApi.result = {
      status: "draft",
      draft: {
        ...validRegistrationForm(),
        [field]: field === "stateOfResidence" ? "" : null,
      },
    };
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(document.getElementById(focusId)).toHaveFocus();
  });

  it("shows the verified email as read-only context", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
  });

  it("starts new answers empty and associates residence errors", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    const state = screen.getByLabelText(/State of residence/);
    expect(state).toHaveTextContent("Select one");
    expect(state).toBeDisabled();
    expect(state).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByText(
        "Select the state or territory where you currently live.",
      ),
    ).not.toBeInTheDocument();
    const international = within(
      screen.getByRole("group", { name: /Are you an international student/ }),
    );
    expect(international.getByLabelText("Yes")).not.toBeChecked();
    expect(international.getByLabelText("No")).not.toBeChecked();
    expect(screen.getByLabelText("No Beef")).not.toBeChecked();
    expect(screen.getByLabelText("No Pork")).not.toBeChecked();

    selectListboxOption(/Country of residence/, "Canada");
    expect(state).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(state).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByText("Please select your state or territory of residence."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Please let us know if you are an international student.",
      ),
    ).toBeInTheDocument();
  });

  it("requires state when the United States is selected", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    selectListboxOption(/Country of residence/, "United States of America");
    const state = screen.getByLabelText(/State of residence/);
    expect(state).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(state).toHaveAttribute("aria-describedby", "stateOfResidence-error");
    expect(
      screen.getByText("Please select your state or territory of residence."),
    ).toBeInTheDocument();
  });

  it("clears state and state errors when switching away from the United States", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    selectListboxOption(/Country of residence/, "United States of America");
    selectListboxOption(/State of residence/, "Texas");
    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    expect(
      screen.queryByText("Please select your state or territory of residence."),
    ).not.toBeInTheDocument();

    selectListboxOption(/Country of residence/, "Canada");
    const state = screen.getByLabelText(/State of residence/);
    expect(state).toHaveTextContent("Select one");
    expect(state).toBeDisabled();
    expect(state).not.toHaveAttribute("aria-describedby");
    expect(
      screen.queryByText("Please select your state or territory of residence."),
    ).not.toBeInTheDocument();
  });

  it.each([119, 120, 121])(
    "validates age against the 120 upper limit (%i)",
    (age) => {
      render(<ApplicationForm onSubmitted={vi.fn()} />);
      setInputValue(/Age/i, String(age));
      fireEvent.click(
        screen.getByRole("button", { name: "Submit application" }),
      );
      if (age < 120) {
        expect(
          screen.queryByText(AGE_TOO_HIGH_MESSAGE),
        ).not.toBeInTheDocument();
      } else {
        expect(screen.getByText(AGE_TOO_HIGH_MESSAGE)).toBeInTheDocument();
      }
    },
  );

  it("allows independent No Beef and No Pork dietary selections", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("No Beef"));
    expect(screen.getByLabelText("No Beef")).toBeChecked();
    expect(screen.getByLabelText("No Pork")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("No Pork"));
    expect(screen.getByLabelText("No Pork")).toBeChecked();
    fireEvent.click(screen.getByLabelText("No Beef"));
    expect(screen.getByLabelText("No Beef")).not.toBeChecked();
    expect(screen.getByLabelText("No Pork")).toBeChecked();
  });

  it("keeps both new consents unchecked by default and blocks without the waiver", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);

    expect(
      screen.getByLabelText(/HackUTA to share my resume/),
    ).not.toBeChecked();
    const waiver = screen.getByLabelText(
      /cannot guarantee that food served at this event/,
    );
    expect(waiver).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/HackUTA to share my resume/));

    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

    expect(
      screen.getByText(/acknowledge the food allergy/),
    ).toBeInTheDocument();
    fireEvent.click(waiver);
    expect(screen.getByLabelText(/HackUTA to share my resume/)).toBeChecked();
    expect(waiver).toBeChecked();
  });

  it("corrects validation errors and submits optional details with a PDF only once", async () => {
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    const { submitRegistration, uploadResume } =
      await import("../../src/pages/Register/registerApi");
    let finish!: (value: { ok: true }) => void;
    vi.mocked(uploadResume).mockClear().mockResolvedValue({
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
    setInputValueById(
      "devpost",
      "https://devpost.com/hackuta-project",
    );
    setInputValue(/Accessibility needs/, "Step-free access");
    setInputValueById("hackathonsAttended", "2");

    const resume = new File(["%PDF-1.7"], "resume.pdf", {
      type: "application/pdf",
    });
    const resumeInput = document.getElementById(
      "resume-upload",
    ) as HTMLInputElement;
    await user.upload(resumeInput, resume);
    await waitFor(() =>
      expect(uploadResume).toHaveBeenCalledWith(resume, "test-auth-token"),
    );

    const button = screen.getByRole("button", { name: "Submit application" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByLabelText("Resume (optional)")).toBeDisabled();

    await waitFor(() => expect(submitRegistration).toHaveBeenCalledTimes(1));
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        allergyDetails: "No peanuts",
        linkedin: "https://linkedin.com/in/sam",
        portfolio: "https://example.com/sam",
        devpost: "https://devpost.com/hackuta-project",
        accessibilityNeeds: "Step-free access",
        stateOfResidence: "Texas",
        internationalStudent: false,
        dietaryRestrictions: ["No Beef", "No Pork", "Allergies"],
        hackathonsAttended: 2,
        resumeStorageId: "resume-id",
      }),
      null,
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

    fireEvent.click(screen.getByLabelText(/^Other \(Please Specify\)$/));
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

  it.each([
    [
      "devpost",
      "not-a-url",
      "Enter a valid Devpost link on devpost.com, such as devpost.com.",
    ],
    [
      "github",
      "not-a-url",
      "Enter a valid GitHub link on github.com, such as github.com/yourname.",
    ],
    [
      "linkedin",
      "not-a-url",
      "Enter a valid LinkedIn link on linkedin.com, such as linkedin.com/in/yourname.",
    ],
  ] as const)(
    "shows a user-friendly validation error for invalid %s URLs",
    (fieldId, value, message) => {
      render(<ApplicationForm onSubmitted={vi.fn()} />);
      fillValidApplicationForm();
      setInputValueById(fieldId, value);
      fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

      expect(screen.getByText(message)).toBeInTheDocument();
    },
  );

  it.each([
    [
      "github",
      "https://example.com/user",
      "This must be a GitHub link on github.com, such as github.com/yourname.",
    ],
    [
      "linkedin",
      "https://example.com/in/sam",
      "This must be a LinkedIn link on linkedin.com, such as linkedin.com/in/yourname.",
    ],
    [
      "devpost",
      "https://example.com/project",
      "This must be a Devpost link on devpost.com, such as devpost.com.",
    ],
  ] as const)(
    "shows a user-friendly validation error for off-platform %s URLs",
    (fieldId, value, message) => {
      render(<ApplicationForm onSubmitted={vi.fn()} />);
      fillValidApplicationForm();
      setInputValueById(fieldId, value);
      fireEvent.click(screen.getByRole("button", { name: "Submit application" }));

      expect(screen.getByText(message)).toBeInTheDocument();
    },
  );
});
