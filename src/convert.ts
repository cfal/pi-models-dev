import type { Api, Model } from "@earendil-works/pi-ai";
import type { ProviderConfig, ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { RuntimeOptions } from "./config.js";
import { getProviderCompat, type PiModelCompat } from "./compat.js";
import type { ModelsDevModel, ModelsDevProvider } from "./models-dev.js";
import type { PiModelOverride, PiModelsProviderConfig } from "./pi-config.js";

export interface ProviderRegistration {
  providerId: string;
  config: ProviderConfig;
}

const OPENAI_COMPLETIONS_API = "openai-completions" satisfies Api;

export function toProviderRegistration(
  providerId: string,
  provider: ModelsDevProvider,
  apiKey: string,
  baseUrl: string,
  options: RuntimeOptions,
  piProviderConfig?: PiModelsProviderConfig
): ProviderRegistration | null {
  const api = piProviderConfig?.api ?? toPiApi(provider);
  if (!api) return null;

  const compat = mergeCompat(getProviderCompat(provider), piProviderConfig?.compat);
  const models = Object.values(provider.models)
    .filter((model) => shouldIncludeModel(model, options))
    .map((model) => toProviderModelConfig(model, api, compat, piProviderConfig?.modelOverrides.get(model.id)));

  const cappedModels =
    options.maxModelsPerProvider === null ? models : models.slice(0, options.maxModelsPerProvider);

  if (cappedModels.length === 0) return null;

  return {
    providerId,
    config: {
      name: provider.name,
      baseUrl,
      apiKey,
      api,
      headers: piProviderConfig?.headers,
      authHeader: piProviderConfig?.authHeader,
      models: cappedModels
    }
  };
}

export function toPiApi(provider: ModelsDevProvider): typeof OPENAI_COMPLETIONS_API | null {
  if (provider.npm === "@ai-sdk/openai-compatible") return OPENAI_COMPLETIONS_API;
  if (provider.npm === "@openrouter/ai-sdk-provider") return OPENAI_COMPLETIONS_API;
  return null;
}

export function shouldIncludeModel(model: ModelsDevModel, options: RuntimeOptions): boolean {
  if (!model.tool_call) return false;
  if (!model.modalities.output.includes("text")) return false;
  if (model.status === "alpha" && !options.includeAlpha) return false;
  if (model.status === "beta" && !options.includeBeta) return false;
  if (model.status === "deprecated" && !options.includeDeprecated) return false;
  if (!Number.isFinite(model.limit.context) || model.limit.context <= 0) return false;
  if (!Number.isFinite(model.limit.output) || model.limit.output <= 0) return false;
  return true;
}

function toProviderModelConfig(
  model: ModelsDevModel,
  api: Api,
  compat: PiModelCompat,
  override?: PiModelOverride
): ProviderModelConfig {
  const config: ProviderModelConfig = {
    id: model.id,
    name: model.name || model.id,
    api,
    baseUrl: model.provider?.api,
    reasoning: model.reasoning,
    input: toPiInput(model),
    cost: {
      input: model.cost?.input ?? 0,
      output: model.cost?.output ?? 0,
      cacheRead: model.cost?.cache_read ?? 0,
      cacheWrite: model.cost?.cache_write ?? 0
    },
    contextWindow: model.limit.context,
    maxTokens: model.limit.output,
    headers: model.provider?.headers,
    compat
  };

  return applyModelOverride(config, override);
}

function toPiInput(model: ModelsDevModel): ("text" | "image")[] {
  const input: ("text" | "image")[] = ["text"];
  if (model.modalities.input.includes("image")) input.push("image");
  return input;
}

function applyModelOverride(model: ProviderModelConfig, override: PiModelOverride | undefined): ProviderModelConfig {
  if (!override) return model;
  return {
    ...model,
    name: override.name ?? model.name,
    reasoning: override.reasoning ?? model.reasoning,
    thinkingLevelMap: override.thinkingLevelMap
      ? { ...model.thinkingLevelMap, ...override.thinkingLevelMap }
      : model.thinkingLevelMap,
    input: override.input ?? model.input,
    cost: override.cost
      ? {
          input: override.cost.input ?? model.cost.input,
          output: override.cost.output ?? model.cost.output,
          cacheRead: override.cost.cacheRead ?? model.cost.cacheRead,
          cacheWrite: override.cost.cacheWrite ?? model.cost.cacheWrite
        }
      : model.cost,
    contextWindow: override.contextWindow ?? model.contextWindow,
    maxTokens: override.maxTokens ?? model.maxTokens,
    headers: mergeHeaders(model.headers, override.headers),
    compat: mergeCompat(model.compat, override.compat)
  };
}

function mergeHeaders(
  base: Record<string, string> | undefined,
  override: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!base) return override;
  if (!override) return base;
  return { ...base, ...override };
}

function mergeCompat(base: Model<any>["compat"], override: Model<any>["compat"]): Model<any>["compat"] {
  if (!base) return override;
  if (!override) return base;
  const merged = { ...base, ...override } as Record<string, unknown>;
  mergeNestedCompat(merged, base, override, "openRouterRouting");
  mergeNestedCompat(merged, base, override, "vercelGatewayRouting");
  return merged as Model<any>["compat"];
}

function mergeNestedCompat(
  merged: Record<string, unknown>,
  base: Model<any>["compat"],
  override: Model<any>["compat"],
  key: string
): void {
  const baseRecord = toRecord(base);
  const overrideRecord = toRecord(override);
  const baseNested = toRecord(baseRecord?.[key]);
  const overrideNested = toRecord(overrideRecord?.[key]);
  if (baseNested || overrideNested) {
    merged[key] = { ...baseNested, ...overrideNested };
  }
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
