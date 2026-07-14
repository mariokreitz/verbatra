import { describe, expect, it } from "vitest";
import { projectSnapshotParamsSchema } from "./snapshot.js";

describe("projectSnapshotParamsSchema", () => {
  it("accepts an empty object", () => {
    expect(projectSnapshotParamsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an object with any key present", () => {
    expect(projectSnapshotParamsSchema.safeParse({ extra: true }).success).toBe(false);
  });
});
