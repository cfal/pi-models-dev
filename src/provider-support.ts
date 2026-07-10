import type { Api } from "@earendil-works/pi-ai";
import type { ModelsDevProvider } from "./models-dev.js";

export interface ProviderSupport {
  api: Api;
  defaultBaseUrl?: string;
  enableDeclaredReasoningEffort?: boolean;
}

export const OPENAI_COMPLETIONS_API = "openai-completions" satisfies Api;
export const OPENAI_RESPONSES_API = "openai-responses" satisfies Api;

const PROVIDER_SUPPORT_BY_PACKAGE: Record<string, ProviderSupport> = {
  "@ai-sdk/openai": {
    api: OPENAI_RESPONSES_API,
    defaultBaseUrl: "https://api.openai.com/v1"
  },
  "@ai-sdk/openai-compatible": {
    api: OPENAI_COMPLETIONS_API
  },
  "@openrouter/ai-sdk-provider": {
    api: OPENAI_COMPLETIONS_API
  },
  "@ai-sdk/togetherai": {
    api: OPENAI_COMPLETIONS_API,
    defaultBaseUrl: "https://api.together.ai/v1"
  },
  "@ai-sdk/xai": {
    api: OPENAI_COMPLETIONS_API,
    defaultBaseUrl: "https://api.x.ai/v1",
    enableDeclaredReasoningEffort: true
  }
};

export function getProviderSupport(provider: ModelsDevProvider): ProviderSupport | null {
  return PROVIDER_SUPPORT_BY_PACKAGE[provider.npm] ?? null;
}
