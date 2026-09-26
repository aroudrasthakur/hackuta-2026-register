import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_GRADUATION_YEAR } from "../../shared/registration/constants";
import type { RegistrationPayload } from "../../shared/registration/types";

const { mutationMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(),
}));

const { getConvexClientMock } = vi.hoisted(() => ({
  getConvexClientMock: vi.fn(() => ({ mutation: mutationMock })),
}));

vi.mock("../../src/convex/client", () => ({
  getConvexClient: getConvexClientMock,
  normalizeConvexUrl: (url: string | undefined) => {
    const trimmed = url?.trim();
    if (!trimmed) return undefined;
    return trimmed.replace(/\/+$/, "");
  },
}));

const payload: RegistrationPayload = {
  firstName: "Sam",
  lastName: "Test",
  phone: "+12025550123",
  age: 20,
  school: "The University of Texas at Arlington",
  otherSchool: undefined,
  studentEmail: undefined,
  countryOfResidence: "United States of America",
  stateOfResidence: "Texas",
  internationalStudent: false,
  otherRaceEthnicity: undefined,
  levelOfStudy: "Undergraduate University (3+ year)",
  major: "Computer science, computer engineering, or software engineering",
  otherMajor: undefined,
  graduationYear: MIN_GRADUATION_YEAR,
  gender: "Man",
  otherGender: undefined,
  raceEthnicity: [],
  dietaryRestrictions: [],
  allergyDetails: "",
  otherDietaryRestrictions: undefined,
  tshirtSize: "M",
  experienceLevel: "Intermediate",
  hackathonsAttended: 1,
  hearAbout: "Discord",
  otherHearAbout: undefined,
  resumeStorageId: undefined,
  linkedin: undefined,
  github: undefined,
  portfolio: undefined,
  devpost: undefined,
  accessibilityNeeds: "",
  builtOrWantToBuild: "I built a campus events app with React and Convex.",
  shortDeadlineLearning:
    "Before a hackathon demo, I learned GitHub Actions in one night to deploy our project.",
  emergencyContactName: "Jane Test",
  emergencyContactRelationship: "Parent",
  emergencyContactPhone: "+442079460958",
  mlhCodeOfConductAgreed: true,
  mlhDataSharingConsent: true,
  mlhCommunicationsConsent: false,
  sponsorSharingConsent: false,
  foodAllergyWaiverAgreed: true,
};

const session = { storageId: "resume-id", uploadToken: "upload-token" };

function convexFunctionName(ref: unknown): string {
  const nameSym = Object.getOwnPropertySymbols(ref as object)
    .find((symbol) => symbol.description === "functionName");
  if (!nameSym) {
    throw new Error("Expected a Convex function reference");
  }
  const name = (ref as Record<symbol, string | undefined>)[nameSym];
  if (!name) {
    throw new Error("Expected a Convex function reference with a name");
  }
  return name;
}

