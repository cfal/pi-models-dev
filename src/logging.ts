import type { ProviderRegistrationStats } from "./providers.js";

export interface Logger {
  debug(message: string): void;
}

export function createLogger(enabled: boolean): Logger {
  return {
    debug(message: string): void {
      if (enabled) {
        console.error(`[pi-models-dev] ${message}`);
      }
    }
  };
}

export function summarizeStats(stats: ProviderRegistrationStats): string {
  return [
    `registered=${stats.registered}`,
    `considered=${stats.considered}`,
    `unsupported=${stats.skippedUnsupported}`,
    `collision=${stats.skippedCollision}`,
    `no_intent=${stats.skippedNoIntent}`,
    `user_models=${stats.skippedUserModels}`,
    `missing_auth=${stats.skippedMissingAuth}`,
    `missing_base_url=${stats.skippedMissingBaseUrl}`,
    `no_models=${stats.skippedNoModels}`,
    `disabled=${stats.skippedDisabled}`
  ].join(" ");
}
