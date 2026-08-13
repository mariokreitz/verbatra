import type { AuthoringConfig, AuthoringConfigFor } from "./authoring.js";
import type { VerbatraConfigInput } from "./schema.js";

export function defineConfig(config: AuthoringConfigFor<"anthropic">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"openai">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"gemini">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfigFor<"deepl">): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfig): VerbatraConfigInput;
export function defineConfig(config: AuthoringConfig): VerbatraConfigInput {
  return config;
}
