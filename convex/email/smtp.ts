"use node";

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  note?: string;
};

const DEFAULT_EMAIL_SERVICE_URL = "https://emailservice.hackuta.org";
const REQUEST_TIMEOUT_MS = 15_000;

export type EmailServiceConfig = {
  baseUrl: string;
  apiKey: string;
};

function isTrustedEmailServiceUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    );
  } catch {
    return false;
  }
}

export function isDevMailLogEnabled() {
  return process.env.EMAIL_DEV_LOG === "true";
}

export function getEmailServiceConfig(): EmailServiceConfig {
  const apiKey = process.env.EMAIL_SERVICE_API_KEY?.trim();
  const baseUrl = (process.env.EMAIL_SERVICE_URL?.trim() || DEFAULT_EMAIL_SERVICE_URL).replace(
    /\/+$/,
    "",
  );

  if (!apiKey || !isTrustedEmailServiceUrl(baseUrl)) {
    throw new Error("Email is not configured.");
  }

  return { baseUrl, apiKey };
}

function emailServiceUnavailable(): Error {
  return new Error("Email could not be sent.");
}

export async function sendMailMessage(input: SendMailInput): Promise<void> {
  const logDevMail = () => {
    console.info(`[EMAIL_DEV_LOG] queued ${input.subject} → ${input.to}\n${input.text}`);
  };

  if (isDevMailLogEnabled()) {
    logDevMail();
  }

  let config: EmailServiceConfig;
  try {
    config = getEmailServiceConfig();
  } catch (error) {
    if (isDevMailLogEnabled()) {
      return;
    }
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.to,
        api_key: config.apiKey,
        subject: input.subject,
        body: input.html || input.text,
        ...(input.note ? { note: input.note } : {}),
      }),
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 401) {
      throw new Error("Email service unauthorized.");
    }
    if (
      !response.ok ||
      !payload ||
      typeof payload !== "object" ||
      !("id" in payload) ||
      typeof payload.id !== "string" ||
      !payload.id.trim()
    ) {
      throw emailServiceUnavailable();
    }
  } catch (error) {
    if (isDevMailLogEnabled()) {
      return;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Email service timed out.", { cause: error });
    }
    if (error instanceof Error && error.message.startsWith("Email")) {
      throw error;
    }
    throw new Error("Email could not be sent.", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}
