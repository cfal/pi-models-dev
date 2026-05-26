import type { Model, OpenAICompletionsCompat } from "@earendil-works/pi-ai";
import type { ModelsDevProvider } from "./models-dev.js";

export type PiModelCompat = Model<any>["compat"];

const genericOpenAICompat = {
  maxTokensField: "max_tokens",
  supportsDeveloperRole: false,
  supportsStore: false,
  supportsStrictMode: false
} satisfies OpenAICompletionsCompat;

export function getProviderCompat(provider: ModelsDevProvider): PiModelCompat {
  switch (provider.id) {
    case "alibaba":
    case "alibaba-cn":
      return {
        ...genericOpenAICompat,
        thinkingFormat: "qwen"
      };

    case "deepseek":
      return {
        ...genericOpenAICompat,
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek"
      };

    case "openrouter":
      return {
        thinkingFormat: "openrouter"
      };

    case "together":
    case "togetherai":
      return {
        ...genericOpenAICompat,
        thinkingFormat: "together"
      };

    case "zai":
      return {
        ...genericOpenAICompat,
        thinkingFormat: "zai"
      };

    default:
      if (provider.npm === "@ai-sdk/openai-compatible") return genericOpenAICompat;
      return undefined;
  }
}
