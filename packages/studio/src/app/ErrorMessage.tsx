import type { ReactNode } from "react";
import { resolveErrorCopy } from "../client/error-copy.js";
import type { StructuredError } from "../client/state.js";

export interface ErrorMessageProps {
  readonly error: StructuredError;
  /** Text rendered before the resolved copy, for example noting that stale data is still shown. */
  readonly prefix?: string;
}

/**
 * A small, shared error indicator every panel uses when its rpc call comes back `ok: false`.
 * Renders specific, actionable copy for a known error code (see `client/error-copy.ts`), falling
 * back to the server's own message, unchanged, for any code the lookup table does not recognize.
 */
export function ErrorMessage({ error, prefix }: ErrorMessageProps): ReactNode {
  return (
    <p className="error-message" role="alert">
      {prefix !== undefined ? `${prefix} ` : null}
      {resolveErrorCopy(error)}
    </p>
  );
}
