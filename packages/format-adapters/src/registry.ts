import type { SupportedFormat } from "@verbatra/core";
import type { FormatAdapter } from "./adapter.js";

/** Outcome of resolving an adapter for a file. Structured; never throws. */
export type AdapterResolution =
  | { readonly status: "resolved"; readonly adapter: FormatAdapter }
  | {
      readonly status: "no-match";
      readonly filePath: string;
      readonly triedFormats: readonly SupportedFormat[];
    }
  | {
      readonly status: "ambiguous";
      readonly filePath: string;
      readonly candidates: readonly SupportedFormat[];
    };

export interface ResolveOptions {
  /** A content sample to aid detection. */
  readonly sample?: string;
  /** Bypass detection and select this format explicitly. */
  readonly format?: SupportedFormat;
}

/**
 * Holds the registered adapters and resolves one for a file. Open for extension:
 * adapters attach through register without changing resolution logic.
 */
export class AdapterRegistry {
  private readonly adapters: FormatAdapter[] = [];

  register(adapter: FormatAdapter): this {
    this.adapters.push(adapter);
    return this;
  }

  private formats(): readonly SupportedFormat[] {
    return this.adapters.map((adapter) => adapter.format);
  }

  private resolveByFormat(filePath: string, format: SupportedFormat): AdapterResolution {
    const adapter = this.adapters.find((candidate) => candidate.format === format);
    if (adapter === undefined) {
      return { status: "no-match", filePath, triedFormats: [format] };
    }
    return { status: "resolved", adapter };
  }

  private resolveByDetection(filePath: string, sample?: string): AdapterResolution {
    const matches = this.adapters.filter((adapter) => adapter.canHandle(filePath, sample));
    const first = matches[0];
    if (first === undefined) {
      return { status: "no-match", filePath, triedFormats: this.formats() };
    }
    if (matches.length > 1) {
      return { status: "ambiguous", filePath, candidates: matches.map((m) => m.format) };
    }
    return { status: "resolved", adapter: first };
  }

  resolve(filePath: string, options: ResolveOptions = {}): AdapterResolution {
    if (options.format !== undefined) {
      return this.resolveByFormat(filePath, options.format);
    }
    return this.resolveByDetection(filePath, options.sample);
  }
}
