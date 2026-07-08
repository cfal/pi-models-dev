export interface ModelsDevCatalog {
  [providerId: string]: ModelsDevProvider;
}

export interface ModelsDevProvider {
  id: string;
  name: string;
  env: string[];
  npm: string;
  api?: string;
  doc?: string;
  models: Record<string, ModelsDevModel>;
}

export interface ModelsDevModel {
  id: string;
  name: string;
  attachment: boolean;
  reasoning: boolean;
  reasoning_options?: ModelsDevReasoningOption[];
  tool_call: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  status?: "alpha" | "beta" | "deprecated";
  modalities: {
    input: ModelsDevModality[];
    output: ModelsDevModality[];
  };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
    reasoning?: number;
  };
  limit: {
    context: number;
    input?: number;
    output: number;
  };
  provider?: {
    npm?: string;
    api?: string;
    shape?: "responses" | "completions";
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
}

export type ModelsDevModality = "text" | "audio" | "image" | "video" | "pdf";

export interface ModelsDevReasoningOption {
  type: string;
  values?: Array<string | null>;
}

const MODEL_STATUSES = new Set(["alpha", "beta", "deprecated"]);
const MODALITIES = new Set(["text", "audio", "image", "video", "pdf"]);

export function isModelsDevCatalog(value: unknown): value is ModelsDevCatalog {
  if (!isRecord(value)) return false;

  for (const [providerId, provider] of Object.entries(value)) {
    if (!isModelsDevProvider(providerId, provider)) return false;
  }

  return true;
}

function isModelsDevProvider(providerId: string, value: unknown): value is ModelsDevProvider {
  if (!isRecord(value)) return false;
  if (value.id !== providerId) return false;
  if (typeof value.name !== "string" || value.name.length === 0) return false;
  if (!isStringArray(value.env) || value.env.length === 0) return false;
  if (typeof value.npm !== "string" || value.npm.length === 0) return false;
  if (value.api !== undefined && typeof value.api !== "string") return false;
  if (value.doc !== undefined && typeof value.doc !== "string") return false;
  if (!isRecord(value.models)) return false;

  for (const [modelId, model] of Object.entries(value.models)) {
    if (!isModelsDevModel(modelId, model)) return false;
  }

  return true;
}

function isModelsDevModel(modelId: string, value: unknown): value is ModelsDevModel {
  if (!isRecord(value)) return false;
  if (value.id !== modelId) return false;
  if (typeof value.name !== "string" || value.name.length === 0) return false;
  if (typeof value.attachment !== "boolean") return false;
  if (typeof value.reasoning !== "boolean") return false;
  if (value.reasoning_options !== undefined && !isReasoningOptions(value.reasoning_options)) return false;
  if (typeof value.tool_call !== "boolean") return false;
  if (value.structured_output !== undefined && typeof value.structured_output !== "boolean") return false;
  if (value.temperature !== undefined && typeof value.temperature !== "boolean") return false;
  if (value.status !== undefined && (typeof value.status !== "string" || !MODEL_STATUSES.has(value.status))) return false;
  if (!isModalities(value.modalities)) return false;
  if (value.cost !== undefined && !isCost(value.cost)) return false;
  if (!isLimit(value.limit)) return false;
  if (value.provider !== undefined && !isModelProviderOverride(value.provider)) return false;
  return true;
}

function isModalities(value: unknown): value is ModelsDevModel["modalities"] {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.input) || !Array.isArray(value.output)) return false;
  return value.input.every(isModality) && value.output.every(isModality);
}

function isModality(value: unknown): value is ModelsDevModality {
  return typeof value === "string" && MODALITIES.has(value);
}

function isCost(value: unknown): value is ModelsDevModel["cost"] {
  if (!isRecord(value)) return false;
  return (
    isOptionalNumber(value.input) &&
    isOptionalNumber(value.output) &&
    isOptionalNumber(value.cache_read) &&
    isOptionalNumber(value.cache_write) &&
    isOptionalNumber(value.reasoning)
  );
}

function isLimit(value: unknown): value is ModelsDevModel["limit"] {
  if (!isRecord(value)) return false;
  return isNonNegativeNumber(value.context) && isOptionalNonNegativeNumber(value.input) && isNonNegativeNumber(value.output);
}

function isModelProviderOverride(value: unknown): value is NonNullable<ModelsDevModel["provider"]> {
  if (!isRecord(value)) return false;
  if (value.npm !== undefined && typeof value.npm !== "string") return false;
  if (value.api !== undefined && typeof value.api !== "string") return false;
  if (value.shape !== undefined && value.shape !== "responses" && value.shape !== "completions") return false;
  if (value.body !== undefined && !isRecord(value.body)) return false;
  if (value.headers !== undefined && !isStringRecord(value.headers)) return false;
  return true;
}

function isReasoningOptions(value: unknown): value is ModelsDevReasoningOption[] {
  if (!Array.isArray(value)) return false;
  return value.every((option) => {
    if (!isRecord(option)) return false;
    if (typeof option.type !== "string" || option.type.length === 0) return false;
    if (option.values !== undefined && !isReasoningOptionValues(option.values)) return false;
    return true;
  });
}

function isReasoningOptionValues(value: unknown): value is Array<string | null> {
  return Array.isArray(value) && value.every((item) => item === null || typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || isNonNegativeNumber(value);
}
