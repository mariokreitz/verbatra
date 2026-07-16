import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Composes class names: clsx resolves conditional and array inputs, twMerge dedupes conflicting Tailwind utilities so the last one wins. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
