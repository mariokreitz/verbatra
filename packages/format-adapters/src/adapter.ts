import type { LocaleResource, SupportedFormat } from "@verbatra/core";

/**
 * The result of reading a file into core's intermediate representation.
 */
export interface ReadResult {
  /** The parsed locale resource. */
  readonly resource: LocaleResource;
  /**
   * Keys whose values are invalid for the format's message syntax, the exact shape core's
   * validation layer consumes. Empty for formats that are not ICU-based.
   */
  readonly invalidIcuKeys: readonly string[];
}

/**
 * The contract every format adapter implements. A new format attaches by implementing this interface
 * and registering it in an {@link AdapterRegistry}; no existing code changes.
 *
 * Implementer invariants:
 * - `read` maps malformed, oversized, or structurally invalid file CONTENT to a structured
 *   {@link AdapterError}, never a raw parser throw and never echoing file content or a host path. A
 *   missing or unopenable PATH is the exception: it rejects with the underlying filesystem error,
 *   because there is no content to map.
 * - `write` preserves key order and structure and is atomic. An interrupted write must never leave a
 *   half-written locale file.
 * - `canHandle` is best-effort and side-effect-free. Multiple adapters may claim the same file (all
 *   JSON adapters claim `.json`); disambiguation is the caller's, by explicit format, not by sniffing.
 * - `extractPlaceholders` reports the format's placeholder tokens and resolves nothing; the provider
 *   integrity check later validates a translation against exactly this set.
 *
 * For a JSON-family format, implement via {@link createJsonFileAdapter} rather than from scratch (see
 * its example). A non-JSON format implements this interface directly, and first needs its format added
 * to core's `SupportedFormat`.
 *
 * @example
 * ```ts
 * const registry = createDefaultRegistry();
 * const resolution = registry.resolve("locales/en.json", { format: "i18next-json" });
 * if (resolution.status === "resolved") {
 *   const { resource } = await resolution.adapter.read("locales/en.json", "en");
 *   await resolution.adapter.write(resource, "locales/en.json");
 * }
 * ```
 */
export interface FormatAdapter {
  /** The single format this adapter handles (a `SupportedFormat` from core). */
  readonly format: SupportedFormat;

  /**
   * Detect whether this adapter can handle a file, by path extension and an optional content sample.
   * Best-effort and side-effect-free; it reads nothing from disk.
   *
   * @param filePath - The path of the file under consideration.
   * @param sample - An optional leading content sample to aid detection.
   * @returns True if this adapter could handle the file. Several adapters may return true for the same
   *   file (all JSON adapters claim `.json`); the caller disambiguates by explicit format.
   */
  canHandle(filePath: string, sample?: string): boolean;

  /**
   * Read a file into a {@link LocaleResource} plus its message-validity result.
   *
   * @param filePath - The file to read.
   * @param locale - The locale to tag the resource with.
   * @returns The parsed resource and the keys whose values are invalid for the format.
   * @throws {@link AdapterError} when the content is malformed, oversized, or structurally invalid
   *   (the implementation names the specific codes). A missing or unopenable path instead rejects with
   *   the underlying filesystem error.
   */
  read(filePath: string, locale: string): Promise<ReadResult>;

  /**
   * Write a {@link LocaleResource} back to a file, preserving key order and structure, atomically.
   *
   * @param resource - The resource to serialize.
   * @param filePath - The destination file.
   * @throws {@link AdapterError} if the resource cannot be represented in the format; rejects with the
   *   underlying filesystem error on a write failure.
   */
  write(resource: LocaleResource, filePath: string): Promise<void>;

  /**
   * Extract the format's placeholder tokens from a single value, resolving nothing.
   *
   * @param value - The translatable string to scan.
   * @returns The placeholder tokens found, in document order. Does not throw.
   */
  extractPlaceholders(value: string): readonly string[];

  /**
   * Validate a single, not-yet-persisted value against the format's message syntax, the same
   * check {@link ReadResult.invalidIcuKeys} reports on read but applied to one value before it is
   * written. Lets a caller (for example the manual-import path) reject a bad value WITHOUT first
   * writing it to disk. For non-ICU formats (i18next, vue-i18n, ngx-translate) every value is
   * valid, so this returns true. Does not throw; an unparseable value returns false.
   *
   * @param value - The candidate translated value to validate.
   * @returns True when the value is valid for the format's message syntax.
   */
  validateMessage(value: string): boolean;
}
