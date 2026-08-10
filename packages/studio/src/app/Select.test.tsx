// @vitest-environment jsdom
import type { SelectHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select.js";
import type { RenderResult } from "./test-support.js";
import { render, selectOption } from "./test-support.js";

function options(): readonly (readonly [string, string])[] {
  return [
    ["de", "German"],
    ["fr", "French"],
  ];
}

function renderSelect(props: SelectHTMLAttributes<HTMLSelectElement> = {}): RenderResult {
  return render(
    <Select aria-label="Target locale" {...props}>
      {options().map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>,
  );
}

describe("Select", () => {
  it("renders a native select, so the platform supplies the picker and its keyboard handling", () => {
    const view = renderSelect();

    expect(view.get("select").tagName).toBe("SELECT");
  });

  it("renders the options it was handed", () => {
    const view = renderSelect();

    expect(view.all("option").map((option) => option.textContent)).toEqual(["German", "French"]);
  });

  it("suppresses the browser's own arrow, so the custom chevron is the only one shown", () => {
    const view = renderSelect();

    expect(view.get("select").className).toContain("appearance-none");
  });

  it("hides the chevron overlay from assistive technology", () => {
    const view = renderSelect();

    expect(view.get("span[aria-hidden]").getAttribute("aria-hidden")).toBe("true");
  });

  it("draws the chevron glyph inside the overlay", () => {
    const view = renderSelect();
    const glyph = view.get("span[aria-hidden] svg");

    expect(glyph.getAttribute("width")).toBe("14");
    expect(glyph.querySelector("path")).not.toBeNull();
  });

  it("keeps the overlay out of the pointer's way, so clicking it still opens the picker", () => {
    const view = renderSelect();

    expect(view.get("span[aria-hidden]").className).toContain("pointer-events-none");
  });

  it("merges a caller className onto the field classes, which is how a caller sets a width", () => {
    const view = renderSelect({ className: "w-40" });

    expect(view.get("select").className).toContain("w-40");
  });

  it("forwards the native attributes a caller names and disables the field with", () => {
    const view = renderSelect({ disabled: true, name: "locale" });
    const field = view.get("select");

    expect(field.getAttribute("aria-label")).toBe("Target locale");
    expect(field.hasAttribute("disabled")).toBe(true);
    expect(field.getAttribute("name")).toBe("locale");
  });

  it("reports the newly chosen value to the caller", () => {
    const onChange = vi.fn();
    const view = renderSelect({ defaultValue: "de", onChange });

    selectOption(view.get("select") as HTMLSelectElement, "fr");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect((view.get("select") as HTMLSelectElement).value).toBe("fr");
  });
});
