import { getProviders } from "@earendil-works/pi-ai";
import type { RuntimeOptions } from "./config.js";
import { toPiApi, toProviderRegistration, type ProviderRegistration } from "./convert.js";
import type { Environment } from "./env.js";
import type { ModelsDevCatalog, ModelsDevProvider } from "./models-dev.js";
import type { PiNativeConfig, PiModelsProviderConfig } from "./pi-config.js";

export interface ProviderRegistrationStats {
  considered: number;
  registered: number;
  skippedDisabled: number;
  skippedUnsupported: number;
  skippedCollision: number;
  skippedNoIntent: number;
  skippedUserModels: number;
  skippedMissingAuth: number;
  skippedMissingBaseUrl: number;
  skippedNoModels: number;
}

export interface ProviderRegistrationResult {
  registrations: ProviderRegistration[];
  stats: ProviderRegistrationStats;
}

export type BuiltInProviderSource = Iterable<string> | (() => Iterable<string>);

const EMPTY_STATS: ProviderRegistrationStats = {
  considered: 0,
  registered: 0,
  skippedDisabled: 0,
  skippedUnsupported: 0,
  skippedCollision: 0,
  skippedNoIntent: 0,
  skippedUserModels: 0,
  skippedMissingAuth: 0,
  skippedMissingBaseUrl: 0,
  skippedNoModels: 0
};
const OVERRIDE_ALL_PROVIDERS = "all";
const PI_PROVIDER_ID_ALIASES: Record<string, string> = {
  "fireworks-ai": "fireworks"
};

export function buildProviderRegistrations(
  catalog: ModelsDevCatalog,
  options: RuntimeOptions,
  piConfig: PiNativeConfig,
  env: Environment = process.env,
  builtInProviderSource: BuiltInProviderSource = getProviders
): ProviderRegistrationResult {
  const stats = { ...EMPTY_STATS };
  if (!options.enabled) {
    stats.skippedDisabled = Object.keys(catalog).length;
    return { registrations: [], stats };
  }

  const builtInProviders = new Set(resolveBuiltInProviders(builtInProviderSource));
  const registrations: ProviderRegistration[] = [];

  for (const provider of Object.values(catalog)) {
    stats.considered += 1;

    if (!toPiApi(provider)) {
      stats.skippedUnsupported += 1;
      continue;
    }

    const piProviderId = toPiProviderId(provider.id);
    const isBuiltIn = builtInProviders.has(piProviderId);
    const isOverride =
      hasProviderId(options.overrideProviders, provider.id, piProviderId) ||
      options.overrideProviders.has(OVERRIDE_ALL_PROVIDERS);
    if (isBuiltIn && !isOverride) {
      stats.skippedCollision += 1;
      continue;
    }

    const piProviderConfig = getProviderConfig(piConfig, provider.id, piProviderId);
    if (piProviderConfig?.hasModels && !isOverride) {
      stats.skippedUserModels += 1;
      continue;
    }

    const hasIntent = hasProviderId(piConfig.authProviders, provider.id, piProviderId) || !!piProviderConfig || isOverride;
    if (!hasIntent) {
      stats.skippedNoIntent += 1;
      continue;
    }

    const apiKey = resolveProviderApiKey(provider, piConfig, piProviderConfig, env, piProviderId);
    if (!apiKey) {
      stats.skippedMissingAuth += 1;
      continue;
    }

    const baseUrl = resolveProviderBaseUrl(provider, piProviderConfig, env);
    if (!baseUrl) {
      stats.skippedMissingBaseUrl += 1;
      continue;
    }

    const registration = toProviderRegistration(piProviderId, provider, apiKey, baseUrl, options, piProviderConfig);
    if (!registration) {
      stats.skippedNoModels += 1;
      continue;
    }

    registrations.push(registration);
    stats.registered += 1;
  }

  return { registrations, stats };
}

export function resolveProviderApiKey(
  provider: ModelsDevProvider,
  piConfig: Pick<PiNativeConfig, "authProviders">,
  piProviderConfig: PiModelsProviderConfig | undefined,
  env: Environment,
  piProviderId = toPiProviderId(provider.id)
): string | null {
  if (piProviderConfig?.apiKey) return piProviderConfig.apiKey;
  if (hasProviderId(piConfig.authProviders, provider.id, piProviderId)) return provider.env[0] ?? piProviderId;

  for (const envName of provider.env) {
    if (env[envName]) return envName;
  }
  return null;
}

export function resolveProviderBaseUrl(
  provider: ModelsDevProvider,
  piProviderConfig: PiModelsProviderConfig | undefined,
  env: Environment
): string | null {
  const baseUrl = piProviderConfig?.baseUrl ?? provider.api;
  return baseUrl ? interpolateEnvironment(baseUrl, env) : null;
}

export function interpolateEnvironment(value: string, env: Environment): string | null {
  let missing = false;
  const interpolated = value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, envName: string) => {
    const envValue = env[envName];
    if (!envValue) {
      missing = true;
      return "";
    }
    return envValue;
  });

  return missing ? null : interpolated;
}

function resolveBuiltInProviders(source: BuiltInProviderSource): Iterable<string> {
  return typeof source === "function" ? source() : source;
}

function toPiProviderId(catalogProviderId: string): string {
  return PI_PROVIDER_ID_ALIASES[catalogProviderId] ?? catalogProviderId;
}

function hasProviderId(providerIds: Set<string>, catalogProviderId: string, piProviderId: string): boolean {
  return providerIds.has(catalogProviderId) || providerIds.has(piProviderId);
}

function getProviderConfig(
  piConfig: Pick<PiNativeConfig, "modelProviders">,
  catalogProviderId: string,
  piProviderId: string
): PiModelsProviderConfig | undefined {
  return piConfig.modelProviders.get(piProviderId) ?? piConfig.modelProviders.get(catalogProviderId);
}
