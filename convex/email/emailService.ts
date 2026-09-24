"use node";

export type EmailServiceConfig = {
  url: string;
  apiKey: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  /** Sent as the service's `body` field, which is delivered as plain text. */
  text: string;
  note?: string;
};

export type SendMailResult = {
  /** Queue ID from the email service. Confirms queueing, not delivery. */
  id: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

function parseServiceUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) return null;
    return url.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function readString(payload: unknown, key: "id" | "error"): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getEmailServiceConfig(): EmailServiceConfig {
  const url = parseServiceUrl(process.env.EMAIL_SERVICE_URL?.trim());
  const apiKey = process.env.EMAIL_SERVICE_API_KEY?.trim();
  if (!url || !apiKey) {
    throw new Error("Email is not configured.");
  }
  return { url, apiKey };
}

async function callEmailService(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, signal });
  } catch {
    throw new Error(signal.aborted ? "Email service timed out." : "Email service is unreachable.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 401) {
    throw new Error("Email service rejected the API key.");
  }
  if (!response.ok) {
    const detail = readString(payload, "error")?.slice(0, 200) ?? "unknown error";
    throw new Error(`Email service error (HTTP ${response.status}): ${detail}`);
  }
  return payload;
}

/**
 * Queues one email with the HackUTA email service. Never retries: a failed or
 * timed-out request may still have been queued, and duplicate sends are not
 * yet defined by the service. Errors never include the API key or email body.
 */
export async function sendMailMessage(input: SendMailInput): Promise<SendMailResult> {
  const { url, apiKey } = getEmailServiceConfig();
  const payload = await callEmailService(url, "/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.to,
      api_key: apiKey,
      subject: input.subject,
      body: input.text,
      ...(input.note ? { note: input.note } : {}),
    }),
  });

  const id = readString(payload, "id");
  if (!id) {
    throw new Error("Email service response did not include an email ID.");
  }
  return { id };
}
