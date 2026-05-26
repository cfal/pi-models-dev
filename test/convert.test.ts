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
