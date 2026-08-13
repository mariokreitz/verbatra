import type { SupportedFormat } from "@verbatra/core";
import type { FormatAdapter } from "./adapter.js";

/**
 * Outcome of resolving an adapter for a file. Structured, never thrown: an unresolvable file is a
 * status the caller branches on, not an exception.
 *
 * `resolved` carries the single {@link FormatAdapter} to use. `no-match` means nothing claimed the
 * file, and reports the formats that were tried (every registered format for a detection attempt, or
 * just the one requested when an explicit format was given). `ambiguous` means more than one adapter
 * claimed the file, which is routine since every JSON adapter claims `.json`; it reports the competing
 * candidates instead of guessing, and the caller resolves it by naming a format explicitly.
 */
export type AdapterResolution =
  | {
      /** Exactly one adapter claimed the file. */
      readonly status: "resolved";
      /** The adapter to read and write the file with. */
      readonly adapter: FormatAdapter;
    }
  | {
      /** No registered adapter claimed the file. */
      readonly status: "no-match";
      /** The file that could not be matched. */
      readonly filePath: string;
      /**
       * The formats that were tried: every registered format for a detection attempt, or just the
       * one requested when an explicit format was given.
       */
      readonly triedFormats: readonly SupportedFormat[];
    }
  | {
      /** More than one adapter claimed the file, so detection cannot choose between them. */
      readonly status: "ambiguous";
      /** The file that several adapters claimed. */
      readonly filePath: string;
      /** The competing formats. Resolve the ambiguity by naming one of them explicitly. */
      readonly candidates: readonly SupportedFormat[];
    };

/** Options for {@link AdapterRegistry.resolve}: select a format explicitly, or aid detection. */
export interface ResolveOptions {
  /** A leading content sample to aid detection. Ignored when `format` is given. */
  readonly sample?: string;
  /** Bypass detection and select this format explicitly. */
  readonly format?: SupportedFormat;
}

/**
 * Holds the registered adapters and resolves one for a file. Open for extension: adapters attach
 * through {@link register} without changing resolution logic, and resolution never throws.
 */
export class AdapterRegistry {
  private readonly adapters: FormatAdapter[] = [];

  /**
   * Register an adapter. Registration order is the order detection consults them, and a format may be
   * registered more than once, in which case an explicit-format lookup takes the first.
   *
   * @param adapter - The adapter to add.
   * @returns This registry, for chaining.
   */
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

  /**
   * Resolve the adapter for a file, by explicit format when given, otherwise by detection.
   *
   * @param filePath - The file to resolve an adapter for.
   * @param options - `format` selects explicitly and skips detection; `sample` aids detection.
   * @returns A structured {@link AdapterResolution}: `resolved`, `no-match`, or `ambiguous`. Never
   *   throws; an unresolvable file is a status, not an exception.
   */
  resolve(filePath: string, options: ResolveOptions = {}): AdapterResolution {
    if (options.format !== undefined) {
      return this.resolveByFormat(filePath, options.format);
    }
    return this.resolveByDetection(filePath, options.sample);
  }
}
