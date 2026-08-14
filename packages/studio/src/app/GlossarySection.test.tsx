// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { GlossaryGetResult, GlossaryWriteResult } from "../shared/rpc/glossary.js";
import { GlossarySection } from "./GlossarySection.js";
import type { RenderResult } from "./test-support.js";
import {
  clickAsync,
  render,
  renderAsync,
  rpcCalls,
  rpcError,
  stubRpc,
  typeInto,
} from "./test-support.js";

vi.mock("./api.js", () => import("./test-support.js").then((module) => module.apiMock()));

const FILE_BACKED: GlossaryGetResult = {
  indicator: { source: "file", path: "glossary.json" },
  entries: { verbatra: "Verbatra", checkout: "Kasse" },
  redactedTerms: [],
};

function writeAnswer(result: GlossaryWriteResult): {
  readonly ok: true;
  readonly result: GlossaryWriteResult;
} {
  return { ok: true, result };
}

function buttonLabeled(view: RenderResult, label: string): HTMLElement {
  return view.get(`button[aria-label="${label}"]`);
}

function field(view: RenderResult, label: string): HTMLInputElement {
  return view.get(`input[aria-label="${label}"]`) as HTMLInputElement;
}

describe("GlossarySection, file-backed", () => {
  it("offers an edit and a remove action for every term, plus an add form", async () => {
    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);

    expect(buttonLabeled(view, "Edit verbatra")).toBeTruthy();
    expect(buttonLabeled(view, "Remove checkout")).toBeTruthy();
    expect(field(view, "New glossary term")).toBeTruthy();
    expect(view.getByText("button", "Add term")).toBeTruthy();
  });

  it("adds a term through one write and hands the new state back to its caller", async () => {
    const next: GlossaryWriteResult = {
      ...FILE_BACKED,
      entries: { ...FILE_BACKED.entries, cart: "Warenkorb" },
    };
    stubRpc({ "glossary.write": writeAnswer(next) });
    const onChange = vi.fn();

    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={onChange} />);
    typeInto(field(view, "New glossary term"), "cart");
    typeInto(field(view, "New glossary translation"), "Warenkorb");
    await clickAsync(view.getByText("button", "Add term"));

    expect(rpcCalls).toEqual([
      { method: "glossary.write", params: { term: "cart", translation: "Warenkorb" } },
    ]);
    expect(onChange).toHaveBeenCalledWith(next);
  });

  it("clears the add form only after the write succeeded", async () => {
    stubRpc({ "glossary.write": rpcError("GLOSSARY_UNWRITABLE", "the file is read only") });

    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    typeInto(field(view, "New glossary term"), "cart");
    typeInto(field(view, "New glossary translation"), "Warenkorb");
    await clickAsync(view.getByText("button", "Add term"));

    expect(field(view, "New glossary term").value).toBe("cart");
    expect(view.get('[role="alert"]').textContent).toContain("could not be written");
  });

  it("refuses to submit an add form that is missing either half", async () => {
    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    typeInto(field(view, "New glossary term"), "cart");

    expect(view.getByText("button", "Add term").hasAttribute("disabled")).toBe(true);
  });

  it("trims the term it sends but leaves the translation exactly as typed", async () => {
    stubRpc({ "glossary.write": writeAnswer(FILE_BACKED) });

    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    typeInto(field(view, "New glossary term"), "  cart  ");
    typeInto(field(view, "New glossary translation"), " Warenkorb ");
    await clickAsync(view.getByText("button", "Add term"));

    expect(rpcCalls).toEqual([
      { method: "glossary.write", params: { term: "cart", translation: " Warenkorb " } },
    ]);
  });

  it("edits a term in place, sending the same term with its new translation", async () => {
    stubRpc({ "glossary.write": writeAnswer(FILE_BACKED) });

    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    await clickAsync(buttonLabeled(view, "Edit checkout"));
    typeInto(field(view, "Translation for checkout"), "Bezahlung");
    await clickAsync(view.getByText("button", "Save"));

    expect(rpcCalls).toEqual([
      { method: "glossary.write", params: { term: "checkout", translation: "Bezahlung" } },
    ]);
  });

  it("starts the editor from the current translation and abandons it on cancel", async () => {
    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    await clickAsync(buttonLabeled(view, "Edit checkout"));

    expect(field(view, "Translation for checkout").value).toBe("Kasse");

    await clickAsync(view.getByText("button", "Cancel"));

    expect(view.query('input[aria-label="Translation for checkout"]')).toBeNull();
    expect(rpcCalls).toEqual([]);
  });

  it("will not save an editor emptied to nothing, which removal is for", async () => {
    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    await clickAsync(buttonLabeled(view, "Edit checkout"));
    typeInto(field(view, "Translation for checkout"), "   ");

    expect(view.getByText("button", "Save").hasAttribute("disabled")).toBe(true);
  });

  it("removes a term by sending a null translation", async () => {
    const next: GlossaryWriteResult = { ...FILE_BACKED, entries: { verbatra: "Verbatra" } };
    stubRpc({ "glossary.write": writeAnswer(next) });
    const onChange = vi.fn();

    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={onChange} />);
    await clickAsync(buttonLabeled(view, "Remove checkout"));

    expect(rpcCalls).toEqual([
      { method: "glossary.write", params: { term: "checkout", translation: null } },
    ]);
    expect(onChange).toHaveBeenCalledWith(next);
  });

  it("disables the row's own actions while its write is in flight", async () => {
    stubRpc({ "glossary.write": () => new Promise(() => {}) });

    const view = render(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);
    await clickAsync(buttonLabeled(view, "Remove checkout"));

    expect(buttonLabeled(view, "Remove checkout").hasAttribute("disabled")).toBe(true);
    expect(buttonLabeled(view, "Remove verbatra").hasAttribute("disabled")).toBe(false);
  });

  it("neither edits nor shows the real value of a term the server redacted, but still allows removal", async () => {
    const redacted: GlossaryGetResult = {
      indicator: { source: "file", path: "glossary.json" },
      entries: { apiTerm: "[REDACTED]" },
      redactedTerms: ["apiTerm"],
    };

    const view = await renderAsync(<GlossarySection glossary={redacted} onChange={() => {}} />);

    expect(view.query('button[aria-label="Edit apiTerm"]')).toBeNull();
    expect(buttonLabeled(view, "Remove apiTerm")).toBeTruthy();
    expect(view.text()).toContain("looks like a secret");
  });
});

