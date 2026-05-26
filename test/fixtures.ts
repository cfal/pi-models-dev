import type { CatalogOptions, RuntimeOptions } from "../src/config.js";
import type { ModelsDevCatalog, ModelsDevModel, ModelsDevProvider } from "../src/models-dev.js";
import type { PiModelsProviderConfig, PiNativeConfig } from "../src/pi-config.js";

type RuntimeOptionsOverrides = Omit<Partial<RuntimeOptions>, "catalog"> & {
  catalog?: Partial<CatalogOptions>;
};

export function makeRuntimeOptions(overrides: RuntimeOptionsOverrides = {}): RuntimeOptions {
  const base: RuntimeOptions = {
    enabled: true,
    debug: false,
    overrideProviders: new Set(),
    includeAlpha: false,
    includeBeta: true,
    includeDeprecated: false,
    maxModelsPerProvider: null,
    catalog: {
      sourceUrl: "https://models.dev/api.json",
      timeoutMs: 3_000,
      cacheTtlMs: 86_400_000,
      offline: false
    }
  };

  return {
    ...base,
    ...overrides,
    catalog: {
      ...base.catalog,
      ...overrides.catalog
    }
  };
}

export function makeModel(overrides: Partial<ModelsDevModel> = {}): ModelsDevModel {
  return {
    id: "qwen3.5-flash",
    name: "Qwen3.5 Flash",
    attachment: true,
    reasoning: true,
    tool_call: true,
    structured_output: true,
    temperature: true,
    modalities: {
      input: ["text", "image", "video"],
      output: ["text"]
    },
    cost: {
      input: 0.172,
      output: 1.72,
      reasoning: 1.72
    },
    limit: {
      context: 1_000_000,
      output: 65_536
    },
    ...overrides
  };
}

export function makeProvider(overrides: Partial<ModelsDevProvider> = {}): ModelsDevProvider {
  const model = makeModel();
  return {
    id: "alibaba-cn",
    name: "Alibaba (China)",
    env: ["DASHSCOPE_API_KEY"],
    npm: "@ai-sdk/openai-compatible",
    api: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: {
      [model.id]: model
    },
    ...overrides
  };
}

export function makeCatalog(provider: ModelsDevProvider = makeProvider()): ModelsDevCatalog {
  return {
    [provider.id]: provider
  };
}

export function makePiConfig(
  overrides: {
    authProviders?: string[];
    modelProviders?: Array<[string, Partial<PiModelsProviderConfig>]>;
    errors?: string[];
  } = {}
): PiNativeConfig {
  const modelProviders = new Map<string, PiModelsProviderConfig>();
  for (const [providerId, config] of overrides.modelProviders ?? []) {
    modelProviders.set(providerId, {
      hasModels: false,
      modelOverrides: new Map(),
      ...config
    });
  }

  return {
    authProviders: new Set(overrides.authProviders ?? []),
    modelProviders,
    errors: overrides.errors ?? []
  };
}
