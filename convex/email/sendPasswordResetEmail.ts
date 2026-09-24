"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildPasswordResetEmailContent } from "./templates";
import { sendMailMessage } from "./emailService";

export const sendPasswordResetEmail = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
    expiresAt: v.number(),
  },
  handler: async (_ctx, { email, code, expiresAt: _expiresAt }) => {
    void _expiresAt;
    const content = buildPasswordResetEmailContent(code);
    await sendMailMessage({
      to: email,
      subject: content.subject,
      text: content.text,
    });
  },
});
