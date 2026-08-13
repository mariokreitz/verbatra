import type { LocaleResource, PlaceholderIntegrityResult, SupportedFormat } from "@verbatra/core";

export interface ReadResult {
  readonly resource: LocaleResource;
  readonly invalidIcuKeys: readonly string[];
  readonly excludedLeafPaths: readonly string[];
}

export interface FormatAdapter {
  readonly format: SupportedFormat;

  canHandle(filePath: string, sample?: string): boolean;

  read(filePath: string, locale: string): Promise<ReadResult>;

  write(resource: LocaleResource, filePath: string): Promise<void>;

  extractPlaceholders(value: string): readonly string[];

  validateMessage(value: string): boolean;

  comparePlaceholders?(sourceValue: string, targetValue: string): PlaceholderIntegrityResult;
}
