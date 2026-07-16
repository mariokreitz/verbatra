/** One logged request, deliberately narrow: a method, a path without its query string, and a status. */
export interface RequestLogEntry {
  readonly method: string;
  readonly path: string;
  readonly status: number;
}

/** Formats a request log line from exactly the entry's three fields; never a header value or a token. */
export function formatRequestLog(entry: RequestLogEntry): string {
  return `${entry.method} ${entry.path} ${entry.status}`;
}
