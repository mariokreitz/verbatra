import type { Options } from "tsup";

export interface TsupConfig extends Options {}

export declare function createTsupConfig(overrides?: Options): TsupConfig;
