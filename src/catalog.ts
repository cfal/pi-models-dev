import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CatalogOptions } from "./config.js";
import { isModelsDevCatalog, type ModelsDevCatalog } from "./models-dev.js";

export interface CatalogLoaderDependencies {
  fetch?: FetchLike;
  now?: () => number;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

interface CacheMetadata {
  etag?: string;
  fetchedAt: number;
  sourceUrl: string;
}

interface CachePaths {
  catalogFile: string;
  metadataFile: string;
}

interface CatalogCache {
  catalog: ModelsDevCatalog | null;
  metadata: CacheMetadata | null;
}

type FetchResult = { status: "ok"; catalog: ModelsDevCatalog; etag?: string } | { status: "not-modified" };

export async function loadModelsDevCatalog(
  options: CatalogOptions,
  dependencies: CatalogLoaderDependencies = {}
): Promise<ModelsDevCatalog> {
  const paths = getCachePaths(options.cacheDir);
  const now = dependencies.now ?? Date.now;
  const cache = await readCache(paths);

  if (options.offline) {
    return cache.catalog ?? {};
  }

  if (isFreshCache(cache, options, now())) {
    return cache.catalog ?? {};
  }

  try {
    const fetched = await fetchCatalog(options, cache.metadata, dependencies.fetch ?? fetch);

    if (fetched.status === "not-modified") {
      if (!cache.catalog) return {};
      await writeMetadata(paths, {
        fetchedAt: now(),
        sourceUrl: options.sourceUrl,
        etag: cache.metadata?.etag
      });
      return cache.catalog;
    }

    const metadata = {
      fetchedAt: now(),
      sourceUrl: options.sourceUrl,
      etag: fetched.etag
    };
    await writeCache(paths, fetched.catalog, metadata);
    return fetched.catalog;
  } catch {
    return cache.catalog ?? {};
  }
}

function getCachePaths(cacheDir: string | undefined): CachePaths {
  const resolvedCacheDir = cacheDir ?? join(getAgentDir(), "cache", "models-dev");
  return {
    catalogFile: join(resolvedCacheDir, "api.json"),
    metadataFile: join(resolvedCacheDir, "metadata.json")
  };
}

function isFreshCache(cache: CatalogCache, options: CatalogOptions, now: number): boolean {
  if (!cache.catalog || !cache.metadata) return false;
  if (cache.metadata.sourceUrl !== options.sourceUrl) return false;
  return now - cache.metadata.fetchedAt < options.cacheTtlMs;
}

async function fetchCatalog(
  options: CatalogOptions,
  metadata: CacheMetadata | null,
  fetchImpl: FetchLike
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (metadata?.etag && metadata.sourceUrl === options.sourceUrl) {
      headers["If-None-Match"] = metadata.etag;
    }

    const response = await fetchImpl(options.sourceUrl, {
      headers,
      signal: controller.signal
    });

    if (response.status === 304) {
      return { status: "not-modified" };
    }

    if (!response.ok) {
      throw new Error(`models.dev responded with HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!isModelsDevCatalog(payload)) {
      throw new Error("models.dev response did not match the expected catalog shape");
    }

    return {
      status: "ok",
      catalog: payload,
      etag: response.headers.get("etag") ?? undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readCache(paths: CachePaths): Promise<CatalogCache> {
  const [catalog, metadata] = await Promise.all([readCatalog(paths.catalogFile), readMetadata(paths.metadataFile)]);
  return { catalog, metadata };
}

async function readCatalog(path: string): Promise<ModelsDevCatalog | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return isModelsDevCatalog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readMetadata(path: string): Promise<CacheMetadata | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<CacheMetadata>;
    if (typeof parsed.fetchedAt !== "number" || typeof parsed.sourceUrl !== "string") return null;
    if (parsed.etag !== undefined && typeof parsed.etag !== "string") return null;
    return {
      fetchedAt: parsed.fetchedAt,
      sourceUrl: parsed.sourceUrl,
      etag: parsed.etag
    };
  } catch {
    return null;
  }
}

async function writeCache(paths: CachePaths, catalog: ModelsDevCatalog, metadata: CacheMetadata): Promise<void> {
  await Promise.all([writeJsonAtomic(paths.catalogFile, catalog), writeMetadata(paths, metadata)]);
}

async function writeMetadata(paths: CachePaths, metadata: CacheMetadata): Promise<void> {
  await writeJsonAtomic(paths.metadataFile, metadata);
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, "utf8");
  await rename(temporaryPath, path);
}
