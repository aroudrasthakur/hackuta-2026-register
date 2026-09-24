import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApplicationConfirmationEmailContent,
  buildOtpEmailContent,
} from "../../convex/email/templates";

describe("buildApplicationConfirmationEmailContent", () => {
  it("uses the journey template with applicant name and submission time", () => {
    const content = buildApplicationConfirmationEmailContent({
      applicantName: "Aroudra Syamantak",
      submittedAt: Date.parse("2026-09-21T22:06:00.000Z"),
    });

    expect(content.subject).toBe("HackUTA 2026 application received");
    expect(content.text).toContain("Hi Aroudra Syamantak,");
    expect(content.text).toContain("officially begun its journey");
    expect(content.text).toContain("Application submitted: September 21, 2026");
    expect(content.text).toContain("https://hackuta.com");
    expect(content.text).not.toContain("profile");
    expect(content.html).not.toContain("applicant profile");
    expect(content.html).toContain("https://hackuta.com");
  });
});

describe("buildOtpEmailContent", () => {
  it("includes the code and expiry guidance without leaking secrets", () => {
    const content = buildOtpEmailContent("042681");
    expect(content.text).toContain("042681");
    expect(content.text).toContain("10 minutes");
    expect(content.subject).toBe("Your HackUTA verification code");
  });
});

describe("email service config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires an API key", async () => {
    vi.resetModules();
    const { getEmailServiceConfig } = await import("../../convex/email/smtp");
    expect(() => getEmailServiceConfig()).toThrow("Email is not configured.");
  });

  it("rejects an untrusted service URL", async () => {
    vi.stubEnv("EMAIL_SERVICE_API_KEY", "test-key");
    vi.stubEnv("EMAIL_SERVICE_URL", "http://evil.example");
    vi.resetModules();
    const { getEmailServiceConfig } = await import("../../convex/email/smtp");
    expect(() => getEmailServiceConfig()).toThrow("Email is not configured.");
  });

  it("defaults to the HackUTA email service over HTTPS", async () => {
    vi.stubEnv("EMAIL_SERVICE_API_KEY", "test-key");
    vi.resetModules();
    const { getEmailServiceConfig } = await import("../../convex/email/smtp");
    expect(getEmailServiceConfig()).toMatchObject({
      apiKey: "test-key",
      baseUrl: "https://emailservice.hackuta.org",
    });
  });
});

describe("sendMailMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("queues mail through the email service without logging the API key", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "queued-1" }), { status: 200 }),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    vi.stubEnv("EMAIL_SERVICE_API_KEY", "secret-key");
    vi.stubEnv("EMAIL_SERVICE_URL", "https://emailservice.hackuta.org");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await sendMailMessage({
      to: "applicant@example.com",
      subject: "Your HackUTA verification code",
      text: "042681",
      html: "<p>042681</p>",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://emailservice.hackuta.org/send-email",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      email: "applicant@example.com",
      api_key: "secret-key",
      subject: "Your HackUTA verification code",
    });
    expect(info.mock.calls.flat().join(" ")).not.toContain("secret-key");
  });

  it("treats unauthorized responses as configuration failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    vi.stubEnv("EMAIL_SERVICE_API_KEY", "wrong-key");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await expect(
      sendMailMessage({
        to: "applicant@example.com",
        subject: "Test",
        text: "Hello",
        html: "<p>Hello</p>",
      }),
    ).rejects.toThrow("Email service unauthorized.");
  });

  it("logs mail when EMAIL_DEV_LOG is enabled even if the email service is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "queued-1" }), { status: 200 }),
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    vi.stubEnv("EMAIL_DEV_LOG", "true");
    vi.stubEnv("EMAIL_SERVICE_API_KEY", "secret-key");
    vi.stubEnv("EMAIL_SERVICE_URL", "https://emailservice.hackuta.org");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await sendMailMessage({
      to: "applicant@example.com",
      subject: "Your HackUTA verification code",
      text: "Your HackUTA verification code\n\n042681\n",
      html: "<p>042681</p>",
    });

    expect(info).toHaveBeenCalledWith(expect.stringContaining("042681"));
    expect(fetchMock).toHaveBeenCalled();
  });

  it("logs mail instead of throwing when EMAIL_DEV_LOG is enabled without a key", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("EMAIL_DEV_LOG", "true");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await expect(
      sendMailMessage({
        to: "applicant@example.com",
        subject: "Your HackUTA verification code",
        text: "Your HackUTA verification code\n\n042681\n",
        html: "<p>042681</p>",
      }),
    ).resolves.toBeUndefined();

    expect(info).toHaveBeenCalledWith(expect.stringContaining("042681"));
  });
});
