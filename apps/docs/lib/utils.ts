import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard class-name helper: clsx resolves conditional/array inputs, twMerge dedupes
// conflicting Tailwind utilities so the last one wins. Use it instead of ad-hoc string
// concatenation when composing class names.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
