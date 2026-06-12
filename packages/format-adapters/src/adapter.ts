import type { LocaleResource, SupportedFormat } from "@verbatra/core";

/**
 * Result of reading a file into core's intermediate representation. invalidIcuKeys
 * is the exact shape core's validation layer consumes: the keys whose values are
 * invalid ICU. For formats that are not ICU-based it is empty.
 */
export interface ReadResult {
  readonly resource: LocaleResource;
  readonly invalidIcuKeys: readonly string[];
}

/**
 * The contract every format adapter implements. A new format attaches by
 * implementing this interface and registering it; no existing code changes.
 */
export interface FormatAdapter {
  /** The single format this adapter handles. */
  readonly format: SupportedFormat;

  /**
   * Detect whether this adapter can handle a file, by path and/or a content
   * sample. Best-effort and side-effect-free.
   */
  canHandle(filePath: string, sample?: string): boolean;

  /** Read a file into a LocaleResource plus its ICU-validity result. */
  read(filePath: string, locale: string): Promise<ReadResult>;

  /** Write a LocaleResource back to a file, preserving key order and structure. */
  write(resource: LocaleResource, filePath: string): Promise<void>;

  /** Extract placeholders from a single value without resolving them. */
  extractPlaceholders(value: string): readonly string[];
}
