import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadModelsDevCatalog } from "./catalog.js";
import { readRuntimeOptions } from "./config.js";
import { createLogger, summarizeStats } from "./logging.js";
import { readPiNativeConfig } from "./pi-config.js";
import { buildProviderRegistrations } from "./providers.js";

export default async function modelsDevExtension(pi: ExtensionAPI): Promise<void> {
  const options = readRuntimeOptions(process.env);
  const logger = createLogger(options.debug);

  if (!options.enabled) {
    logger.debug("extension disabled");
    return;
  }

  const catalog = await loadModelsDevCatalog(options.catalog);
  const piConfig = await readPiNativeConfig();
  for (const error of piConfig.errors) {
    logger.debug(error);
  }
  const result = buildProviderRegistrations(catalog, options, piConfig);

  for (const registration of result.registrations) {
    pi.registerProvider(registration.providerId, registration.config);
  }

  logger.debug(summarizeStats(result.stats));
}
