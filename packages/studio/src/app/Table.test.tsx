// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./Table.js";
import { render } from "./test-support.js";
import { tableClasses } from "./ui.js";

describe("Table", () => {
  it("renders a table carrying the shared table styling", () => {
    const view = render(
      <Table>
        <tbody />
      </Table>,
    );

    expect(view.get("table").className).toBe(tableClasses.table);
  });

  it("merges a caller className onto the shared classes", () => {
    const view = render(
      <Table className="mt-4">
        <tbody />
      </Table>,
    );

    expect(view.get("table").className).toContain("mt-4");
  });

  it("forwards the remaining native attributes, so a caller can name the table", () => {
    const view = render(
      <Table aria-label="Locale coverage">
        <tbody />
      </Table>,
    );

    expect(view.get("table").getAttribute("aria-label")).toBe("Locale coverage");
  });
});

describe("TableHead", () => {
  it("renders a plain thead and forwards its children", () => {
    const view = render(
      <table>
        <TableHead>
          <tr>
            <th>Locale</th>
          </tr>
        </TableHead>
      </table>,
    );

    expect(view.getByText("th", "Locale").closest("thead")).not.toBeNull();
  });
});

describe("TableBody", () => {
  it("renders a tbody carrying the shared divider styling", () => {
    const view = render(
      <table>
        <TableBody />
      </table>,
    );

    expect(view.get("tbody").className).toBe(tableClasses.tbody);
  });

  it("merges a caller className onto the shared classes", () => {
    const view = render(
      <table>
        <TableBody className="align-top" />
      </table>,
    );

    expect(view.get("tbody").className).toContain("align-top");
  });
});

describe("TableRow", () => {
  it("carries the hover tint by default", () => {
    const view = render(
      <table>
        <tbody>
          <TableRow />
        </tbody>
      </table>,
    );

    expect(view.get("tr").className).toContain(tableClasses.rowHover);
  });

  it("drops the hover tint for a non-interactive row", () => {
    const view = render(
      <table>
        <tbody>
          <TableRow hover={false} />
        </tbody>
      </table>,
    );

    expect(view.get("tr").className).not.toContain(tableClasses.rowHover);
  });

  it("merges a caller className onto the row", () => {
    const view = render(
      <table>
        <tbody>
          <TableRow className="opacity-60" />
        </tbody>
      </table>,
    );

    expect(view.get("tr").className).toContain("opacity-60");
  });
});

describe("TableHeaderCell", () => {
  it("carries the shared header styling and start-aligns by default", () => {
    const view = render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell>Locale</TableHeaderCell>
          </tr>
        </thead>
      </table>,
    );
    const className = view.get("th").className;

    expect(className).toContain("text-start");
    expect(className).not.toContain(tableClasses.numeric);
  });

  it("end-aligns a numeric column header", () => {
    const view = render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell numeric>Missing</TableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(view.get("th").className).toContain("text-end");
  });

  it("forwards the remaining native attributes, so a caller can scope the header", () => {
    const view = render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell scope="col" className="w-40">
              Locale
            </TableHeaderCell>
          </tr>
        </thead>
      </table>,
    );

    expect(view.get("th").getAttribute("scope")).toBe("col");
    expect(view.get("th").className).toContain("w-40");
  });
});

describe("TableCell", () => {
  it("carries the shared cell styling with neither the monospace face nor end alignment", () => {
    const view = render(
      <table>
        <tbody>
          <tr>
            <TableCell>de-DE</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const className = view.get("td").className;

    expect(className).toBe(tableClasses.td);
  });

  it("uses the monospace face for a code-shaped value", () => {
    const view = render(
      <table>
        <tbody>
          <tr>
            <TableCell mono>de-DE</TableCell>
          </tr>
        </tbody>
      </table>,
    );

    expect(view.get("td").className).toContain("font-mono");
  });

  it("end-aligns a numeric cell with fixed-rhythm digits", () => {
    const view = render(
      <table>
        <tbody>
          <tr>
            <TableCell numeric>12</TableCell>
          </tr>
        </tbody>
      </table>,
    );
    const className = view.get("td").className;

    expect(className).toContain("text-end");
    expect(className).toContain("tabular-nums");
  });

  it("forwards the remaining native attributes and a caller className", () => {
    const view = render(
      <table>
        <tbody>
          <tr>
            <TableCell colSpan={3} className="text-muted-foreground">
              No rows
            </TableCell>
          </tr>
        </tbody>
      </table>,
    );

    expect(view.get("td").getAttribute("colspan")).toBe("3");
    expect(view.get("td").className).toContain("text-muted-foreground");
  });
});

describe("TableCard", () => {
  it("renders an unpadded card that scrolls a too-wide table horizontally", () => {
    const view = render(<TableCard />);
    const className = view.get("div").className;

    expect(className).toContain("overflow-x-auto");
    expect(className).not.toContain("p-6");
  });

  it("merges a caller className and forwards the remaining native attributes", () => {
    const view = render(<TableCard className="mb-6" aria-label="Locale coverage" />);

    expect(view.get("div").className).toContain("mb-6");
    expect(view.get("div").getAttribute("aria-label")).toBe("Locale coverage");
  });
});
