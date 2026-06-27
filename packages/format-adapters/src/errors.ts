/**
 * Stable, machine-readable codes for adapter failures.
 *
 * - `INVALID_JSON`: the file is not parseable JSON.
 * - `INVALID_YAML`: the file is not parseable YAML.
 * - `INVALID_XML`: the file is not parseable XML.
 * - `INVALID_STRUCTURE`: parseable but not a valid shape: a non-object root, a non-string leaf, a
 *   path that is not a regular file, or (on write) a leaf key that collides with a nested key path.
 * - `MAX_DEPTH_EXCEEDED`: object nesting exceeds the depth cap.
 * - `INPUT_TOO_LARGE`: the file exceeds the input size cap.
 * - `MIXED_STRUCTURE` (ngx-translate only): the file mixes flat dotted keys with nested objects.
 */
export type AdapterErrorCode =
  | "INVALID_JSON"
  | "INVALID_YAML"
  | "INVALID_XML"
  | "INVALID_STRUCTURE"
  | "MAX_DEPTH_EXCEEDED"
  | "INPUT_TOO_LARGE"
  | "MIXED_STRUCTURE";

/**
 * A structured error for boundary failures. It deliberately carries only a code
 * and a safe message: it never embeds raw parser output, file content, or a host
 * path, so untrusted input cannot leak back through error text.
 */
export class AdapterError extends Error {
  readonly code: AdapterErrorCode;

  constructor(code: AdapterErrorCode, message: string) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
  }
}
