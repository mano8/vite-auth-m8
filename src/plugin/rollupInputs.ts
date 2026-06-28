import path from "node:path";
import type { NormalizedFaAuthM8ExtensionConfig } from "./types.js";

export type RollupInputRecord = Record<string, string>;

function isStringRecord(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function resolveEntry(root: string, entry: string): string {
  return path.isAbsolute(entry) ? entry : path.resolve(root, entry);
}

export function buildRollupInputs(root: string, config: NormalizedFaAuthM8ExtensionConfig): RollupInputRecord {
  return {
    popup: resolveEntry(root, config.entries.popup),
    oauthCallback: resolveEntry(root, config.entries.oauthCallback),
    background: resolveEntry(root, config.entries.background)
  };
}

export function mergeRollupInputs(existing: unknown, injected: RollupInputRecord): RollupInputRecord {
  if (existing === undefined || existing === null) {
    return injected;
  }
  if (typeof existing === "string") {
    return { app: existing, ...injected };
  }
  if (Array.isArray(existing) && existing.every((entry) => typeof entry === "string")) {
    const existingEntries = Object.fromEntries(existing.map((entry, index) => [`app${index + 1}`, entry]));
    return { ...existingEntries, ...injected };
  }
  if (isStringRecord(existing)) {
    return { ...existing, ...injected };
  }
  throw new Error("build.rollupOptions.input must be a string, string array, or string record.");
}
