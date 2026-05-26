import type { Model } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stripJsonComments } from "./json-comments.js";

export interface PiNativeConfig {
  authProviders: Set<string>;
  modelProviders: Map<string, PiModelsProviderConfig>;
  errors: string[];
}

export interface PiModelsProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  authHeader?: boolean;
  compat?: Model<any>["compat"];
  hasModels: boolean;
  modelOverrides: Map<string, PiModelOverride>;
}

export interface PiModelOverride {
  name?: string;
  reasoning?: boolean;
  thinkingLevelMap?: Model<any>["thinkingLevelMap"];
  input?: ("text" | "image")[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  contextWindow?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  compat?: Model<any>["compat"];
}

export interface PiNativeConfigOptions {
  agentDir?: string;
}

export async function readPiNativeConfig(options: PiNativeConfigOptions = {}): Promise<PiNativeConfig> {
  const agentDir = options.agentDir ?? getAgentDir();
  const errors: string[] = [];
  const [authProviders, modelProviders] = await Promise.all([
    readAuthProviders(join(agentDir, "auth.json"), errors),
    readModelProviders(join(agentDir, "models.json"), errors)
  ]);

  return { authProviders, modelProviders, errors };
}

async function readAuthProviders(path: string, errors: string[]): Promise<Set<string>> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (!isRecord(parsed)) {
      errors.push(`Ignoring auth.json because it is not an object: ${path}`);
      return new Set();
    }

    return new Set(
      Object.entries(parsed)
        .filter(([_providerId, credential]) => isApiKeyCredential(credential))
        .map(([providerId]) => providerId)
    );
  } catch (error) {
    if (isMissingFileError(error)) return new Set();
    errors.push(`Failed to read auth.json: ${error instanceof Error ? error.message : String(error)}`);
    return new Set();
  }
}

async function readModelProviders(path: string, errors: string[]): Promise<Map<string, PiModelsProviderConfig>> {
  try {
    const parsed = JSON.parse(stripJsonComments(await readFile(path, "utf8")));
    if (!isRecord(parsed) || !isRecord(parsed.providers)) {
      errors.push(`Ignoring models.json because it does not contain a providers object: ${path}`);
      return new Map();
    }

    const providers = new Map<string, PiModelsProviderConfig>();
    for (const [providerId, rawConfig] of Object.entries(parsed.providers)) {
      const config = parseProviderConfig(rawConfig);
      if (config) providers.set(providerId, config);
    }
    return providers;
  } catch (error) {
    if (isMissingFileError(error)) return new Map();
    errors.push(`Failed to read models.json: ${error instanceof Error ? error.message : String(error)}`);
    return new Map();
  }
}

function parseProviderConfig(value: unknown): PiModelsProviderConfig | null {
  if (!isRecord(value)) return null;
  const baseUrl = typeof value.baseUrl === "string" && value.baseUrl.length > 0 ? value.baseUrl : undefined;
  const apiKey = typeof value.apiKey === "string" && value.apiKey.length > 0 ? value.apiKey : undefined;
  const api = typeof value.api === "string" && value.api.length > 0 ? value.api : undefined;
  const headers = isStringRecord(value.headers) ? value.headers : undefined;
  const authHeader = typeof value.authHeader === "boolean" ? value.authHeader : undefined;
  const compat = isRecord(value.compat) ? (value.compat as Model<any>["compat"]) : undefined;
  const hasModels = Array.isArray(value.models) && value.models.length > 0;
  const modelOverrides = parseModelOverrides(value.modelOverrides);

  if (!baseUrl && !headers && !compat && modelOverrides.size === 0 && !hasModels) {
    return null;
  }

  return {
    baseUrl,
    apiKey,
    api,
    headers,
    authHeader,
    compat,
    hasModels,
    modelOverrides
  };
}

function isApiKeyCredential(value: unknown): boolean {
  return isRecord(value) && value.type === "api_key" && typeof value.key === "string" && value.key.length > 0;
}

function parseModelOverrides(value: unknown): Map<string, PiModelOverride> {
  if (!isRecord(value)) return new Map();
  const overrides = new Map<string, PiModelOverride>();

  for (const [modelId, rawOverride] of Object.entries(value)) {
    if (!isRecord(rawOverride)) {
      overrides.set(modelId, {});
      continue;
    }
    overrides.set(modelId, parseModelOverride(rawOverride));
  }

  return overrides;
}

function parseModelOverride(value: Record<string, unknown>): PiModelOverride {
  return {
    name: typeof value.name === "string" && value.name.length > 0 ? value.name : undefined,
    reasoning: typeof value.reasoning === "boolean" ? value.reasoning : undefined,
    thinkingLevelMap: isRecord(value.thinkingLevelMap) ? (value.thinkingLevelMap as Model<any>["thinkingLevelMap"]) : undefined,
    input: isInputArray(value.input) ? value.input : undefined,
    cost: parseCostOverride(value.cost),
    contextWindow: isPositiveNumber(value.contextWindow) ? value.contextWindow : undefined,
    maxTokens: isPositiveNumber(value.maxTokens) ? value.maxTokens : undefined,
    headers: isStringRecord(value.headers) ? value.headers : undefined,
    compat: isRecord(value.compat) ? (value.compat as Model<any>["compat"]) : undefined
  };
}

function parseCostOverride(value: unknown): PiModelOverride["cost"] | undefined {
  if (!isRecord(value)) return undefined;
  const cost = {
    input: isNumber(value.input) ? value.input : undefined,
    output: isNumber(value.output) ? value.output : undefined,
    cacheRead: isNumber(value.cacheRead) ? value.cacheRead : undefined,
    cacheWrite: isNumber(value.cacheWrite) ? value.cacheWrite : undefined
  };
  return Object.values(cost).some((entry) => entry !== undefined) ? cost : undefined;
}

function isInputArray(value: unknown): value is ("text" | "image")[] {
  return Array.isArray(value) && value.every((entry) => entry === "text" || entry === "image");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
