import { describe, expect, it } from "vitest";
import {
  buildApplicationConfirmationEmailContent,
  buildOtpEmailContent,
  buildPasswordResetEmailContent,
} from "../../convex/email/templates";

describe("email template escaping", () => {
  it.each([
    ["OTP", () => buildOtpEmailContent('<img src=x onerror="alert(1)">')],
    ["password reset", () => buildPasswordResetEmailContent('<script>alert(1)</script>')],
    [
      "confirmation",
      () =>
        buildApplicationConfirmationEmailContent({
          applicantName: 'Evil<img onerror="alert(1)">',
          submittedAt: Date.UTC(2026, 8, 26),
          hackathonName: 'Hack<script>UTA',
        }),
    ],
  ])("escapes HTML in %s templates", (_label, build) => {
    const content = build();
    expect(content.html).not.toMatch(/<script/i);
    expect(content.html).not.toMatch(/<img[^>]+onerror/i);
    expect(content.html).toContain("&lt;");
    expect(content.text).toContain("<");
  });
});
