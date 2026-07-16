import type { ReactNode } from "react";
import { resolveErrorCopy } from "../client/error-copy.js";
import type { StructuredError } from "../client/state.js";
import { Icon } from "./Icon.js";

export interface ErrorMessageProps {
  readonly error: StructuredError;
  /** Text rendered before the resolved copy, for example noting that stale data is still shown. */
  readonly prefix?: string;
}

/**
 * A small, shared error indicator every panel uses when its rpc call comes back `ok: false`.
 * Renders specific, actionable copy for a known error code (see `client/error-copy.ts`), falling
 * back to the server's own message, unchanged, for any code the lookup table does not recognize.
 * The glyph is decorative; `role="alert"` already announces the state.
 */
export function ErrorMessage({ error, prefix }: ErrorMessageProps): ReactNode {
  return (
    <p
      className="mb-4 flex items-start gap-2 rounded-md border-s-[3px] border-danger bg-danger-soft px-4 py-3 text-danger"
      role="alert"
    >
      <Icon name="alert" className="mt-0.5 flex-none" />
      <span>
        {prefix !== undefined ? `${prefix} ` : null}
        {resolveErrorCopy(error)}
      </span>
    </p>
  );
}
