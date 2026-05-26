import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadModelsDevCatalog, type FetchLike } from "../src/catalog.js";
import { makeRuntimeOptions } from "./fixtures.js";
import { makeCatalog } from "./fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("loadModelsDevCatalog", () => {
  test("fetches, validates, and caches the catalog", async () => {
    const cacheDir = await makeTempDir();
    const catalog = makeCatalog();
    const fetchCalls: RequestInit[] = [];
    const fetchImpl: FetchLike = async (_input, init) => {
      fetchCalls.push(init ?? {});
      return jsonResponse(catalog, { etag: "\"abc\"" });
    };

    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir } }).catalog,
      { fetch: fetchImpl, now: () => 100 }
    );

    expect(result).toEqual(catalog);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].headers).toEqual({});
    expect(JSON.parse(await readFile(join(cacheDir, "api.json"), "utf8"))).toEqual(catalog);
    expect(JSON.parse(await readFile(join(cacheDir, "metadata.json"), "utf8"))).toEqual({
      etag: "\"abc\"",
      fetchedAt: 100,
      sourceUrl: "https://models.dev/api.json"
    });
  });

  test("uses fresh cache without fetching", async () => {
    const cacheDir = await makeTempDir();
    const catalog = makeCatalog();
    await writeCache(cacheDir, catalog, {
      etag: "\"abc\"",
      fetchedAt: 100,
      sourceUrl: "https://models.dev/api.json"
    });

    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir, cacheTtlMs: 1_000 } }).catalog,
      {
        fetch: async () => {
          throw new Error("fetch should not run");
        },
        now: () => 200
      }
    );

    expect(result).toEqual(catalog);
  });

  test("sends ETag for stale cache and reuses cache on not modified", async () => {
    const cacheDir = await makeTempDir();
    const catalog = makeCatalog();
    await writeCache(cacheDir, catalog, {
      etag: "\"abc\"",
      fetchedAt: 100,
      sourceUrl: "https://models.dev/api.json"
    });

    const fetchCalls: RequestInit[] = [];
    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir, cacheTtlMs: 50 } }).catalog,
      {
        fetch: async (_input, init) => {
          fetchCalls.push(init ?? {});
          return new Response(null, { status: 304 });
        },
        now: () => 200
      }
    );

    expect(result).toEqual(catalog);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].headers).toEqual({ "If-None-Match": "\"abc\"" });
    expect(JSON.parse(await readFile(join(cacheDir, "metadata.json"), "utf8")).fetchedAt).toBe(200);
  });

  test("falls back to stale cache on fetch failure", async () => {
    const cacheDir = await makeTempDir();
    const catalog = makeCatalog();
    await writeCache(cacheDir, catalog, {
      fetchedAt: 100,
      sourceUrl: "https://models.dev/api.json"
    });

    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir, cacheTtlMs: 50 } }).catalog,
      {
        fetch: async () => {
          throw new Error("network unavailable");
        },
        now: () => 200
      }
    );

    expect(result).toEqual(catalog);
  });

  test("returns an empty catalog when offline without cache", async () => {
    const cacheDir = await makeTempDir();
    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir, offline: true } }).catalog,
      {
        fetch: async () => {
          throw new Error("fetch should not run");
        }
      }
    );

    expect(result).toEqual({});
  });

  test("returns an empty catalog on invalid payload without cache", async () => {
    const cacheDir = await makeTempDir();
    const result = await loadModelsDevCatalog(
      makeRuntimeOptions({ catalog: { cacheDir } }).catalog,
      {
        fetch: async () => jsonResponse({ invalid: true })
      }
    );

    expect(result).toEqual({});
  });
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pi-models-dev-"));
  tempDirs.push(dir);
  return dir;
}

async function writeCache(
  cacheDir: string,
  catalog: unknown,
  metadata: { etag?: string; fetchedAt: number; sourceUrl: string }
): Promise<void> {
  await writeFile(join(cacheDir, "api.json"), `${JSON.stringify(catalog)}\n`, "utf8");
  await writeFile(join(cacheDir, "metadata.json"), `${JSON.stringify(metadata)}\n`, "utf8");
}

function jsonResponse(value: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      "content-type": "application/json",
      ...headers
    }
  });
}
