import { PDFDocument } from "pdf-lib";
import {
  hasPdfMagicBytes,
  MAX_RESUME_PAGES,
} from "../shared/registration/resume";

/** Parse and validate resume bytes before storage; do not trust Content-Type alone. */
export async function validateResumePdfBytes(bytes: Uint8Array): Promise<void> {
  if (!hasPdfMagicBytes(bytes)) {
    throw new Error("The file is not a valid PDF.");
  }

  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new Error("A resume must have at least one page.");
  }
  if (pageCount > MAX_RESUME_PAGES) {
    throw new Error("The PDF has too many pages.");
  }
}
