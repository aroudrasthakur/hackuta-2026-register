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
const MAX_PDF_INSPECTION_DEPTH = 8;

const ACTIVE_CONTENT_NAME_TOKENS = new Set([
  "/JavaScript",
  "/JS",
  "/OpenAction",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
]);

const ACTIVE_DICT_KEYS = [
  "JS",
  "JavaScript",
  "Launch",
  "EmbeddedFile",
  "RichMedia",
  "OpenAction",
  "AA",
  "Names",
  "EmbeddedFiles",
  "EF",
  "AcroForm",
  "XFA",
] as const;

const ACTIVE_ACTION_TYPES = ["/JavaScript", "/Launch"] as const;

const PDF_NAME_TOKEN_PATTERN = /\/[A-Za-z0-9#]+/g;

/** Decode PDF name hex escapes such as `/J#61vaScript` → `/JavaScript`. */
export function normalizePdfHexEscapes(text: string): string {
  return text.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function normalizePdfNameToken(token: string): string {
  return normalizePdfHexEscapes(token);
}

function scanRawPdfForActiveContent(bytes: Uint8Array): string | null {
  const text = new TextDecoder("latin1").decode(bytes);
  for (const match of text.matchAll(PDF_NAME_TOKEN_PATTERN)) {
    const normalized = normalizePdfNameToken(match[0]);
    if (ACTIVE_CONTENT_NAME_TOKENS.has(normalized)) {
      return normalized;
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

/** Count indirect objects after parse (includes objects inside object streams). */
export function countLoadedPdfObjects(pdf: PDFDocument): number {
  return [...pdf.context.enumerateIndirectObjects()].length;
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

function isPdfStreamLike(value: unknown): value is { dict: PDFDict } {
  return (
    typeof value === "object" &&
    value !== null &&
    "dict" in value &&
    (value as { dict: unknown }).dict instanceof PDFDict
  );
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

function inspectPdfDict(pdf: PDFDocument, dict: PDFDict, depth: number): boolean {
  if (dictionaryContainsActiveContent(dict)) {
    return true;
  }
  if (depth >= MAX_PDF_INSPECTION_DEPTH) {
    return false;
  }

  for (const key of dict.keys()) {
    if (inspectPdfValue(pdf, dict.lookup(key), depth + 1)) {
      return true;
    }
  }

  return false;
}

function inspectPdfValue(pdf: PDFDocument, value: unknown, depth = 0): boolean {
  if (depth > MAX_PDF_INSPECTION_DEPTH) {
    return false;
  }

  const resolved = resolvePdfObject(pdf, value);
  if (isPdfStreamLike(resolved)) {
    return inspectPdfDict(pdf, resolved.dict, depth + 1);
  }
  if (resolved instanceof PDFDict) {
    return inspectPdfDict(pdf, resolved, depth);
  }
  if (resolved instanceof PDFArray) {
    for (let index = 0; index < resolved.size(); index += 1) {
      if (inspectPdfValue(pdf, resolved.lookup(index), depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

function pdfGraphContainsActiveContent(pdf: PDFDocument): boolean {
  for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
    if (inspectPdfValue(pdf, obj, 0)) {
      return true;
    }
  }

  for (const page of pdf.getPages()) {
    const node = page.node;
    if (inspectPdfValue(pdf, node.lookup(PDFName.of("AA")), 0)) {
      return true;
    }
    if (inspectPdfValue(pdf, node.lookup(PDFName.of("Annots")), 0)) {
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

  if (countLoadedPdfObjects(pdf) > MAX_PDF_OBJECT_COUNT) {
    throw new Error("The file is not a valid PDF.");
  }

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
