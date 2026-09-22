import { describe, expect, it } from "vitest";
import {
  ALLOWED_RESUME_EXTENSIONS,
  hasPdfMagicBytes,
  isAllowedResumeFilename,
  MAX_RESUME_BYTES,
  parseResumeContentLength,
} from "../../shared/registration/resume";

describe("resume upload policy", () => {
  it("allows only PDF extensions", () => {
    expect(ALLOWED_RESUME_EXTENSIONS).toEqual([".pdf"]);
    expect(isAllowedResumeFilename("resume.pdf")).toBe(true);
    expect(isAllowedResumeFilename("resume.PDF")).toBe(true);
    expect(isAllowedResumeFilename("shell.php")).toBe(false);
    expect(isAllowedResumeFilename("resume.sh")).toBe(false);
    expect(isAllowedResumeFilename("../resume.pdf")).toBe(false);
  });

  it("requires a valid Content-Length before accepting upload bytes", () => {
    expect(parseResumeContentLength(null)).toEqual({ ok: false, reason: "missing" });
    expect(parseResumeContentLength("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(parseResumeContentLength("0")).toEqual({ ok: false, reason: "empty" });
    expect(parseResumeContentLength(String(MAX_RESUME_BYTES + 1))).toEqual({
      ok: false,
      reason: "too_large",
    });
    expect(parseResumeContentLength("1024")).toEqual({ ok: true, length: 1024 });
  });

  it("detects PDF magic bytes", () => {
    expect(hasPdfMagicBytes(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasPdfMagicBytes(new TextEncoder().encode("<?php"))).toBe(false);
  });
});
