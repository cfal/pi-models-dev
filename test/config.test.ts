import { describe, expect, test } from "bun:test";
import { readRuntimeOptions } from "../src/config.js";

describe("readRuntimeOptions", () => {
  test("uses conservative defaults", () => {
    const options = readRuntimeOptions({});

    expect(options.enabled).toBe(true);
    expect(options.overrideProviders.size).toBe(0);
    expect(options.includeAlpha).toBe(false);
    expect(options.includeBeta).toBe(true);
    expect(options.includeDeprecated).toBe(false);
    expect(options.catalog.sourceUrl).toBe("https://models.dev/api.json");
    expect(options.catalog.timeoutMs).toBe(3_000);
    expect(options.catalog.cacheTtlMs).toBe(86_400_000);
    expect(options.catalog.offline).toBe(false);
  });

  test("parses lists and booleans", () => {
    const options = readRuntimeOptions({
      PI_MODELS_DEV_ENABLED: "false",
      PI_MODELS_DEV_DEBUG: "yes",
      PI_MODELS_DEV_OVERRIDE_PROVIDERS: "openrouter, deepseek",
      PI_MODELS_DEV_INCLUDE_ALPHA: "1",
      PI_MODELS_DEV_INCLUDE_BETA: "0",
      PI_MODELS_DEV_INCLUDE_DEPRECATED: "true"
    });

    expect(options.enabled).toBe(false);
    expect(options.debug).toBe(true);
    expect(options.overrideProviders.has("openrouter")).toBe(true);
    expect(options.overrideProviders.has("deepseek")).toBe(true);
    expect(options.includeAlpha).toBe(true);
    expect(options.includeBeta).toBe(false);
    expect(options.includeDeprecated).toBe(true);
  });

  test("parses catalog overrides", () => {
    const options = readRuntimeOptions({
      PI_MODELS_DEV_SOURCE_URL: "https://example.test/api.json",
      PI_MODELS_DEV_FETCH_TIMEOUT_MS: "42",
      PI_MODELS_DEV_CACHE_TTL_MS: "1000",
      PI_MODELS_DEV_CACHE_DIR: "/tmp/models-dev-cache",
      PI_MODELS_DEV_MAX_MODELS_PER_PROVIDER: "3",
      PI_MODELS_DEV_OFFLINE: "1"
    });

    expect(options.catalog.sourceUrl).toBe("https://example.test/api.json");
    expect(options.catalog.timeoutMs).toBe(42);
    expect(options.catalog.cacheTtlMs).toBe(1000);
    expect(options.catalog.cacheDir).toBe("/tmp/models-dev-cache");
    expect(options.maxModelsPerProvider).toBe(3);
    expect(options.catalog.offline).toBe(true);
  });

  test("does not inherit Pi offline mode", () => {
    const options = readRuntimeOptions({
      PI_OFFLINE: "1"
    });

    expect(options.catalog.offline).toBe(false);
  });

  test("falls back on invalid integer values", () => {
    const options = readRuntimeOptions({
      PI_MODELS_DEV_FETCH_TIMEOUT_MS: "-1",
      PI_MODELS_DEV_CACHE_TTL_MS: "not-a-number",
      PI_MODELS_DEV_MAX_MODELS_PER_PROVIDER: "0"
    });

    expect(options.catalog.timeoutMs).toBe(3_000);
    expect(options.catalog.cacheTtlMs).toBe(86_400_000);
    expect(options.maxModelsPerProvider).toBeNull();
  });
});
