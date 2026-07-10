import { describe, expect, test } from "bun:test";
import {
  buildProviderRegistrations,
  interpolateEnvironment,
  resolveProviderApiKey,
  resolveProviderBaseUrl
} from "../src/providers.js";
import { makeCatalog, makeModel, makePiConfig, makeProvider, makeRuntimeOptions } from "./fixtures.js";

describe("provider registration planning", () => {
  test("registers a missing provider selected by auth.json", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["alibaba-cn"] }),
      {},
      ["openrouter"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("alibaba-cn");
    expect(result.registrations[0].config.apiKey).toBe("DASHSCOPE_API_KEY");
    expect(result.stats.registered).toBe(1);
  });

  test("registers a missing provider selected by models.json provider config", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions(),
      makePiConfig({
        modelProviders: [["alibaba-cn", { baseUrl: "https://workspace.example/compatible-mode/v1" }]]
      }),
      { DASHSCOPE_API_KEY: "secret" },
      []
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].config.baseUrl).toBe("https://workspace.example/compatible-mode/v1");
    expect(result.registrations[0].config.apiKey).toBe("DASHSCOPE_API_KEY");
  });

  test("does not use environment variables alone as provider intent", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions(),
      makePiConfig(),
      { DASHSCOPE_API_KEY: "secret" },
      []
    );

    expect(result.registrations).toHaveLength(0);
    expect(result.stats.skippedNoIntent).toBe(1);
  });

  test("skips selected providers without configured auth", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions(),
      makePiConfig({ modelProviders: [["alibaba-cn", { baseUrl: "https://workspace.example/v1" }]] }),
      {},
      []
    );

    expect(result.registrations).toHaveLength(0);
    expect(result.stats.skippedMissingAuth).toBe(1);
  });

  test("skips built-in providers unless explicitly overridden", () => {
    const openrouter = makeProvider({
      id: "openrouter",
      name: "OpenRouter",
      env: ["OPENROUTER_API_KEY"],
      npm: "@openrouter/ai-sdk-provider",
      api: "https://openrouter.ai/api/v1"
    });

    const result = buildProviderRegistrations(
      makeCatalog(openrouter),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["openrouter"] }),
      {},
      ["openrouter"]
    );

    expect(result.registrations).toHaveLength(0);
    expect(result.stats.skippedCollision).toBe(1);
  });

  test("overrides built-in providers only when named in overrideProviders", () => {
    const openrouter = makeProvider({
      id: "openrouter",
      name: "OpenRouter",
      env: ["OPENROUTER_API_KEY"],
      npm: "@openrouter/ai-sdk-provider",
      api: "https://openrouter.ai/api/v1"
    });

    const result = buildProviderRegistrations(
      makeCatalog(openrouter),
      makeRuntimeOptions({ overrideProviders: new Set(["openrouter"]) }),
      makePiConfig(),
      { OPENROUTER_API_KEY: "secret" },
      ["openrouter"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("openrouter");
  });

  test("overrides every provider when overrideProviders contains all", () => {
    const openrouter = makeProvider({
      id: "openrouter",
      name: "OpenRouter",
      env: ["OPENROUTER_API_KEY"],
      npm: "@openrouter/ai-sdk-provider",
      api: "https://openrouter.ai/api/v1"
    });

    const result = buildProviderRegistrations(
      makeCatalog(openrouter),
      makeRuntimeOptions({ overrideProviders: new Set(["all"]) }),
      makePiConfig(),
      { OPENROUTER_API_KEY: "secret" },
      ["openrouter"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("openrouter");
  });

  test("uses all as provider intent for non-built-in providers", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions({ overrideProviders: new Set(["all"]) }),
      makePiConfig(),
      { DASHSCOPE_API_KEY: "secret" },
      []
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("alibaba-cn");
  });

  test("registers models.dev fireworks-ai as Pi fireworks", () => {
    const fireworks = makeProvider({
      id: "fireworks-ai",
      name: "Fireworks AI",
      env: ["FIREWORKS_API_KEY"],
      api: "https://api.fireworks.ai/inference/v1"
    });

    const result = buildProviderRegistrations(
      makeCatalog(fireworks),
      makeRuntimeOptions({ overrideProviders: new Set(["fireworks"]) }),
      makePiConfig({ authProviders: ["fireworks"] }),
      {},
      ["fireworks"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("fireworks");
    expect(result.registrations[0].config.apiKey).toBe("FIREWORKS_API_KEY");
  });

  test("applies Pi fireworks models.json config to models.dev fireworks-ai", () => {
    const fireworks = makeProvider({
      id: "fireworks-ai",
      name: "Fireworks AI",
      env: ["FIREWORKS_API_KEY"],
      api: "https://api.fireworks.ai/inference/v1"
    });

    const result = buildProviderRegistrations(
      makeCatalog(fireworks),
      makeRuntimeOptions({ overrideProviders: new Set(["fireworks"]) }),
      makePiConfig({
        modelProviders: [["fireworks", { baseUrl: "https://workspace.example/fireworks/v1" }]]
      }),
      { FIREWORKS_API_KEY: "secret" },
      ["fireworks"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("fireworks");
    expect(result.registrations[0].config.baseUrl).toBe("https://workspace.example/fireworks/v1");
  });

  test("overrides built-in xAI with models.dev xAI using Pi's xAI base URL", () => {
    const xai = makeProvider({
      id: "xai",
      name: "xAI",
      env: ["XAI_API_KEY"],
      npm: "@ai-sdk/xai",
      api: undefined,
      models: {
        "grok-4.5": makeModel({
          id: "grok-4.5",
          name: "Grok 4.5",
          reasoning_options: [
            {
              type: "effort",
              values: ["low", "medium", "high"]
            }
          ]
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(xai),
      makeRuntimeOptions({ overrideProviders: new Set(["xai"]) }),
      makePiConfig({ authProviders: ["xai"] }),
      {},
      ["xai"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("xai");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.x.ai/v1");
    expect(result.registrations[0].config.apiKey).toBe("XAI_API_KEY");
    expect(result.registrations[0].config.models?.[0]?.id).toBe("grok-4.5");
    expect(result.registrations[0].config.models?.[0]?.compat).toMatchObject({
      supportsReasoningEffort: true
    });
  });

  test("overrides built-in OpenAI with models.dev OpenAI using Pi's OpenAI base URL", () => {
    const openai = makeProvider({
      id: "openai",
      name: "OpenAI",
      env: ["OPENAI_API_KEY"],
      npm: "@ai-sdk/openai",
      api: undefined,
      models: {
        "gpt-5.2": makeModel({
          id: "gpt-5.2",
          name: "GPT-5.2"
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(openai),
      makeRuntimeOptions({ overrideProviders: new Set(["openai"]) }),
      makePiConfig({ authProviders: ["openai"] }),
      {},
      ["openai"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("openai");
    expect(result.registrations[0].config.api).toBe("openai-responses");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.openai.com/v1");
    expect(result.registrations[0].config.apiKey).toBe("OPENAI_API_KEY");
    expect(result.registrations[0].config.models?.[0]?.id).toBe("gpt-5.2");
  });

  test("skips user-owned models.json providers unless explicitly overridden", () => {
    const result = buildProviderRegistrations(
      makeCatalog(),
      makeRuntimeOptions(),
      makePiConfig({
        modelProviders: [["alibaba-cn", { hasModels: true, baseUrl: "https://workspace.example/v1" }]]
      }),
      { DASHSCOPE_API_KEY: "secret" },
      []
    );

    expect(result.registrations).toHaveLength(0);
    expect(result.stats.skippedUserModels).toBe(1);
  });

  test("overrides Pi together with models.dev Together AI", () => {
    const togetherai = makeProvider({
      id: "togetherai",
      name: "Together AI",
      env: ["TOGETHER_API_KEY"],
      npm: "@ai-sdk/togetherai",
      api: undefined,
      models: {
        "zai-org/GLM-5.2": makeModel({
          id: "zai-org/GLM-5.2",
          name: "GLM-5.2",
          limit: { context: 262_144, output: 164_000 }
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(togetherai),
      makeRuntimeOptions({ overrideProviders: new Set(["all"]) }),
      makePiConfig({ authProviders: ["together"] }),
      {},
      ["together"]
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("together");
    expect(result.registrations[0].config.api).toBe("openai-completions");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.together.ai/v1");
    expect(result.registrations[0].config.apiKey).toBe("TOGETHER_API_KEY");
    expect(result.registrations[0].config.models?.[0]?.id).toBe("zai-org/GLM-5.2");
  });

  test("registers Cerebras as a supported provider with reasoning effort", () => {
    const cerebras = makeProvider({
      id: "cerebras",
      name: "Cerebras",
      env: ["CEREBRAS_API_KEY"],
      npm: "@ai-sdk/cerebras",
      api: undefined,
      models: {
        "llama-4-scout-17b-16e-instruct": makeModel({
          id: "llama-4-scout-17b-16e-instruct",
          name: "Llama 4 Scout 17B 16E",
          reasoning_options: [
            {
              type: "effort",
              values: ["low", "medium", "high"]
            }
          ],
          limit: { context: 64_000, output: 64_000 }
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(cerebras),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["cerebras"] }),
      {},
      []
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("cerebras");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.cerebras.ai/v1");
    expect(result.registrations[0].config.models?.[0]?.compat).toMatchObject({
      supportsReasoningEffort: true
    });
  });

  test("registers DeepInfra as a supported provider", () => {
    const deepinfra = makeProvider({
      id: "deepinfra",
      name: "Deep Infra",
      env: ["DEEPINFRA_API_KEY"],
      npm: "@ai-sdk/deepinfra",
      api: undefined,
      models: {
        "meta-llama/Llama-4-Scout-17B-16E-Instruct": makeModel({
          id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
          name: "Llama 4 Scout 17B",
          limit: { context: 524_288, output: 32_768 }
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(deepinfra),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["deepinfra"] }),
      {},
      []
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("deepinfra");
    expect(result.registrations[0].config.api).toBe("openai-completions");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.deepinfra.com/v1/openai");
    expect(result.registrations[0].config.apiKey).toBe("DEEPINFRA_API_KEY");
  });

  test("registers Venice as a supported provider", () => {
    const venice = makeProvider({
      id: "venice",
      name: "Venice AI",
      env: ["VENICE_API_KEY"],
      npm: "venice-ai-sdk-provider",
      api: undefined,
      models: {
        "llama-3.3-70b": makeModel({
          id: "llama-3.3-70b",
          name: "Llama 3.3 70B",
          limit: { context: 16_000, output: 4_096 }
        })
      }
    });

    const result = buildProviderRegistrations(
      makeCatalog(venice),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["venice"] }),
      {},
      []
    );

    expect(result.registrations).toHaveLength(1);
    expect(result.registrations[0].providerId).toBe("venice");
    expect(result.registrations[0].config.api).toBe("openai-completions");
    expect(result.registrations[0].config.baseUrl).toBe("https://api.venice.ai/api/v1");
    expect(result.registrations[0].config.apiKey).toBe("VENICE_API_KEY");
  });

  test("skips unsupported provider packages", () => {
    const provider = makeProvider({
      npm: "@ai-sdk/google",
      env: ["GOOGLE_GENERATIVE_AI_API_KEY"]
    });

    const result = buildProviderRegistrations(
      makeCatalog(provider),
      makeRuntimeOptions(),
      makePiConfig({ authProviders: ["alibaba-cn"] }),
      {},
      []
    );

    expect(result.registrations).toHaveLength(0);
    expect(result.stats.skippedUnsupported).toBe(1);
  });
});

describe("provider helpers", () => {
  test("resolves auth from models.json, auth.json, and environment fallback", () => {
    const provider = makeProvider({ env: ["FIRST_KEY", "SECOND_KEY"] });

    expect(resolveProviderApiKey(provider, makePiConfig(), undefined, {})).toBeNull();
    expect(
      resolveProviderApiKey(
        provider,
        makePiConfig(),
        { apiKey: "CUSTOM_KEY", hasModels: false, modelOverrides: new Map() },
        {}
      )
    ).toBe("CUSTOM_KEY");
    expect(resolveProviderApiKey(provider, makePiConfig({ authProviders: ["alibaba-cn"] }), undefined, {})).toBe(
      "FIRST_KEY"
    );
    expect(resolveProviderApiKey(provider, makePiConfig(), undefined, { SECOND_KEY: "secret" })).toBe("SECOND_KEY");
  });

  test("interpolates endpoint environment variables", () => {
    expect(interpolateEnvironment("https://${HOST}/v1", { HOST: "example.test" })).toBe("https://example.test/v1");
    expect(interpolateEnvironment("https://${HOST}/v1", {})).toBeNull();
  });

  test("resolves provider base URLs", () => {
    expect(resolveProviderBaseUrl(makeProvider(), undefined, {})).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1"
    );
    expect(resolveProviderBaseUrl(makeProvider({ api: "https://${HOST}/v1" }), undefined, {})).toBeNull();
    expect(resolveProviderBaseUrl(makeProvider({ api: "https://${HOST}/v1" }), undefined, { HOST: "example.test" })).toBe(
      "https://example.test/v1"
    );
    expect(
      resolveProviderBaseUrl(
        makeProvider(),
        { baseUrl: "https://${HOST}/v1", hasModels: false, modelOverrides: new Map() },
        { HOST: "workspace.example" }
      )
    ).toBe("https://workspace.example/v1");
  });
});
