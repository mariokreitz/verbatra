// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { DiffPanel } from "./diff-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubBrowserApis(reducedMotion: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: reducedMotion, media: query }),
  });
  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: class {
      observe(): void {}
      disconnect(): void {}
    },
  });
}

let mounted: { container: HTMLDivElement; root: Root } | undefined;

function render(reducedMotion: boolean): HTMLDivElement {
  stubBrowserApis(reducedMotion);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DiffPanel />);
  });
  mounted = { container, root };
  return container;
}

afterEach(() => {
  if (!mounted) return;
  const { container, root } = mounted;
  mounted = undefined;
  act(() => {
    root.unmount();
  });
  container.remove();
});

function changedCellText(container: HTMLDivElement): string {
  const cells = [...container.querySelectorAll(".grid > div")].filter((cell) =>
    cell.textContent?.includes("cart.checkout"),
  );
  const target = cells.at(-1);
  if (!target) throw new Error("no target cell rendered for the changed row");
  return target.textContent ?? "";
}

describe("DiffPanel", () => {
  it("renders the changed value empty until the panel scrolls into view", () => {
    const container = render(false);

    expect(changedCellText(container)).toContain('""');
    expect(changedCellText(container)).not.toContain("Zur Kasse");
  });

  it("shows the full changed value immediately when motion is reduced", () => {
    const container = render(true);

    expect(changedCellText(container)).toContain('"Zur Kasse"');
  });
});
