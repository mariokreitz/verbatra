import type { CheckDeps, CreateProvider, LoadedConfig, SdkFs } from "@verbatra/sdk";

export interface ExecFileResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type ExecFileImpl = (
  file: string,
  args: readonly string[],
  options: { readonly cwd: string },
) => Promise<ExecFileResult>;

export interface StudioWatcher {
  onChange(listener: () => void): void;
  close(): Promise<void>;
}

export type CreateStudioWatcher = (paths: readonly string[]) => StudioWatcher;

export interface StudioServerDeps {
  readonly loader: () => Promise<LoadedConfig>;
  readonly fs?: SdkFs;
  readonly adapterRegistry?: NonNullable<CheckDeps["adapterRegistry"]>;
  readonly execFileImpl?: ExecFileImpl;
  readonly createWatcher?: CreateStudioWatcher;
  readonly heartbeatIntervalMs?: number;
  readonly token?: string;
  readonly output?: (line: string) => void;
  readonly assetsRoot?: URL;
  readonly spend?: boolean;
  readonly exposeAgentTools?: boolean;
  readonly createProvider?: CreateProvider;
  readonly retranslateRateLimitWindowMs?: number;
  readonly retranslateRateLimitMax?: number;
  readonly editEntryRateLimitWindowMs?: number;
  readonly editEntryRateLimitMax?: number;
  readonly translatePendingRateLimitWindowMs?: number;
  readonly translatePendingRateLimitMax?: number;
}

export interface StudioServerOptions extends StudioServerDeps {
  readonly port?: number;
  readonly cwd?: string;
}

export interface StudioServer {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}
