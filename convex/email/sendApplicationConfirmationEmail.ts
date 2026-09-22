"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { buildApplicationConfirmationEmailContent } from "./templates";
import { sendMailMessage } from "./smtp";

export const sendApplicationConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    submittedAt: v.number(),
  },
  handler: async (_ctx, { email, firstName, lastName, submittedAt }) => {
    const content = buildApplicationConfirmationEmailContent({
      applicantName: `${firstName} ${lastName}`.trim(),
      submittedAt,
    });

    await sendMailMessage({
      to: email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      fromName: "HackUTA",
    });
  },
});
