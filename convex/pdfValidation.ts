import { PDFDocument, PDFName } from "pdf-lib";
import {
  hasPdfMagicBytes,
  MAX_RESUME_PAGES,
} from "../shared/registration/resume";

const PDF_PARSE_BUDGET_MS = 5_000;

const ACTIVE_CONTENT_MARKERS = [
  "/JavaScript",
  "/JS",
  "/OpenAction",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
] as const;

function scanRawPdfForActiveContent(bytes: Uint8Array): string | null {
  const text = new TextDecoder("latin1").decode(bytes);
  for (const marker of ACTIVE_CONTENT_MARKERS) {
    if (text.includes(marker)) {
      return marker;
    }
  }
  return null;
}

function catalogContainsActiveContent(catalog: PDFDocument["catalog"]): boolean {
  const namesToCheck = [
    PDFName.of("OpenAction"),
    PDFName.of("Names"),
    PDFName.of("AA"),
  ];
  for (const name of namesToCheck) {
    if (catalog.get(name)) {
      return true;
    }
  }
  return false;
}

async function loadPdfWithinBudget(bytes: Uint8Array): Promise<PDFDocument> {
  const started = Date.now();
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  if (Date.now() - started > PDF_PARSE_BUDGET_MS) {
    throw new Error("The file is not a valid PDF.");
  }
  return pdf;
}

/** Parse and validate resume bytes before storage; do not trust Content-Type alone. */
export async function validateResumePdfBytes(bytes: Uint8Array): Promise<void> {
  if (!hasPdfMagicBytes(bytes)) {
    throw new Error("The file is not a valid PDF.");
  }

  const activeMarker = scanRawPdfForActiveContent(bytes);
  if (activeMarker) {
    throw new Error("This PDF contains content that is not allowed.");
  }

  const pdf = await loadPdfWithinBudget(bytes);
  if (catalogContainsActiveContent(pdf.catalog)) {
    throw new Error("This PDF contains content that is not allowed.");
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new Error("A resume must have at least one page.");
  }
  if (pageCount > MAX_RESUME_PAGES) {
    throw new Error("The PDF has too many pages.");
  }
}

export { ACTIVE_CONTENT_MARKERS, PDF_PARSE_BUDGET_MS };
