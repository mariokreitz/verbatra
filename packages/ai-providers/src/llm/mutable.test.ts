import { describe, expect, expectTypeOf, it } from "vitest";
import { type Mutable, toMutableRequest } from "./mutable.js";

interface SampleRequest {
  readonly model: string;
  readonly messages: readonly [{ readonly role: "user"; readonly content: string }];
}

describe("toMutableRequest", () => {
  it("returns the identical object rather than a copy, so nothing is re-serialized", () => {
    const request: SampleRequest = {
      model: "m",
      messages: [{ role: "user", content: "{}" }],
    };

    expect(toMutableRequest(request)).toBe(request);
  });

  it("does not mutate the request it is handed", () => {
    const request: SampleRequest = {
      model: "m",
      messages: [{ role: "user", content: "{}" }],
    };

    toMutableRequest(request);

    expect(request).toEqual({ model: "m", messages: [{ role: "user", content: "{}" }] });
  });
});

describe("Mutable", () => {
  it("strips readonly recursively and turns a readonly tuple into a mutable array", () => {
    expectTypeOf<Mutable<SampleRequest>>().toEqualTypeOf<{
      model: string;
      messages: { role: "user"; content: string }[];
    }>();
  });

  it("leaves an AbortSignal member whole instead of mapping over its members", () => {
    interface WithSignal {
      readonly config: { readonly abortSignal?: AbortSignal };
    }

    expectTypeOf<Mutable<WithSignal>>().toEqualTypeOf<{
      config: { abortSignal?: AbortSignal };
    }>();
  });

  it("leaves a function member callable instead of mapping over its call signature", () => {
    interface WithCallback {
      readonly onDone: (value: string) => number;
    }

    expectTypeOf<Mutable<WithCallback>>().toEqualTypeOf<{
      onDone: (value: string) => number;
    }>();
  });
});
