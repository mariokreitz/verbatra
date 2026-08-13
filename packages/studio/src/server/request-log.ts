export interface RequestLogEntry {
  readonly method: string;
  readonly path: string;
  readonly status: number;
}

export function formatRequestLog(entry: RequestLogEntry): string {
  return `${entry.method} ${entry.path} ${entry.status}`;
}
