import type { ThinkingLevelMap } from "@earendil-works/pi-ai";
import type { ModelsDevModel, ModelsDevReasoningOption } from "./models-dev.js";

interface DeclaredEffortValues {
  values: Set<string>;
  supportsOmittedOff: boolean;
}

export function modelDeclaresReasoningEffort(model: ModelsDevModel): boolean {
  return readDeclaredEffortValues(model) !== null;
}

export function buildThinkingLevelMap(model: ModelsDevModel): ThinkingLevelMap | undefined {
  const effort = readDeclaredEffortValues(model);
  if (!effort) return undefined;

  const map: ThinkingLevelMap = {};
  const off = mapOffEffort(effort);
  if (off !== undefined) map.off = off;

  map.minimal = mapMinimalEffort(effort.values);
  map.low = mapExactEffort(effort.values, "low");
  map.medium = mapExactEffort(effort.values, "medium");
  map.high = mapHighEffort(effort.values);

  const xhigh = mapXHighEffort(effort.values);
  if (xhigh !== undefined) map.xhigh = xhigh;

  return map;
}

function readDeclaredEffortValues(model: ModelsDevModel): DeclaredEffortValues | null {
  if (!model.reasoning) return null;

  const option = model.reasoning_options?.find(isEffortOption);
  if (!option?.values?.length) return null;

  const values = new Set(option.values.filter((value): value is string => typeof value === "string"));
  if (values.size === 0) return null;

  return {
    values,
    supportsOmittedOff: option.values.includes(null)
  };
}

function isEffortOption(option: ModelsDevReasoningOption): boolean {
  return option.type === "effort";
}

function mapOffEffort(effort: DeclaredEffortValues): string | null | undefined {
  if (effort.values.has("none")) return "none";
  if (effort.values.has("off")) return "off";
  if (effort.supportsOmittedOff) return undefined;
  return null;
}

function mapMinimalEffort(values: Set<string>): string | null {
  if (values.has("minimal")) return "minimal";
  if (values.has("low")) return "low";
  return null;
}

function mapExactEffort(values: Set<string>, effort: string): string | null {
  return values.has(effort) ? effort : null;
}

function mapHighEffort(values: Set<string>): string | null {
  if (values.has("high")) return "high";
  if (values.has("default")) return "default";
  return null;
}

function mapXHighEffort(values: Set<string>): string | undefined {
  if (values.has("xhigh")) return "xhigh";
  if (values.has("max")) return "max";
  return undefined;
}
