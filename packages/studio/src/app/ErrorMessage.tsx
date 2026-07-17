import type { ReactNode } from "react";
import { resolveErrorCopy } from "../client/error-copy.js";
import type { StructuredError } from "../client/state.js";
import { Icon } from "./Icon.js";

/** Props for {@link ErrorMessage}. */
export interface ErrorMessageProps {
  readonly error: StructuredError;
  /** Text rendered before the resolved copy, for example noting that stale data is still shown. */
  readonly prefix?: string;
}

/**
 * The shared error indicator panels render when an rpc call fails. Resolves
 * the display copy through `resolveErrorCopy`, which maps known error codes to
 * actionable text and otherwise falls back to the server's own message. The
 * glyph is decorative; `role="alert"` announces the state.
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
