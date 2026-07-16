import type { ReactNode } from "react";

/**
 * An initials-in-a-circle avatar. Studio has no user identity today (a single loopback session
 * token, not an account), so nothing in this dashboard renders one yet; kept as a ready primitive
 * for the day a real identity concept (a named session, a configured author) exists, rather than
 * left unbuilt until then.
 */
export function Avatar({ name }: { readonly name: string }): ReactNode {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="grid size-8 flex-none place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
      role="img"
      aria-label={name}
    >
      {initials}
    </span>
  );
}
