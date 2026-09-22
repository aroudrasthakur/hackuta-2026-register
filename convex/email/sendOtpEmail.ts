"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildOtpEmailContent } from "./templates";
import { sendMailMessage } from "./smtp";

export const sendOtpEmail = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (_ctx, { email, code, expiresAt: _expiresAt }) => {
    void _expiresAt;
    const content = buildOtpEmailContent(code);
    await sendMailMessage({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      fromName: "HackUTA",
    });
  },
});
