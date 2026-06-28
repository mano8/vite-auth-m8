import { getGlobalChromeStorageDriver, type StorageDriver } from "./chrome/storage.js";

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface RuntimeConfig {
  apiBase: string;
  storage?: StorageDriver;
  fetch?: FetchLike;
  now?: () => number;
  randomUUID?: () => string;
}

let runtimeConfig: RuntimeConfig | null = null;

function normalizeApiBase(apiBase: string): string {
  const url = new URL(apiBase);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("apiBase must use http: or https:.");
  }
  return url.toString().replace(/\/$/, "");
}

export function configureFaAuthM8Extension(config: RuntimeConfig): RuntimeConfig {
  runtimeConfig = {
    ...config,
    apiBase: normalizeApiBase(config.apiBase)
  };
  return runtimeConfig;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    throw new Error("Call configureFaAuthM8Extension() before using runtime APIs.");
  }
  return runtimeConfig;
}

export function getConfiguredFetch(): FetchLike {
  return getRuntimeConfig().fetch ?? fetch;
}

export function getConfiguredStorage(): StorageDriver {
  return getRuntimeConfig().storage ?? getGlobalChromeStorageDriver();
}

export function getConfiguredNow(): () => number {
  return getRuntimeConfig().now ?? Date.now;
}

export function getConfiguredRandomUUID(): () => string {
  return getRuntimeConfig().randomUUID ?? crypto.randomUUID.bind(crypto);
}

export function buildApiUrl(path: string): string {
  const config = getRuntimeConfig();
  const relativePath = path.replace(/^\/+/, "");
  return new URL(relativePath, `${config.apiBase}/`).toString();
}
