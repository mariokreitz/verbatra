import { describe, expect, it } from "vitest";
import type { HistoryCommit } from "../shared/rpc/history.js";
import { formatCommitSummary, renderCommitSummary, type TextTarget } from "./render-text.js";

function commit(overrides: Partial<HistoryCommit> = {}): HistoryCommit {
  return {
    hash: "abcdef1234567890",
    authorDate: "2026-01-01T00:00:00+00:00",
    subject: "add greeting key",
    touchedPaths: ["locales/de.json"],
    ...overrides,
  };
}

describe("formatCommitSummary", () => {
  it("joins the short hash, author date, and subject with a single space", () => {
    const summary = formatCommitSummary(commit());

    expect(summary).toBe("abcdef1 2026-01-01T00:00:00+00:00 add greeting key");
  });

  it("shortens the hash to its first 7 characters", () => {
    const summary = formatCommitSummary(commit({ hash: "0123456789abcdef" }));

    expect(summary.startsWith("0123456 ")).toBe(true);
  });
});

describe("renderCommitSummary", () => {
  it("writes the formatted summary into target.textContent", () => {
    const target: TextTarget = { textContent: null };

    renderCommitSummary(target, commit());

    expect(target.textContent).toBe(formatCommitSummary(commit()));
  });

  it("renders an HTML-injection-shaped commit message as literal text, never markup", () => {
    const target: TextTarget = { textContent: null };
    const malicious = commit({ subject: '<script>alert("xss")</script>' });

    renderCommitSummary(target, malicious);

    expect(target.textContent).toContain('<script>alert("xss")</script>');
    expect(target.textContent).toBe(formatCommitSummary(malicious));
  });

  it("never assigns anything other than a plain string to textContent", () => {
    const target: TextTarget = { textContent: null };

    renderCommitSummary(target, commit());

    expect(typeof target.textContent).toBe("string");
  });
});
