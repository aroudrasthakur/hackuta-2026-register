"use node";

import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  fromName?: string;
};

const CONNECTION_TIMEOUT_MS = 15_000;
const GREETING_TIMEOUT_MS = 15_000;
const SOCKET_TIMEOUT_MS = 30_000;

export function getSmtpConfig(): SmtpConfig {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!host || !portRaw || !user || !password || !from) {
    throw new Error("Email is not configured.");
  }

  const port = Number(portRaw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Email is not configured.");
  }

  return {
    host,
    port,
    secure: port === 465,
    user,
    password,
    from,
  };
}

let cachedTransporter: Transporter | null = null;
let cachedKey: string | null = null;

function getTransporter(config: SmtpConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.user}`;
  if (cachedTransporter && cachedKey === key) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    requireTLS: config.port === 587,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  });
  cachedKey = key;
  return cachedTransporter;
}

export async function sendMailMessage(input: SendMailInput): Promise<void> {
  const config = getSmtpConfig();
  const transporter = getTransporter(config);
  const fromName = input.fromName ?? "HackUTA";
  const from = `"${fromName}" <${config.from}>`;

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
}
