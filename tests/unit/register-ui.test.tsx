import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import {
  VALID_COUNTRY,
  VALID_GENDER,
  VALID_LEVEL_OF_STUDY,
  VALID_MAJOR,
  VALID_SCHOOL,
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

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn().mockResolvedValue({ ok: true }),
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

function fillValidApplicationForm() {
  setInputValue(/First name/, "Sam");
  setInputValue(/Last name/, "Test");
  setInputValue(/Phone number/, "5551234567");
  setInputValue(/Age/i, "20");
  setInputValue(/School \/ university/, "Texas at Arlington");
  fireEvent.click(screen.getByRole("button", { name: VALID_SCHOOL }));
  fireEvent.change(screen.getByLabelText(/Country of residence/), {
    target: { value: VALID_COUNTRY },
  });
  fireEvent.change(screen.getByLabelText(/State of residence/), {
    target: { value: "Texas" },
  });
  fireEvent.click(
    within(screen.getByRole("group", { name: /Are you an international student/ })).getByLabelText(/^No$/),
  );
  fireEvent.change(screen.getByLabelText(/Level of study/), {
    target: { value: VALID_LEVEL_OF_STUDY },
  });
  fireEvent.change(screen.getByLabelText(/Major \/ field of study/), {
    target: { value: VALID_MAJOR },
  });
  setInputValue(/Expected graduation year/, String(MIN_GRADUATION_YEAR));
  fireEvent.change(screen.getByLabelText(/^Gender/), {
    target: { value: VALID_GENDER },
  });
  fireEvent.change(screen.getByLabelText(/T-shirt size/), {
    target: { value: "M" },
  });
  fireEvent.click(
    within(screen.getByRole("group", { name: /Do you eat beef/ })).getByLabelText(/^Yes$/),
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: /Is this your first hackathon/ })).getByLabelText(/^Yes$/),
  );
  fireEvent.change(screen.getByLabelText(/How did you hear about HackUTA/), {
    target: { value: "Discord" },
  });
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
    const api = await import("../../src/pages/Register/registerApi");
    vi.mocked(api.submitRegistration).mockResolvedValue({ ok: true });
    vi.mocked(api.uploadResume).mockResolvedValue({
      storageId: "resume-id",
      uploadToken: "upload-token",
    });
    vi.mocked(api.discardResumeUpload).mockResolvedValue(undefined);
  });

  it("shows the verified email as read-only context", () => {
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    expect(screen.getByText("applicant@example.com")).toBeInTheDocument();
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
      within(screen.getByRole("group", { name: /Is this your first hackathon/ })).getByLabelText(/^No$/),
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
    expect(uploadResume).toHaveBeenCalledWith(resume);
    expect(submitRegistration).toHaveBeenCalledWith(
      expect.objectContaining({
        otherDietary: "No peanuts",
        linkedin: "https://linkedin.com/in/sam",
        portfolio: "https://example.com/sam",
        devpost: "https://devpost.com/software/hackuta-project",
        accessibilityNeeds: "Step-free access",
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

    fireEvent.change(screen.getByLabelText(/Major \/ field of study/), {
      target: { value: "Other (please specify)" },
    });
    expect(
      screen.getByLabelText(/Describe your major \/ field of study/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/How did you hear about HackUTA/), {
      target: { value: "Other" },
    });
    expect(
      screen.getByLabelText(/Tell us how you heard about HackUTA/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/School \/ university/), {
      target: { value: "Other:" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Other:" }));
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
    render(<ApplicationForm onSubmitted={vi.fn()} />);
    fillValidApplicationForm();

    fireEvent.change(screen.getByLabelText(/Major \/ field of study/), {
      target: { value: "Other (please specify)" },
    });
    fireEvent.change(screen.getByLabelText(/How did you hear about HackUTA/), {
      target: { value: "Other" },
    });
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
