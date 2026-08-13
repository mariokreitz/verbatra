type OpaqueToMutable = AbortSignal | ((...args: never[]) => unknown);

export type Mutable<T> = T extends OpaqueToMutable
  ? T
  : T extends readonly (infer Element)[]
    ? Mutable<Element>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
      : T;

export function toMutableRequest<T extends object>(request: T): Mutable<T> {
  return request as Mutable<T>;
}
