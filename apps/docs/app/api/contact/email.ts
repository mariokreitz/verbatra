import { Resend } from "resend";
import type { ContactPayload } from "./schema";

const CONTACT_RECIPIENT = "mario.kreitz@web.de";
const CONTACT_FROM = "verbatra docs contact form <contact@kreitz-webdev.de>";

export type EmailClient = {
  emails: Pick<Resend["emails"], "send">;
};

export type SendContactEmailDeps = {
  client?: EmailClient;
};

export type SendContactEmailResult = { ok: true } | { ok: false };

function buildNotificationEmail(payload: ContactPayload): { subject: string; text: string } {
  const subject = `New contact form message from ${payload.name}`;
  const text = [
    "You received a new message through the verbatra docs contact form.",
    "",
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
  return { subject, text };
}

export function resolveClient(deps: SendContactEmailDeps): EmailClient | undefined {
  if (deps.client) return deps.client;
  const apiKey = process.env.CONTACT_RESEND_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) return undefined;
  return new Resend(apiKey);
}

export async function sendContactEmail(
  payload: ContactPayload,
  deps: SendContactEmailDeps = {},
): Promise<SendContactEmailResult> {
  const client = resolveClient(deps);
  if (!client) return { ok: false };

  const { subject, text } = buildNotificationEmail(payload);

  try {
    const { error } = await client.emails.send({
      from: CONTACT_FROM,
      to: [CONTACT_RECIPIENT],
      subject,
      text,
      replyTo: payload.email,
    });
    return error ? { ok: false } : { ok: true };
  } catch {
    return { ok: false };
  }
}
