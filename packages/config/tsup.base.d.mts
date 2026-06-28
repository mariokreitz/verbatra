import type { Options } from "tsup";

/**
 * The resolved tsup options returned by {@link createTsupConfig}.
 *
 * This is a named interface rather than a bare `Options` alias so a consumer's `tsup.config.ts` can
 * name the return type through `@verbatra/config/tsup` (a direct dependency) instead of reaching into
 * `tsup`'s own install path. Returning `Options` directly triggers TS2883 ("cannot be named without a
 * reference to Options ... not portable") under declaration checking, because tsup is hoisted into
 * this package's node_modules, not the consumer's.
 */
export interface TsupConfig extends Options {}

/**
 * Build the shared tsup preset with per-package overrides merged on top.
 *
 * @param overrides tsup options merged over the preset; keys present here win over the defaults.
 * @returns The resolved tsup options for a package's `tsup.config.ts`.
 */
export declare function createTsupConfig(overrides?: Options): TsupConfig;