describe("GlossarySection, not file-backed", () => {
  it("explains an inline glossary and offers no way to change it", async () => {
    const view = await renderAsync(
      <GlossarySection
        glossary={{
          indicator: { source: "inline" },
          entries: { verbatra: "Verbatra" },
          redactedTerms: [],
        }}
        onChange={() => {}}
      />,
    );

    expect(view.text()).toContain("written inline in the verbatra config");
    expect(view.text()).toContain("JSON file");
    expect(view.all("button")).toHaveLength(0);
    expect(view.query("input")).toBeNull();
  });

  it("explains a project with no glossary and offers no way to create one from here", async () => {
    const view = await renderAsync(
      <GlossarySection
        glossary={{ indicator: { source: "none" }, entries: {}, redactedTerms: [] }}
        onChange={() => {}}
      />,
    );

    expect(view.text()).toContain("no glossary yet");
    expect(view.text()).toContain("No glossary configured");
    expect(view.all("button")).toHaveLength(0);
  });

  it("names the file a file-backed glossary came from, and says nothing about read-only", async () => {
    const view = await renderAsync(<GlossarySection glossary={FILE_BACKED} onChange={() => {}} />);

    expect(view.text()).toContain("Source: file (glossary.json)");
    expect(view.text()).not.toContain("written inline");
  });
});
