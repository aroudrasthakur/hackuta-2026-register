import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRef,
} from "pdf-lib";
import {
  hasPdfMagicBytes,
  MAX_RESUME_PAGES,
  RESUME_TOO_MANY_PAGES_MESSAGE,
} from "../shared/registration/resume";

const PDF_PARSE_BUDGET_MS = 5_000;
export const MAX_PDF_OBJECT_COUNT = 5_000;

const ACTIVE_CONTENT_NAME_MARKERS = [
  "/JavaScript",
  "/JS",
  "/OpenAction",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
] as const;

const ACTIVE_DICT_KEYS = [
  "JS",
  "JavaScript",
  "Launch",
  "EmbeddedFile",
  "RichMedia",
  "OpenAction",
] as const;

const ACTIVE_ACTION_TYPES = ["/JavaScript", "/Launch"] as const;

/** Decode PDF name hex escapes such as `/J#61vaScript` → `/JavaScript`. */
export function normalizePdfHexEscapes(text: string): string {
  return text.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function scanRawPdfForActiveContent(bytes: Uint8Array): string | null {
  const text = normalizePdfHexEscapes(new TextDecoder("latin1").decode(bytes));
  for (const marker of ACTIVE_CONTENT_NAME_MARKERS) {
    if (text.includes(marker)) {
      return marker;
    }
  }
  return null;
}

/** Count `obj` declarations to reject pathological PDFs before parsing. */
export function countPdfObjectDeclarations(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  const matches = text.match(/\b\d+\s+\d+\s+obj\b/g);
  return matches?.length ?? 0;
}

function resolvePdfObject(pdf: PDFDocument, value: unknown): unknown {
  if (value instanceof PDFRef) {
    return pdf.context.lookup(value);
  }
  return value;
}

function pdfNameValue(value: unknown): string | null {
  if (value instanceof PDFName) {
    return value.asString();
  }
  return null;
}

function dictionaryContainsActiveContent(dict: PDFDict): boolean {
  for (const key of ACTIVE_DICT_KEYS) {
    if (dict.has(PDFName.of(key))) {
      return true;
    }
  }

  const actionType = pdfNameValue(dict.lookup(PDFName.of("S")));
  if (actionType && (ACTIVE_ACTION_TYPES as readonly string[]).includes(actionType)) {
    return true;
  }

  return false;
}

function inspectPdfValue(pdf: PDFDocument, value: unknown): boolean {
  const resolved = resolvePdfObject(pdf, value);
  if (resolved instanceof PDFDict) {
    return dictionaryContainsActiveContent(resolved);
  }
  if (resolved instanceof PDFArray) {
    for (let index = 0; index < resolved.size(); index += 1) {
      if (inspectPdfValue(pdf, resolved.lookup(index))) {
        return true;
      }
    }
  }
  return false;
}

function pdfGraphContainsActiveContent(pdf: PDFDocument): boolean {
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && dictionaryContainsActiveContent(obj)) {
      return true;
    }
  }

  for (const page of pdf.getPages()) {
    const node = page.node;
    if (inspectPdfValue(pdf, node.lookup(PDFName.of("AA")))) {
      return true;
    }
    if (inspectPdfValue(pdf, node.lookup(PDFName.of("Annots")))) {
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
    parseSpeed: 50,
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

  if (countPdfObjectDeclarations(bytes) > MAX_PDF_OBJECT_COUNT) {
    throw new Error("The file is not a valid PDF.");
  }

  const activeMarker = scanRawPdfForActiveContent(bytes);
  if (activeMarker) {
    throw new Error("This PDF contains content that is not allowed.");
  }

  const pdf = await loadPdfWithinBudget(bytes);
  if (pdfGraphContainsActiveContent(pdf)) {
    throw new Error("This PDF contains content that is not allowed.");
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new Error("A resume must have at least one page.");
  }
  if (pageCount > MAX_RESUME_PAGES) {
    throw new Error(RESUME_TOO_MANY_PAGES_MESSAGE);
  }
}
