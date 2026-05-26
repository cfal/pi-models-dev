import { type Environment, readEnvBoolean, readPositiveInteger, readStringSet } from "./env.js";

export interface RuntimeOptions {
  enabled: boolean;
  debug: boolean;
  overrideProviders: Set<string>;
  includeAlpha: boolean;
  includeBeta: boolean;
  includeDeprecated: boolean;
  maxModelsPerProvider: number | null;
  catalog: CatalogOptions;
}

export interface CatalogOptions {
  sourceUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  offline: boolean;
  cacheDir?: string;
}

const DEFAULT_SOURCE_URL = "https://models.dev/api.json";
const DEFAULT_CACHE_TTL_MS = 86_400_000;
const DEFAULT_FETCH_TIMEOUT_MS = 3_000;

export function readRuntimeOptions(env: Environment = process.env): RuntimeOptions {
  return {
    enabled: readEnvBoolean(env.PI_MODELS_DEV_ENABLED, true),
    debug: readEnvBoolean(env.PI_MODELS_DEV_DEBUG, false),
    overrideProviders: readStringSet(env.PI_MODELS_DEV_OVERRIDE_PROVIDERS) ?? new Set<string>(),
    includeAlpha: readEnvBoolean(env.PI_MODELS_DEV_INCLUDE_ALPHA, false),
    includeBeta: readEnvBoolean(env.PI_MODELS_DEV_INCLUDE_BETA, true),
    includeDeprecated: readEnvBoolean(env.PI_MODELS_DEV_INCLUDE_DEPRECATED, false),
    maxModelsPerProvider: readPositiveInteger(env.PI_MODELS_DEV_MAX_MODELS_PER_PROVIDER),
    catalog: {
      sourceUrl: env.PI_MODELS_DEV_SOURCE_URL || DEFAULT_SOURCE_URL,
      timeoutMs: readPositiveInteger(env.PI_MODELS_DEV_FETCH_TIMEOUT_MS) ?? DEFAULT_FETCH_TIMEOUT_MS,
      cacheTtlMs: readPositiveInteger(env.PI_MODELS_DEV_CACHE_TTL_MS) ?? DEFAULT_CACHE_TTL_MS,
      offline: readEnvBoolean(env.PI_MODELS_DEV_OFFLINE ?? env.PI_OFFLINE, false),
      cacheDir: env.PI_MODELS_DEV_CACHE_DIR
    }
  };
}
