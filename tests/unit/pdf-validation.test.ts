import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import {
  countLoadedPdfObjects,
  countPdfObjectDeclarations,
  MAX_PDF_OBJECT_COUNT,
  normalizePdfHexEscapes,
  validateResumePdfBytes,
} from "../../convex/pdfValidation";
import { MAX_RESUME_PAGES } from "../../shared/registration/resume";

async function validPdfBytes() {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return new Uint8Array(await pdf.save());
}

function buildMinimalPdf(objects: string[]): Uint8Array {

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }

  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(body);
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
      "The PDF has too many pages.",
    );
  });

  it("accepts a PDF exactly at the page limit", async () => {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < MAX_RESUME_PAGES; index += 1) {
      pdf.addPage([612, 792]);
    }
    await expect(validateResumePdfBytes(new Uint8Array(await pdf.save()))).resolves.toBeUndefined();
  });

  it("rejects a structurally valid PDF with no pages", async () => {
    const pdf = await PDFDocument.create();
    const bytes = await pdf.save({ addDefaultPage: false });
    await expect(validateResumePdfBytes(new Uint8Array(bytes))).rejects.toThrow(
      "A resume must have at least one page.",
    );
  });

  it("rejects bytes without the PDF signature before parsing", async () => {
    await expect(validateResumePdfBytes(new TextEncoder().encode("<html>"))).rejects.toThrow(
      "The file is not a valid PDF.",
    );
  });

  it.each(["/JavaScript", "/OpenAction", "/EmbeddedFile"] as const)(
    "rejects PDFs containing %s markers",
    async (marker) => {
      const bytes = await validPdfBytes();
      const injected = new Uint8Array(bytes.length + marker.length + 16);
      injected.set(bytes);
      injected.set(new TextEncoder().encode(`\n${marker}\n`), bytes.length);
      await expect(validateResumePdfBytes(injected)).rejects.toThrow(
        "This PDF contains content that is not allowed.",
      );
    },
  );

  it("normalizes hex-escaped PDF names before scanning", () => {
    expect(normalizePdfHexEscapes("/J#61vaScript")).toBe("/JavaScript");
  });

  it("rejects hex-escaped JavaScript names", async () => {
    const bytes = await validPdfBytes();
    const marker = "/J#61vaScript";
    const injected = new Uint8Array(bytes.length + marker.length);
    injected.set(bytes);
    injected.set(new TextEncoder().encode(marker), bytes.length);
    await expect(validateResumePdfBytes(injected)).rejects.toThrow(
      "This PDF contains content that is not allowed.",
    );
  });

  it("does not reject harmless name tokens containing /JS as a substring", async () => {
    const bytes = buildMinimalPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj",
      "4 0 obj\n<< /Type /Font /BaseFont /JSans-Regular >>\nendobj",
    ]);
    await expect(validateResumePdfBytes(bytes)).resolves.toBeUndefined();
  });

  it("rejects a page annotation whose /A action is JavaScript", async () => {
    const bytes = buildMinimalPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Annots [4 0 R] >>\nendobj",
      "4 0 obj\n<< /Type /Annot /Subtype /Link /Rect [0 0 0 0] /A << /S /JavaScript /JS (x) >> >>\nendobj",
    ]);
    await expect(validateResumePdfBytes(bytes)).rejects.toThrow(
      "This PDF contains content that is not allowed.",
    );
  });

  it("rejects a catalog /AA additional-actions dictionary", async () => {
    const bytes = buildMinimalPdf([
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R /AA << /O << /S /JavaScript /JS (x) >> >> >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj",
    ]);
    await expect(validateResumePdfBytes(bytes)).rejects.toThrow(
      "This PDF contains content that is not allowed.",
    );
  });

  it("rejects PDFs with too many object declarations before parsing", async () => {
    const loadSpy = vi.spyOn(PDFDocument, "load");
    const header = new TextEncoder().encode("%PDF-1.4\n");
    const objects = new TextEncoder().encode(
      Array.from({ length: MAX_PDF_OBJECT_COUNT + 1 }, (_, index) => `${index + 1} 0 obj\n`).join(
        "",
      ),
    );
    const bytes = new Uint8Array(header.length + objects.length);
    bytes.set(header);
    bytes.set(objects, header.length);

    expect(countPdfObjectDeclarations(bytes)).toBeGreaterThan(MAX_PDF_OBJECT_COUNT);
    await expect(validateResumePdfBytes(bytes)).rejects.toThrow("The file is not a valid PDF.");
    expect(loadSpy).not.toHaveBeenCalled();
    loadSpy.mockRestore();
  });

  it("rejects PDFs whose loaded indirect object count exceeds the cap", async () => {
    const bytes = await validPdfBytes();
    const loadedPdf = await PDFDocument.load(bytes);
    vi.spyOn(loadedPdf.context, "enumerateIndirectObjects").mockReturnValue(
      Array.from({ length: MAX_PDF_OBJECT_COUNT + 1 }, (_, index) => [
        index as never,
        loadedPdf.context.obj({}),
      ]),
    );
    const loadSpy = vi.spyOn(PDFDocument, "load").mockResolvedValue(loadedPdf);

    await expect(validateResumePdfBytes(bytes)).rejects.toThrow("The file is not a valid PDF.");
    loadSpy.mockRestore();
  });

  it("counts loaded indirect objects after parse", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const loaded = await PDFDocument.load(await pdf.save());
    expect(countLoadedPdfObjects(loaded)).toBeGreaterThan(0);
  });
});
