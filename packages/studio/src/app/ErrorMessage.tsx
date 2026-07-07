import type { ReactNode } from "react";

/** A small, shared error indicator every panel uses when its rpc call comes back `ok: false`. */
export function ErrorMessage({ message }: { readonly message: string }): ReactNode {
  return (
    <p className="error-message" role="alert">
      {message}
    </p>
  );
}
