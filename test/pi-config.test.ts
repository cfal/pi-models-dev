import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPiNativeConfig } from "../src/pi-config.js";

describe("readPiNativeConfig", () => {
  test("reads auth.json and Pi-shaped models.json provider config", async () => {
    const agentDir = await makeAgentDir();
    await writeFile(
      join(agentDir, "auth.json"),
      JSON.stringify({
        "alibaba-cn": {
          type: "api_key",
          key: "DASHSCOPE_API_KEY"
        },
        "oauth-only": {
          type: "oauth",
          accessToken: "token"
        }
      })
    );
    await writeFile(
      join(agentDir, "models.json"),
      `{
        "providers": {
          "alibaba-cn": {
            // Workspace endpoint supplied by the user.
            "baseUrl": "https://workspace.example/compatible-mode/v1",
            "apiKey": "CUSTOM_KEY",
            "api": "openai-completions",
            "headers": {
              "x-workspace": "1",
            },
            "authHeader": true,
            "compat": {
              "supportsStrictMode": true,
            },
            "modelOverrides": {
              "qwen3.5-flash": {
                "name": "Workspace Qwen",
                "reasoning": false,
                "cost": {
                  "output": 2,
                },
                "headers": {
                  "x-model": "1",
                },
              },
            },
          },
          "api-key-only": {
            "apiKey": "IGNORED"
          }
        }
      }`
    );

    const config = await readPiNativeConfig({ agentDir });
    const provider = config.modelProviders.get("alibaba-cn");
    const modelOverride = provider?.modelOverrides.get("qwen3.5-flash");

    expect(config.errors).toEqual([]);
    expect(config.authProviders.has("alibaba-cn")).toBe(true);
    expect(config.authProviders.has("oauth-only")).toBe(false);
    expect(provider?.baseUrl).toBe("https://workspace.example/compatible-mode/v1");
    expect(provider?.apiKey).toBe("CUSTOM_KEY");
    expect(provider?.api).toBe("openai-completions");
    expect(provider?.headers).toEqual({ "x-workspace": "1" });
    expect(provider?.authHeader).toBe(true);
    expect(provider?.compat).toEqual({ supportsStrictMode: true });
    expect(modelOverride?.name).toBe("Workspace Qwen");
    expect(modelOverride?.reasoning).toBe(false);
    expect(modelOverride?.cost?.output).toBe(2);
    expect(modelOverride?.headers).toEqual({ "x-model": "1" });
    expect(config.modelProviders.has("api-key-only")).toBe(false);
  });

  test("reports malformed config without throwing", async () => {
    const agentDir = await makeAgentDir();
    await writeFile(join(agentDir, "models.json"), "{");

    const config = await readPiNativeConfig({ agentDir });

    expect(config.authProviders.size).toBe(0);
    expect(config.modelProviders.size).toBe(0);
    expect(config.errors.some((error) => error.includes("Failed to read models.json"))).toBe(true);
  });
});

async function makeAgentDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pi-models-dev-"));
}
