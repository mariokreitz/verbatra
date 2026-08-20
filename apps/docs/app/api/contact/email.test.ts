import { afterEach, describe, expect, it, vi } from "vitest";
import { type EmailClient, resolveClient, sendContactEmail } from "./email";
import { HONEYPOT_FIELD } from "./honeypot-field";
import type { ContactPayload } from "./schema";

function payload(): ContactPayload {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello, I would like to know more about verbatra.",
    [HONEYPOT_FIELD]: "",
  };
}

function stubClient(sendResult: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const send = vi.fn().mockResolvedValue(sendResult);
  const client: EmailClient = { emails: { send } };
  return { client, send };
}

const originalKey = process.env.CONTACT_RESEND_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.CONTACT_RESEND_API_KEY;
  } else {
    process.env.CONTACT_RESEND_API_KEY = originalKey;
  }
});

describe("sendContactEmail", () => {
  it("sends exactly one email with the expected to, from, and content", async () => {
    const { client, send } = stubClient({ data: { id: "email_1" }, error: null });
    const result = await sendContactEmail(payload(), { client });

    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0]?.[0] as {
      from: string;
      to: string[];
      subject: string;
      text: string;
      replyTo: string;
    };
    expect(call.to).toEqual(["mario.kreitz@web.de"]);
    expect(call.from).toBe("verbatra docs contact form <contact@kreitz-webdev.de>");
    expect(call.replyTo).toBe("ada@example.com");
    expect(call.text).toContain("Ada Lovelace");
    expect(call.text).toContain("Hello, I would like to know more about verbatra.");
  });

  it("returns ok: false and does not throw when Resend reports an error", async () => {
    const { client } = stubClient({ data: null, error: { message: "invalid request" } });
    const result = await sendContactEmail(payload(), { client });
    expect(result).toEqual({ ok: false });
  });

  it("returns ok: false when the client throws", async () => {
    const client: EmailClient = {
      emails: { send: vi.fn().mockRejectedValue(new Error("network down")) },
    };
    const result = await sendContactEmail(payload(), { client });
    expect(result).toEqual({ ok: false });
  });

  it("fails closed with ok: false when CONTACT_RESEND_API_KEY is unset and no client is injected", async () => {
    delete process.env.CONTACT_RESEND_API_KEY;
    const result = await sendContactEmail(payload());
    expect(result).toEqual({ ok: false });
  });
});

describe("resolveClient", () => {
  it("builds a real Resend client when CONTACT_RESEND_API_KEY is set and no client is injected", () => {
    process.env.CONTACT_RESEND_API_KEY = "test-key";
    const client = resolveClient({});
    expect(client).toBeDefined();
    expect(typeof client?.emails.send).toBe("function");
  });

  it("returns the injected client without touching CONTACT_RESEND_API_KEY", () => {
    delete process.env.CONTACT_RESEND_API_KEY;
    const client: EmailClient = { emails: { send: vi.fn() } };
    expect(resolveClient({ client })).toBe(client);
  });
});
