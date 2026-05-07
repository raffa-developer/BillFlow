import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let cached: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return cached;
}

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

export async function sendEmail(msg: EmailMessage): Promise<{ mocked: boolean }> {
  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(
      `[email-mock] to=${msg.to} subject="${msg.subject}" attachments=${msg.attachments?.length ?? 0}`
    );
    return { mocked: true };
  }
  await transport.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    attachments: msg.attachments,
  });
  return { mocked: false };
}
