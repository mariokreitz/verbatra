/**
 * Types the {@link Mutable} walk must not descend into. Mapping over a function type would
 * discard its call signatures, and platform objects such as `AbortSignal` are handed to the
 * vendor SDK untouched.
 */
type OpaqueToMutable = AbortSignal | ((...args: never[]) => unknown);

/**
 * The same shape with every `readonly` modifier removed, recursively, so readonly tuples and
 * arrays become mutable ones.
 *
 * Request bodies are declared with readonly members here, but the vendor SDKs type their
 * parameters with mutable arrays, and a readonly array is not assignable to a mutable one.
 * That modifier is the only real difference at those seams, so expressing it as a type keeps
 * the rest of the shape under compiler check.
 */
export type Mutable<T> = T extends OpaqueToMutable
  ? T
  : T extends readonly (infer Element)[]
    ? Mutable<Element>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;

/**
 * Drop the `readonly` modifiers from a request body before handing it to a vendor SDK.
 *
 * Purely a compile-time view: the value is returned unchanged and is never mutated. This is
 * the single place the provider clients relax immutability, so every other part of the request
 * shape still has to satisfy the vendor's parameter type. A vendor renaming or retyping a
 * request field is therefore a compile error rather than a runtime failure against the live API.
 *
 * @param request - The readonly request body built by the provider's `request.ts`.
 * @returns The identical object, typed without `readonly` modifiers.
 */
export function toMutableRequest<T extends object>(request: T): Mutable<T> {
  return request as Mutable<T>;
}
