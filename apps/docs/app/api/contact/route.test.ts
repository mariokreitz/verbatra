import { afterEach, describe, expect, it, vi } from "vitest";

const checkArcjetMock = vi.fn();
const sendContactEmailMock = vi.fn();

vi.mock("./arcjet", () => ({ checkArcjet: checkArcjetMock }));
vi.mock("./email", () => ({ sendContactEmail: sendContactEmailMock }));

const { POST } = await import("./route");
const { HONEYPOT_FIELD } = await import("./honeypot-field");

function request(body: unknown): Request {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello, I would like to know more about verbatra.",
    ...overrides,
  };
}

afterEach(() => {
  checkArcjetMock.mockReset();
  sendContactEmailMock.mockReset();
});

describe("POST /api/contact", () => {
  it("returns the arcjet response unchanged when arcjet blocks the request", async () => {
    checkArcjetMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "rate_limited" }), { status: 429 }),
    );
    const response = await POST(request(validBody()));
    expect(response.status).toBe(429);
    expect(sendContactEmailMock).not.toHaveBeenCalled();
  });

  it("returns 400 with field errors for an invalid payload", async () => {
    checkArcjetMock.mockResolvedValue(undefined);
    const response = await POST(request(validBody({ name: "" })));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual({ status: "invalid", errors: { name: "required" } });
    expect(sendContactEmailMock).not.toHaveBeenCalled();
  });

  it("returns success and sends exactly one email for a valid payload", async () => {
    checkArcjetMock.mockResolvedValue(undefined);
    sendContactEmailMock.mockResolvedValue({ ok: true });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(200);
    expect(sendContactEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns a byte-identical success response and sends no email when the honeypot is filled", async () => {
    checkArcjetMock.mockResolvedValue(undefined);
    sendContactEmailMock.mockResolvedValue({ ok: true });

    const success = await POST(request(validBody()));
    const honeypotted = await POST(
      request(validBody({ [HONEYPOT_FIELD]: "https://spam.example" })),
    );

    expect(honeypotted.status).toBe(success.status);
    expect(await honeypotted.text()).toBe(await success.text());
    expect(sendContactEmailMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when the email send fails", async () => {
    checkArcjetMock.mockResolvedValue(undefined);
    sendContactEmailMock.mockResolvedValue({ ok: false });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(500);
  });

  it("exports only POST, leaving other methods to Next.js's default 405 handling", async () => {
    const routeModule = (await import("./route")) as unknown as Record<string, unknown>;
    expect(routeModule.GET).toBeUndefined();
    expect(typeof routeModule.POST).toBe("function");
  });
});
