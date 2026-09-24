import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApplicationConfirmationEmailContent,
  buildOtpEmailContent,
  buildPasswordResetEmailContent,
} from "../../convex/email/templates";

describe("buildApplicationConfirmationEmailContent", () => {
  it("uses the journey template with applicant name and submission time", () => {
    const content = buildApplicationConfirmationEmailContent({
      applicantName: "Aroudra Syamantak",
      submittedAt: Date.parse("2026-09-21T22:06:00.000Z"),
      hackathonName: "HackUTA 2026",
    });

    expect(content.subject).toBe("HackUTA 2026 application received");
    expect(content.text).toContain("Hi Aroudra Syamantak,");
    expect(content.text).toContain("officially begun its journey");
    expect(content.text).toContain("Application submitted: September 21, 2026");
    expect(content.text).toContain("https://hackuta.com");
    expect(content.text).toContain("With excitement,");
    expect(content.text).toContain("The HackUTA Team");
    expect(content.text).not.toContain("profile");
    expect(content.html).not.toContain("applicant profile");
    expect(content.html).toContain("https://hackuta.com");
  });

  it("falls back to neutral copy when the name or hackathon name is blank", () => {
    const content = buildApplicationConfirmationEmailContent({
      applicantName: "   ",
      submittedAt: Date.parse("2026-09-21T22:06:00.000Z"),
      hackathonName: " ",
    });
    expect(content.text).toContain("Hi there,");
    expect(content.subject).toBe("HackUTA application received");
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

describe("buildPasswordResetEmailContent", () => {
  it("includes reset-specific copy and expiry guidance", () => {
    const content = buildPasswordResetEmailContent("042681");
    expect(content.text).toContain("042681");
    expect(content.text).toContain("password reset");
    expect(content.text).toContain("10 minutes");
    expect(content.subject).toBe("Your HackUTA password reset code");
  });
});

describe("smtp config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires SMTP environment variables", async () => {
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(() => getSmtpConfig()).toThrow("Email is not configured.");
  });

  it("derives secure transport from port 465", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(getSmtpConfig()).toMatchObject({ secure: true, port: 465 });
  });

  it("uses STARTTLS mode for port 587", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(getSmtpConfig()).toMatchObject({ secure: false, port: 587 });
  });

  it("rejects invalid SMTP ports", async () => {
    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "not-a-port");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();
    const { getSmtpConfig } = await import("../../convex/email/smtp");
    expect(() => getSmtpConfig()).toThrow("Email is not configured.");
  });
});

describe("sendMailMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("nodemailer");
  });

  it("sends mail with optional reply-to metadata", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn(() => ({ sendMail }));

    vi.doMock("nodemailer", () => ({
      default: { createTransport },
    }));

    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    await sendMailMessage({
      to: "applicant@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
      replyTo: "support@example.com",
      fromName: "HackUTA Team",
    });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ requireTLS: true, secure: false }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@example.com",
        replyTo: "support@example.com",
        from: expect.stringContaining("HackUTA Team"),
      }),
    );
  });

  it("reuses the cached transporter for repeated sends", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.fn(() => ({ sendMail }));

    vi.doMock("nodemailer", () => ({
      default: { createTransport },
    }));

    vi.stubEnv("SMTP_HOST", "mail.example.com");
    vi.stubEnv("SMTP_PORT", "465");
    vi.stubEnv("SMTP_USER", "no-reply@example.com");
    vi.stubEnv("SMTP_PASSWORD", "secret");
    vi.stubEnv("EMAIL_FROM", "no-reply@example.com");
    vi.resetModules();

    const { sendMailMessage } = await import("../../convex/email/smtp");
    const payload = {
      to: "applicant@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    };

    await sendMailMessage(payload);
    await sendMailMessage(payload);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
