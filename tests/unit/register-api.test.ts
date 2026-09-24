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
  phone: "5551234567",
  age: 20,
  school: "The University of Texas at Arlington",
  countryOfResidence: "United States of America",
  stateOfResidence: "Texas",
  internationalStudent: false,
  otherRaceEthnicity: undefined,
  levelOfStudy: "Undergraduate University (3+ year)",
  major: "Computer science, computer engineering, or software engineering",
  graduationYear: MIN_GRADUATION_YEAR,
  gender: "Man",
  raceEthnicity: [],
  dietaryRestrictions: [],
  eatsBeef: false,
  otherDietary: "",
  tshirtSize: "M",
  firstHackathon: true,
  hearAbout: "Discord",
  resumeStorageId: undefined,
  linkedin: undefined,
  github: undefined,
  portfolio: undefined,
  devpost: undefined,
  accessibilityNeeds: "",
  emergencyContactName: "Jane Test",
  emergencyContactPhone: "5559876543",
  codeOfConductAgreed: true,
  mlhDataSharingConsent: true,
  mlhCommunicationsConsent: false,
  hackathonId: "hackuta-2026",
};

const session = { storageId: "resume-id", uploadToken: "upload-token" };

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
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).rejects.toThrow(
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
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).rejects.toThrow(
      "The file is not a valid PDF.",
    );
  });

  it("rejects an invalid file before contacting the upload API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["text"], "resume.txt"))).rejects.toThrow("Please select a PDF");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a mock upload session when mock API mode is enabled", async () => {
    vi.stubEnv("VITE_USE_MOCK_API", "true");
    vi.resetModules();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { uploadResume } = await import("../../src/pages/Register/registerApi");
    await expect(uploadResume(new File(["%PDF-1.7"], "resume.pdf"))).resolves.toEqual({
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
    expect(mutationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        data: { ...payload, resumeStorageId: "resume-id" },
        resumeUploadToken: "upload-token",
      },
    );
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
    expect(mutationMock).toHaveBeenCalledWith(expect.anything(), { data: payload });
  });

  it("maps server failures to a friendly error", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://example.convex.cloud");
    vi.stubEnv("VITE_USE_MOCK_API", "false");
    vi.resetModules();
    const serverError = new Error("server failure");
    mutationMock.mockRejectedValue(serverError);
    const { submitRegistration } = await import("../../src/pages/Register/registerApi");
    await expect(submitRegistration(payload)).rejects.toMatchObject({
      message: "server failure",
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
    expect(mutationMock).toHaveBeenCalledWith(expect.anything(), { uploadToken: "upload-token" });
  });
});
