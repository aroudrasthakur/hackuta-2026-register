import { describe, expect, it } from "vitest";
import {
  ALLOWED_RESUME_EXTENSIONS,
  hasPdfMagicBytes,
  isAllowedResumeFilename,
  MAX_RESUME_BYTES,
  parseResumeContentLength,
  RESUME_EMPTY_ERROR_MESSAGE,
  RESUME_SIZE_ERROR_MESSAGE,
  resumeFileKey,
  validateResume,
} from "../../shared/registration/resume";

describe("resume upload policy", () => {
  it("allows only PDF extensions", () => {
    expect(ALLOWED_RESUME_EXTENSIONS).toEqual([".pdf"]);
    expect(isAllowedResumeFilename("resume.pdf")).toBe(true);
    expect(isAllowedResumeFilename("resume.PDF")).toBe(true);
    expect(isAllowedResumeFilename("shell.php")).toBe(false);
    expect(isAllowedResumeFilename("resume.sh")).toBe(false);
    expect(isAllowedResumeFilename("../resume.pdf")).toBe(false);
    expect(isAllowedResumeFilename(".pdf")).toBe(false);
    expect(isAllowedResumeFilename("resume.pdf.exe")).toBe(false);
  });

  it("requires a valid Content-Length before accepting upload bytes", () => {
    expect(parseResumeContentLength(null)).toEqual({ ok: false, reason: "missing" });
    expect(parseResumeContentLength("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(parseResumeContentLength("0")).toEqual({ ok: false, reason: "empty" });
    expect(parseResumeContentLength(String(MAX_RESUME_BYTES + 1))).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(parseResumeContentLength(String(MAX_RESUME_BYTES))).toEqual({
      ok: true,
      length: MAX_RESUME_BYTES,
    });
    expect(parseResumeContentLength(String(MAX_RESUME_BYTES - 1))).toEqual({
      ok: true,
      length: MAX_RESUME_BYTES - 1,
    });
    expect(parseResumeContentLength("1024")).toEqual({ ok: true, length: 1024 });
  });

  it("detects PDF magic bytes", () => {
    expect(hasPdfMagicBytes(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasPdfMagicBytes(new TextEncoder().encode("<?php"))).toBe(false);
  });

  it("rejects buffers shorter than the PDF header and near-miss headers", () => {
    expect(hasPdfMagicBytes(new TextEncoder().encode("%PDF"))).toBe(false);
    expect(hasPdfMagicBytes(new Uint8Array())).toBe(false);
    expect(hasPdfMagicBytes(new TextEncoder().encode("%PDF_1.7"))).toBe(false);
  });

  it("rejects blank, missing, and path-bearing filenames", () => {
    expect(isAllowedResumeFilename(undefined)).toBe(false);
    expect(isAllowedResumeFilename(null)).toBe(false);
    expect(isAllowedResumeFilename("   ")).toBe(false);
    expect(isAllowedResumeFilename("dir\\resume.pdf")).toBe(false);
    expect(isAllowedResumeFilename("resume\0.pdf")).toBe(false);
    expect(isAllowedResumeFilename("  resume.pdf  ")).toBe(true);
  });

  it("rejects Content-Length values that are not safe positive integers", () => {
    expect(parseResumeContentLength(" 42 ")).toEqual({ ok: true, length: 42 });
    expect(parseResumeContentLength("-1")).toEqual({ ok: false, reason: "invalid" });
    expect(parseResumeContentLength("1.5")).toEqual({ ok: false, reason: "invalid" });
    expect(parseResumeContentLength("")).toEqual({ ok: false, reason: "invalid" });
    expect(parseResumeContentLength("9".repeat(20))).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("validateResume (client pre-check)", () => {
  const pdf = (overrides: Partial<Pick<File, "name" | "type" | "size">> = {}) => ({
    name: "resume.pdf",
    type: "application/pdf",
    size: 1024,
    ...overrides,
  });

  it("accepts a normal PDF and one with no reported MIME type", () => {
    expect(validateResume(pdf())).toBeUndefined();
    expect(validateResume(pdf({ type: "" }))).toBeUndefined();
  });

  it("rejects non-PDF names or MIME types", () => {
    expect(validateResume(pdf({ name: "resume.docx" }))).toBe("Please select a PDF file.");
    expect(validateResume(pdf({ type: "text/plain" }))).toBe("Please select a PDF file.");
  });

  it("enforces the empty and 2 MB boundaries", () => {
    expect(validateResume(pdf({ size: 0 }))).toBe(RESUME_EMPTY_ERROR_MESSAGE);
    expect(validateResume(pdf({ size: 1 }))).toBeUndefined();
    expect(validateResume(pdf({ size: MAX_RESUME_BYTES }))).toBeUndefined();
    expect(validateResume(pdf({ size: MAX_RESUME_BYTES + 1 }))).toBe(RESUME_SIZE_ERROR_MESSAGE);
  });

  it("builds a stable key from name, size, and modification time", () => {
    const file = new File(["%PDF-"], "cv.pdf", { lastModified: 1234 });
    expect(resumeFileKey(file)).toBe("cv.pdf:5:1234");
  });
});
