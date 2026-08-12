"use client";

import { useCallback, useState } from "react";

const RESET_DELAY_MS = 1500;

/**
 * Copies text to the clipboard and reports success as a boolean that resets after
 * a short delay, matching the "copied" flash on a copy button. Clipboard write
 * failures (permissions, insecure context) are swallowed: the button just stays in
 * its normal state rather than surfacing an error for a non-critical action.
 */
export function useCopyToClipboard(): [boolean, (text: string) => Promise<void>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), RESET_DELAY_MS);
    } catch {}
  }, []);

  return [copied, copy];
}
