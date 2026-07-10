import { describe, expect, test } from "bun:test";
import { shouldIncludeModel, toProviderRegistration } from "../src/convert.js";
import { makeModel, makeProvider, makeRuntimeOptions } from "./fixtures.js";

describe("model conversion", () => {
  test("maps Alibaba Qwen to OpenAI completions with Qwen compat", () => {
    const provider = makeProvider();
    const registration = toProviderRegistration(
      "alibaba-cn",
      provider,
      "DASHSCOPE_API_KEY",
      provider.api!,
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("alibaba-cn");
    expect(registration?.config.api).toBe("openai-completions");
    expect(registration?.config.apiKey).toBe("DASHSCOPE_API_KEY");
    expect(model?.id).toBe("qwen3.5-flash");
    expect(model?.input).toEqual(["text", "image"]);
    expect(model?.cost).toEqual({
      input: 0.172,
      output: 1.72,
      cacheRead: 0,
      cacheWrite: 0
    });
    expect(model?.contextWindow).toBe(1_000_000);
    expect(model?.maxTokens).toBe(65_536);
    expect(model?.compat).toMatchObject({
      thinkingFormat: "qwen",
      maxTokensField: "max_tokens",
      supportsDeveloperRole: false
    });
  });

  test("maps xAI provider packages to OpenAI completions with xAI compat", () => {
    const provider = makeProvider({
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
          ],
          limit: {
            context: 500_000,
            output: 500_000
          }
        })
      }
    });
    const registration = toProviderRegistration(
      "xai",
      provider,
      "XAI_API_KEY",
      "https://api.x.ai/v1",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("xai");
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.id).toBe("grok-4.5");
    expect(model?.contextWindow).toBe(500_000);
    expect(model?.maxTokens).toBe(500_000);
    expect(model?.thinkingLevelMap).toEqual({
      off: null,
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high"
    });
    expect(model?.compat).toMatchObject({
      supportsReasoningEffort: true
    });
  });

  test("maps OpenRouter provider packages to OpenAI completions with OpenRouter reasoning", () => {
    const provider = makeProvider({
      id: "openrouter",
      name: "OpenRouter",
      env: ["OPENROUTER_API_KEY"],
      npm: "@openrouter/ai-sdk-provider",
      api: "https://openrouter.ai/api/v1",
      models: {
        "z-ai/glm-5.2": makeModel({
          id: "z-ai/glm-5.2",
          name: "GLM-5.2",
          reasoning_options: [
            {
              type: "effort",
              values: ["high", "xhigh"]
            }
          ]
        })
      }
    });
    const registration = toProviderRegistration(
      "openrouter",
      provider,
      "OPENROUTER_API_KEY",
      provider.api!,
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: "xhigh"
    });
    expect(model?.compat).toMatchObject({
      thinkingFormat: "openrouter"
    });
  });

  test("maps OpenAI provider packages to OpenAI Responses", () => {
    const provider = makeProvider({
      id: "openai",
      name: "OpenAI",
      env: ["OPENAI_API_KEY"],
      npm: "@ai-sdk/openai",
      api: undefined,
      models: {
        "gpt-5.2": makeModel({
          id: "gpt-5.2",
          name: "GPT-5.2",
          reasoning_options: [
            {
              type: "effort",
              values: ["none", "low", "medium", "high", "xhigh"]
            }
          ]
        })
      }
    });
    const registration = toProviderRegistration(
      "openai",
      provider,
      "OPENAI_API_KEY",
      "https://api.openai.com/v1",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.config.api).toBe("openai-responses");
    expect(model?.thinkingLevelMap).toEqual({
      off: "none",
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh"
    });
    expect(model?.compat).toBeUndefined();
  });

  test("maps Together AI provider packages to OpenAI completions with together compat", () => {
    const provider = makeProvider({
      id: "togetherai",
      name: "Together AI",
      env: ["TOGETHER_API_KEY"],
      npm: "@ai-sdk/togetherai",
      api: undefined,
      models: {
        "zai-org/GLM-5.2": makeModel({
          id: "zai-org/GLM-5.2",
          name: "GLM-5.2",
          limit: {
            context: 262_144,
            output: 164_000
          }
        })
      }
    });
    const registration = toProviderRegistration(
      "together",
      provider,
      "TOGETHER_API_KEY",
      "https://api.together.ai/v1",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("together");
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.id).toBe("zai-org/GLM-5.2");
    expect(model?.contextWindow).toBe(262_144);
    expect(model?.maxTokens).toBe(164_000);
    expect(model?.compat).toMatchObject({
      thinkingFormat: "together",
      maxTokensField: "max_tokens",
      supportsDeveloperRole: false
    });
  });

  test("maps Cerebras provider packages to OpenAI completions with reasoning effort", () => {
    const provider = makeProvider({
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
    const registration = toProviderRegistration(
      "cerebras",
      provider,
      "CEREBRAS_API_KEY",
      "https://api.cerebras.ai/v1",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("cerebras");
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.id).toBe("llama-4-scout-17b-16e-instruct");
    expect(model?.contextWindow).toBe(64_000);
    expect(model?.maxTokens).toBe(64_000);
    expect(model?.thinkingLevelMap).toEqual({
      off: null,
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high"
    });
    expect(model?.compat).toMatchObject({
      supportsReasoningEffort: true
    });
  });

  test("maps DeepInfra provider packages to OpenAI completions", () => {
    const provider = makeProvider({
      id: "deepinfra",
      name: "Deep Infra",
      env: ["DEEPINFRA_API_KEY"],
      npm: "@ai-sdk/deepinfra",
      api: undefined,
      models: {
        "meta-llama/Llama-4-Scout-17B-16E-Instruct": makeModel({
          id: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
          name: "Llama 4 Scout 17B",
          reasoning_options: [
            {
              type: "effort",
              values: ["low", "medium", "high", "xhigh"]
            }
          ],
          limit: { context: 524_288, output: 32_768 }
        })
      }
    });
    const registration = toProviderRegistration(
      "deepinfra",
      provider,
      "DEEPINFRA_API_KEY",
      "https://api.deepinfra.com/v1/openai",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("deepinfra");
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.id).toBe("meta-llama/Llama-4-Scout-17B-16E-Instruct");
    expect(model?.contextWindow).toBe(524_288);
    expect(model?.compat).toMatchObject({
      supportsReasoningEffort: true
    });
  });

  test("maps Venice provider packages to OpenAI completions", () => {
    const provider = makeProvider({
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
    const registration = toProviderRegistration(
      "venice",
      provider,
      "VENICE_API_KEY",
      "https://api.venice.ai/api/v1",
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(registration?.providerId).toBe("venice");
    expect(registration?.config.api).toBe("openai-completions");
    expect(model?.id).toBe("llama-3.3-70b");
    expect(model?.contextWindow).toBe(16_000);
    expect(model?.maxTokens).toBe(4_096);
  });

  test("maps declared effort values for OpenAI-compatible models", () => {
    const provider = makeProvider({
      id: "custom-openai",
      name: "Custom OpenAI",
      env: ["CUSTOM_OPENAI_API_KEY"],
      npm: "@ai-sdk/openai-compatible",
      api: "https://api.example.test/v1",
      models: {
        reasoner: makeModel({
          id: "reasoner",
          name: "Reasoner",
          reasoning_options: [
            {
              type: "effort",
              values: ["none", "low", "medium", "high", "max"]
            }
          ]
        })
      }
    });
    const registration = toProviderRegistration(
      "custom-openai",
      provider,
      "CUSTOM_OPENAI_API_KEY",
      provider.api!,
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(model?.thinkingLevelMap).toEqual({
      off: "none",
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "max"
    });
    expect(model?.compat).toMatchObject({
      supportsDeveloperRole: false,
      supportsStore: false
    });
    expect(model?.compat).not.toMatchObject({
      supportsReasoningEffort: false
    });
  });

  test("marks unsupported lower effort levels for OpenAI-compatible models", () => {
    const provider = makeProvider({
      id: "alibaba-token-plan",
      name: "Alibaba Token Plan",
      env: ["ALIBABA_TOKEN_PLAN_API_KEY"],
      npm: "@ai-sdk/openai-compatible",
      api: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      models: {
        "glm-5.2": makeModel({
          id: "glm-5.2",
          name: "GLM-5.2",
          reasoning_options: [
            {
              type: "effort",
              values: ["high", "max"]
            }
          ]
        })
      }
    });
    const registration = toProviderRegistration(
      "alibaba-token-plan",
      provider,
      "ALIBABA_TOKEN_PLAN_API_KEY",
      provider.api!,
      makeRuntimeOptions()
    );

    const model = registration?.config.models?.[0];
    expect(model?.thinkingLevelMap).toEqual({
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: "max"
    });
    expect(model?.compat).not.toMatchObject({
      supportsReasoningEffort: false
    });
  });

  test("maps null declared effort to omitted off parameter", () => {
    const provider = makeProvider({
      models: {
        reasoner: makeModel({
          id: "reasoner",
          name: "Reasoner",
          reasoning_options: [
            {
              type: "effort",
              values: [null, "low", "medium", "high"]
            }
          ]
        })
      }
    });
    const registration = toProviderRegistration(
      "alibaba-cn",
      provider,
      "DASHSCOPE_API_KEY",
      provider.api!,
      makeRuntimeOptions()
    );

    expect(registration?.config.models?.[0]?.thinkingLevelMap).toEqual({
      minimal: "low",
      low: "low",
      medium: "medium",
      high: "high"
    });
  });

  test("filters models by tool use, status, output modality, and limits", () => {
    const options = makeRuntimeOptions();

    expect(shouldIncludeModel(makeModel(), options)).toBe(true);
    expect(shouldIncludeModel(makeModel({ tool_call: false }), options)).toBe(false);
    expect(shouldIncludeModel(makeModel({ modalities: { input: ["text"], output: ["image"] } }), options)).toBe(false);
    expect(shouldIncludeModel(makeModel({ status: "alpha" }), options)).toBe(false);
    expect(shouldIncludeModel(makeModel({ status: "beta" }), options)).toBe(true);
    expect(shouldIncludeModel(makeModel({ status: "deprecated" }), options)).toBe(false);
    expect(shouldIncludeModel(makeModel({ limit: { context: 0, output: 1 } }), options)).toBe(false);
    expect(shouldIncludeModel(makeModel({ limit: { context: 1, output: 0 } }), options)).toBe(false);
  });

  test("honors status options", () => {
    expect(shouldIncludeModel(makeModel({ status: "alpha" }), makeRuntimeOptions({ includeAlpha: true }))).toBe(true);
    expect(shouldIncludeModel(makeModel({ status: "beta" }), makeRuntimeOptions({ includeBeta: false }))).toBe(false);
    expect(
      shouldIncludeModel(makeModel({ status: "deprecated" }), makeRuntimeOptions({ includeDeprecated: true }))
    ).toBe(true);
  });

  test("caps models per provider", () => {
    const first = makeModel({ id: "first", name: "First" });
    const second = makeModel({ id: "second", name: "Second" });
    const provider = makeProvider({
      models: {
        first,
        second
      }
    });

    const registration = toProviderRegistration(
      "alibaba-cn",
      provider,
      "DASHSCOPE_API_KEY",
      provider.api!,
      makeRuntimeOptions({ maxModelsPerProvider: 1 })
    );

    expect(registration?.config.models).toHaveLength(1);
    expect(registration?.config.models?.[0]?.id).toBe("first");
  });

  test("applies models.json provider and model overrides", () => {
    const provider = makeProvider({
      models: {
        "qwen3.5-flash": makeModel({
          provider: {
            headers: {
              "x-models-dev": "1"
            }
          }
        })
      }
    });

    const registration = toProviderRegistration(
      "alibaba-cn",
      provider,
      "DASHSCOPE_API_KEY",
      provider.api!,
      makeRuntimeOptions(),
      {
        api: "openai-completions",
        headers: {
          "x-provider": "workspace"
        },
        authHeader: true,
        compat: {
          supportsStrictMode: true
        },
        hasModels: false,
        modelOverrides: new Map([
          [
            "qwen3.5-flash",
            {
              name: "Workspace Qwen",
              reasoning: false,
              cost: {
                output: 2
              },
              headers: {
                "x-model": "override"
              },
              compat: {
                supportsStore: true
              }
            }
          ]
        ])
      }
    );

    const model = registration?.config.models?.[0];
    expect(registration?.config.headers).toEqual({ "x-provider": "workspace" });
    expect(registration?.config.authHeader).toBe(true);
    expect(model?.name).toBe("Workspace Qwen");
    expect(model?.reasoning).toBe(false);
    expect(model?.cost.output).toBe(2);
    expect(model?.headers).toEqual({
      "x-models-dev": "1",
      "x-model": "override"
    });
    expect(model?.compat).toMatchObject({
      thinkingFormat: "qwen",
      supportsStrictMode: true,
      supportsStore: true
    });
  });
});
