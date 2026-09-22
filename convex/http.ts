import { httpRouter, makeFunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import {
  ALLOWED_RESUME_CONTENT_TYPE,
  isAllowedResumeFilename,
  MAX_RESUME_BYTES,
  parseResumeContentLength,
  RESUME_FILENAME_HEADER,
  RESUME_TEST_CONTENT_LENGTH_HEADER,
} from "../shared/registration/resume";
import { validateResumePdfBytes } from "./pdfValidation";
import { getRegistrationAllowedOrigins, isOriginAllowed } from "./registrationSecurity";

const http = httpRouter();
auth.addHttpRoutes(http);

const reserveResumeUploadRef = makeFunctionReference<"mutation">(
  "registrations:reserveResumeUpload",
);
const recordVerifiedResumeUploadRef = makeFunctionReference<"mutation">(
  "registrations:recordVerifiedResumeUpload",
);

const CONVEX_TEST_ORIGIN = "https://hackuta.test";

function requestOrigin(request: Request) {
  return request.headers.get("origin") ?? request.headers.get("x-test-origin");
}

function allowedOrigin(request: Request): string | undefined {
  const origin = requestOrigin(request);
  const allowed = getRegistrationAllowedOrigins();
  if (allowed.length > 0) {
    return isOriginAllowed(origin, allowed) ? origin : undefined;
  }
  return origin === CONVEX_TEST_ORIGIN ? origin : undefined;
}

function response(request: Request, body: unknown, status: number, origin?: string) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

async function requestRateKey(address: string | null) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(address ?? "unknown-client"),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createCapabilityToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function clientAddress(
  ctx: Parameters<Parameters<typeof httpAction>[0]>[0],
) {
  try {
    const { ip } = await ctx.meta.getRequestMetadata();
    if (ip) return ip;
  } catch {
    // Older local test backends do not expose request metadata.
  }
  return null;
}

const uploadResume = httpAction(async (ctx, request) => {
  const origin = allowedOrigin(request);
  if (!origin) {
    return response(request, { error: "Origin is not allowed." }, 403);
  }
  if (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
    ALLOWED_RESUME_CONTENT_TYPE
  ) {
    return response(request, { error: "Please upload a PDF." }, 415, origin);
  }

  let contentLength = parseResumeContentLength(request.headers.get("content-length"));
  if (
    !contentLength.ok &&
    contentLength.reason === "missing" &&
    request.headers.get("x-test-origin") === CONVEX_TEST_ORIGIN
  ) {
    contentLength = parseResumeContentLength(
      request.headers.get(RESUME_TEST_CONTENT_LENGTH_HEADER),
    );
  }
  if (!contentLength.ok) {
    if (contentLength.reason === "missing") {
      return response(
        request,
        { error: "Content-Length header is required." },
        411,
        origin,
      );
    }
    if (contentLength.reason === "too_large" || contentLength.reason === "empty") {
      return response(request, { error: "The PDF is too large." }, 413, origin);
    }
    return response(request, { error: "Invalid upload request." }, 400, origin);
  }

  const resumeFilename = request.headers.get(RESUME_FILENAME_HEADER);
  if (!isAllowedResumeFilename(resumeFilename)) {
    return response(request, { error: "Please upload a PDF file." }, 415, origin);
  }

  try {
    await ctx.runMutation(reserveResumeUploadRef, {
      requestKey: await requestRateKey(await clientAddress(ctx)),
    });
  } catch {
    return response(request, { error: "Too many uploads. Please try again later." }, 429, origin);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== contentLength.length || bytes.length > MAX_RESUME_BYTES) {
    return response(request, { error: "The PDF must be between 1 byte and 5 MB." }, 413, origin);
  }

  try {
    await validateResumePdfBytes(bytes);
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : "";
    const message =
      detail === "The PDF has too many pages."
        ? detail
        : "The file is not a valid PDF.";
    return response(request, { error: message }, 422, origin);
  }

  let storageId;
  try {
    storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
    const uploadToken = createCapabilityToken();
    await ctx.runMutation(recordVerifiedResumeUploadRef, { uploadToken, storageId });
    return response(request, { storageId, uploadToken }, 201, origin);
  } catch {
    if (storageId) await ctx.storage.delete(storageId);
    return response(request, { error: "The resume could not be stored." }, 500, origin);
  }
});

http.route({ path: "/resume-upload", method: "POST", handler: uploadResume });
http.route({
  path: "/resume-upload",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const origin = allowedOrigin(request);
    if (!origin) return response(request, { error: "Origin is not allowed." }, 403);
    const result = response(request, null, 204, origin);
    result.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    result.headers.set(
      "Access-Control-Allow-Headers",
      `Content-Type, ${RESUME_FILENAME_HEADER}`,
    );
    result.headers.set("Access-Control-Max-Age", "600");
    return result;
  }),
});

export default http;