describe("uploadResume", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
    getConvexClientMock.mockReturnValue({ mutation: mutationMock });
  });

  it.each([
    { storageId: 42, uploadToken: "token" },
    { storageId: "", uploadToken: "token" },
    { storageId: "resume-id", uploadToken: "" },
    {},
  ])("rejects malformed upload responses (%j)", async (response) => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 201 }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"), "test-token")).rejects.toThrow(
      "We couldn't upload your resume. Please try again.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces server-provided resume upload errors", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "The file is not a valid PDF." }), { status: 422 }),
    );
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"), "test-token")).rejects.toThrow(
      "The file is not a valid PDF.",
    );
  });

  it("rejects upload without an auth token", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"), null)).rejects.toThrow(
      "Please sign in to upload your resume.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid file before contacting the upload API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["text"], "resume.txt"), "test-token")).rejects.toThrow("Please select a PDF");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the PDF to the explicit Convex site URL with auth and filename headers", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "https://custom.example.site/");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(session), { status: 201 }),
    );
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    const file = new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" });

    await expect(uploadResume(file, "jwt")).resolves.toEqual(session);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://custom.example.site/resume-upload");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer jwt",
        "Content-Type": "application/pdf",
        "x-resume-filename": "cv.pdf",
      },
      body: file,
    });
  });

  it("derives the site URL from the Convex cloud URL when no site URL is set", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud/");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(session), { status: 201 }),
    );
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await uploadResume(new File(["%PDF-1.7"], "cv.pdf"), "jwt");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.convex.site/resume-upload");
  });

  it("fails with the generic upload error when no upload endpoint is configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.stubEnv("VITE_CONVEX_SITE_URL", "");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "cv.pdf"), "jwt")).rejects.toThrow(
      "We couldn't upload your resume. Please try again.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports network failures as a connection problem", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "cv.pdf"), "jwt")).rejects.toThrow(
      "We couldn't upload your resume. Check your connection and try again.",
    );
  });

  it.each([
    [413, "Your resume exceeds the 2 MB limit. Please upload a smaller PDF."],
    [429, "Too many uploads. Please try again later."],
    [401, "Please sign in to upload your resume."],
  ])("maps HTTP %i with a non-JSON body", async (status, expected) => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("<html>gateway</html>", { status }));
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "cv.pdf"), "jwt")).rejects.toThrow(expected);
  });

  it("returns a mock upload session when mock API mode is enabled", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"), null)).resolves.toEqual({
      storageId: "mock-resume-id",
      uploadToken: "mock-upload-token",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("submitRegistration (mock API)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns success without contacting Convex", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("submitRegistration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
    getConvexClientMock.mockReturnValue({ mutation: mutationMock });
  });

  it("submits with an existing upload session", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload, session)).resolves.toEqual({ ok: true });
    expect(mutationMock).toHaveBeenCalledOnce();
    expect(convexFunctionName(mutationMock.mock.calls[0]![0])).toBe(
      "registrations:submitRegistration",
    );
    expect(mutationMock.mock.calls[0]![1]).toEqual({
      data: { ...payload, resumeStorageId: "resume-id" },
      resumeUploadToken: "upload-token",
    });
  });

  it("throws a friendly error when Convex is not configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    getConvexClientMock.mockReturnValue(null as unknown as { mutation: typeof mutationMock });
    vi.resetModules();
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).rejects.toThrow(
      "We couldn't submit your application. Please try again.",
    );
  });

  it("submits a valid payload to Convex", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).resolves.toEqual({ ok: true });
    expect(mutationMock).toHaveBeenCalledOnce();
    expect(convexFunctionName(mutationMock.mock.calls[0]![0])).toBe(
      "registrations:submitRegistration",
    );
    expect(mutationMock.mock.calls[0]![1]).toEqual({ data: payload });
  });

  it("maps server failures to a friendly error", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const serverError = new Error("server failure");
    mutationMock.mockRejectedValue(serverError);
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).rejects.toMatchObject({
      message: "We couldn't submit your application. Please try again.",
      cause: serverError,
    });
  });
});

describe("discardResumeUpload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
    getConvexClientMock.mockReturnValue({ mutation: mutationMock });
  });

  it("no-ops in mock API mode", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.resetModules();
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await expect(discardResumeUpload("token")).resolves.toBeUndefined();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("calls the delete mutation when Convex is configured", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockResolvedValue({ ok: true });
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await discardResumeUpload("upload-token");
    expect(mutationMock).toHaveBeenCalledOnce();
    expect(convexFunctionName(mutationMock.mock.calls[0]![0])).toBe(
      "resumeUploads:discardUploadSession",
    );
    expect(mutationMock.mock.calls[0]![1]).toEqual({ uploadToken: "upload-token" });
  });

  it("swallows discard failures so cleanup never blocks the applicant", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    mutationMock.mockRejectedValue(new Error("offline"));
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await expect(discardResumeUpload("upload-token")).resolves.toBeUndefined();
  });

  it("no-ops when Convex is not configured", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    getConvexClientMock.mockReturnValue(null as unknown as { mutation: typeof mutationMock });
    vi.resetModules();
    const { discardResumeUpload } = await import("../../src/pages/Register/registerApi");
    await expect(discardResumeUpload("upload-token")).resolves.toBeUndefined();
    expect(mutationMock).not.toHaveBeenCalled();
  });
});

describe("submitRegistration error logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mutationMock.mockReset();
  });

  it("logs raw Convex errors only in development builds", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.stubEnv("DEV", true);
    vi.resetModules();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mutationMock.mockRejectedValue(new Error("You have already submitted an application."));
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).rejects.toThrow("You have already submitted an application.");
    expect(consoleError).toHaveBeenCalledWith("Convex mutation failed:", expect.any(Error));
  });
});
