import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { validateResumePdfBytes } from "../../convex/pdfValidation";
import { MAX_RESUME_PAGES } from "../../shared/registration/resume";

async function validPdfBytes() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return new Uint8Array(await pdf.save());
}

describe("validateResumePdfBytes", () => {
  it("accepts a real PDF document", async () => {
    await expect(validateResumePdfBytes(await validPdfBytes())).resolves.toBeUndefined();
  });

  it("rejects non-PDF bytes even when they look like a PDF header", async () => {
    await expect(
      validateResumePdfBytes(new TextEncoder().encode("%PDF-1.7\nnot actually a PDF")),
    ).rejects.toThrow();
  });

  it("rejects an empty byte array", async () => {
    await expect(validateResumePdfBytes(new Uint8Array())).rejects.toThrow();
  });

  it("rejects PDFs that exceed the page limit", async () => {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < MAX_RESUME_PAGES + 1; index += 1) {
      pdf.addPage([612, 792]);
    }
    await expect(validateResumePdfBytes(new Uint8Array(await pdf.save()))).rejects.toThrow(
      "too many pages",
    );
  });

});
