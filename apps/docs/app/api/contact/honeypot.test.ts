import { describe, expect, it } from "vitest";
import { isHoneypotFilled } from "./honeypot";
import { HONEYPOT_FIELD } from "./honeypot-field";
import type { ContactPayload } from "./schema";

function payload(overrides: Partial<ContactPayload> = {}): ContactPayload {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello, I would like to know more about verbatra.",
    [HONEYPOT_FIELD]: "",
    ...overrides,
  };
}

describe("isHoneypotFilled", () => {
  it("returns false when the honeypot field is empty", () => {
    expect(isHoneypotFilled(payload())).toBe(false);
  });

  it("returns false when the honeypot field is only whitespace", () => {
    expect(isHoneypotFilled(payload({ [HONEYPOT_FIELD]: "   " }))).toBe(false);
  });

  it("returns true when the honeypot field is filled", () => {
    expect(isHoneypotFilled(payload({ [HONEYPOT_FIELD]: "https://spam.example" }))).toBe(true);
  });
});
