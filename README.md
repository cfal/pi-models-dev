# pi-models-dev

Runtime [models.dev](https://models.dev) provider discovery for Pi.

This Pi package fetches `https://models.dev/api.json` at startup and registers user-enabled OpenAI-compatible providers, without waiting for Pi to ship a newer generated model snapshot.

By default it does not replace Pi built-in providers. Built-ins are replaced only when explicitly named in `PI_MODELS_DEV_OVERRIDE_PROVIDERS`.
Use `PI_MODELS_DEV_OVERRIDE_PROVIDERS=all` to select every supported models.dev provider.

## What Is models.dev?

`models.dev` is the public provider and model catalog used by OpenCode. It contains provider IDs, model IDs, API endpoints, environment variable names, context windows, costs, modality support, and model status.

This extension lets Pi consume that catalog at runtime. To use an OpenCode provider, look up its provider ID on models.dev and use the same ID in Pi config. For example, the OpenCode/models.dev provider ID for GitHub Models is `github-models`, so Pi model IDs become `github-models/openai/gpt-4.1`.

The current extension registers models.dev providers that use OpenAI Responses, OpenAI-compatible, OpenRouter-compatible, or xAI transport. Providers that require a different native SDK are skipped until support is added.

## Install

From GitHub:

```bash
pi install https://github.com/cfal/pi-models-dev
```

Equivalent git source:

```bash
pi install git:github.com/cfal/pi-models-dev
```

Project-local install:

```bash
pi install -l https://github.com/cfal/pi-models-dev
```

Temporary run:

```bash
pi -e https://github.com/cfal/pi-models-dev --list-models
```

Local development checkout:

```bash
git clone https://github.com/cfal/pi-models-dev.git
cd pi-models-dev
bun install
pi install "$PWD"
pi -e "$PWD" --list-models
```

## Quick Start

Enable GitHub Models in `~/.pi/agent/auth.json`:

```json
{
  "github-models": {
    "type": "api_key",
    "key": "GITHUB_TOKEN"
  }
}
```

Set the API key and verify:

```bash
export GITHUB_TOKEN=...
pi --list-models
```

Expected output includes models such as:

```text
github-models  openai/gpt-4.1
```

## Provider Enablement

A provider is registered only when the extension sees user intent:

| Source | Effect |
| --- | --- |
| `auth.json` API key entry | Enables that models.dev provider. |
| `models.json.providers[id]` override entry | Enables that provider and applies endpoint/request/model overrides. |
| `PI_MODELS_DEV_OVERRIDE_PROVIDERS` | Allows selected Pi built-ins to be replaced. |

Environment variables alone do not enable providers. They only satisfy auth after `auth.json`, `models.json`, or the override env var selects the provider. The special override value `all` selects every supported models.dev provider.

Generic OpenCode provider template:

```json
{
  "<models.dev-provider-id>": {
    "type": "api_key",
    "key": "<ENV_VAR_FROM_MODELS_DEV>"
  }
}
```

```bash
export <ENV_VAR_FROM_MODELS_DEV>=...
pi --list-models
```

Use the provider ID exactly as shown on models.dev. After registration, select models in Pi as `<provider-id>/<model-id>`.

Exception: models.dev names Fireworks `fireworks-ai`, but Pi uses `fireworks`. This extension registers models.dev Fireworks models under Pi's `fireworks` provider ID, so use `fireworks` in `auth.json`, `models.json`, and `PI_MODELS_DEV_OVERRIDE_PROVIDERS`.

## API Keys

Preferred shape for `~/.pi/agent/auth.json`:

```json
{
  "github-models": {
    "type": "api_key",
    "key": "GITHUB_TOKEN"
  }
}
```

Then set:

```bash
export GITHUB_TOKEN=...
```

`key` should usually be an environment variable name rather than a literal secret.

You can also put the API key reference in `models.json` when you want all provider config in one file:

```json
{
  "providers": {
    "github-models": {
      "baseUrl": "https://models.github.ai/inference",
      "apiKey": "GITHUB_TOKEN"
    }
  }
}
```

## Custom Base URL

Use `~/.pi/agent/models.json` to override a provider endpoint while still using models.dev model metadata:

```json
{
  "providers": {
    "<models.dev-provider-id>": {
      "baseUrl": "https://your-openai-compatible-endpoint.example/v1"
    }
  }
}
```

Most providers, including GitHub Models, do not need this because models.dev already includes the default endpoint. Use `baseUrl` for workspace-specific gateways, proxies, or regional endpoints.

If the endpoint needs additional request headers:

```json
{
  "providers": {
    "<models.dev-provider-id>": {
      "baseUrl": "https://your-openai-compatible-endpoint.example/v1",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  }
}
```

If the provider expects the resolved key in an explicit bearer header:

```json
{
  "providers": {
    "<models.dev-provider-id>": {
      "baseUrl": "https://your-openai-compatible-endpoint.example/v1",
      "authHeader": true
    }
  }
}
```

## Model Overrides

Provider-level compatibility overrides are merged onto every generated model:

```json
{
  "providers": {
    "github-models": {
      "compat": {
        "supportsStrictMode": false
      }
    }
  }
}
```

Per-model overrides use Pi's `modelOverrides` shape:

```json
{
  "providers": {
    "github-models": {
      "modelOverrides": {
        "openai/gpt-4.1": {
          "name": "GPT-4.1 via GitHub Models",
          "reasoning": true,
          "headers": {
            "X-Model-Route": "default"
          }
        }
      }
    }
  }
}
```

If `models.json.providers[id].models` exists, this extension skips that provider by default so Pi owns the custom model list.

## Built-In Provider Overrides

Pi built-ins carry curated compatibility flags and provider behavior, so the extension skips them by default.

To intentionally replace specific built-ins with models.dev entries:

```bash
PI_MODELS_DEV_OVERRIDE_PROVIDERS=openrouter,deepseek pi --list-models
```

To select every supported models.dev provider:

```bash
PI_MODELS_DEV_OVERRIDE_PROVIDERS=all pi --list-models
```

Use overrides sparingly. They can change model lists and provider quirks for existing Pi providers. The `all` wildcard is broader than built-in replacement: it also selects non-built-in models.dev providers, which can then register when their API key environment variables are present.

For Fireworks, use Pi's built-in provider ID:

```bash
PI_MODELS_DEV_OVERRIDE_PROVIDERS=fireworks pi --list-models
```

## Runtime Options

| Variable | Default | Purpose |
| --- | --- | --- |
| `PI_MODELS_DEV_ENABLED` | `1` | Disable with `0`. |
| `PI_MODELS_DEV_SOURCE_URL` | `https://models.dev/api.json` | Catalog URL. |
| `PI_MODELS_DEV_OVERRIDE_PROVIDERS` | empty | Comma-separated provider IDs to select, or `all` for every supported provider. |
| `PI_MODELS_DEV_INCLUDE_ALPHA` | `0` | Include alpha models. |
| `PI_MODELS_DEV_INCLUDE_BETA` | `1` | Include beta models. |
| `PI_MODELS_DEV_INCLUDE_DEPRECATED` | `0` | Include deprecated models. |
| `PI_MODELS_DEV_MAX_MODELS_PER_PROVIDER` | empty | Optional per-provider model cap. |
| `PI_MODELS_DEV_CACHE_TTL_MS` | `0` | Catalog cache TTL. The default revalidates on every startup. |
| `PI_MODELS_DEV_FETCH_TIMEOUT_MS` | `3000` | Catalog fetch timeout. |
| `PI_MODELS_DEV_CACHE_DIR` | Pi agent cache dir | Override cache directory. |
| `PI_MODELS_DEV_OFFLINE` | `0` | Use cache only. |
| `PI_MODELS_DEV_DEBUG` | `0` | Print startup diagnostics. |

## Cache Behavior

The extension checks models.dev during Pi startup. It caches the catalog under Pi's agent cache directory and revalidates on every startup by default.

If the network fetch fails, stale cache is used when available. If no cache exists, startup continues and the extension registers nothing.

Pi's `PI_OFFLINE` setting does not change this extension's cache policy. Use `PI_MODELS_DEV_OFFLINE=1` when models.dev discovery should be cache-only.

Set `PI_MODELS_DEV_CACHE_TTL_MS` to a positive millisecond value to reuse fresh cache between startup checks. The default `0` still keeps stale-cache fallback and ETag revalidation.

Force cache-only mode:

```bash
PI_MODELS_DEV_OFFLINE=1 pi --list-models
```

Print registration diagnostics:

```bash
PI_MODELS_DEV_DEBUG=1 pi --list-models
```

## Troubleshooting

No provider appears:

- Check that `auth.json` or `models.json` contains the provider ID exactly as models.dev uses it, for example `github-models`.
- Check that the API key environment variable is set in the same shell or service process that starts Pi or Garcon.
- Run `PI_MODELS_DEV_DEBUG=1 pi --list-models`.

Custom endpoint is ignored:

- Put `baseUrl` under `~/.pi/agent/models.json` at `providers.<providerId>.baseUrl`.
- Restart Pi or Garcon after editing config.

Garcon does not show new models:

- Restart the Garcon server, or wait for its Pi model cache to expire.
- Verify first with `pi --list-models`.
