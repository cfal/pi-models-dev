import { describe, expect, test } from "bun:test";
import { isModelsDevCatalog } from "../src/models-dev.js";
import { makeCatalog } from "./fixtures.js";

describe("isModelsDevCatalog", () => {
  test("accepts the supported catalog shape", () => {
    expect(isModelsDevCatalog(makeCatalog())).toBe(true);
  });

  test("rejects invalid provider entries", () => {
    expect(
      isModelsDevCatalog({
        "alibaba-cn": {
          id: "different-id",
          name: "Alibaba (China)",
          env: ["DASHSCOPE_API_KEY"],
          npm: "@ai-sdk/openai-compatible",
          models: {}
        }
      })
    ).toBe(false);
  });

  test("rejects invalid model entries", () => {
    const catalog = makeCatalog();
    catalog["alibaba-cn"].models["qwen3.5-flash"] = {
      ...catalog["alibaba-cn"].models["qwen3.5-flash"],
      limit: {
        context: -1,
        output: 65_536
      }
    };

    expect(isModelsDevCatalog(catalog)).toBe(false);
  });
});
