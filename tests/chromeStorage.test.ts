import { afterEach, describe, expect, it, vi } from "vitest";
import { createChromeStorageDriver, getGlobalChromeStorageDriver, type ChromeLikeApi, type StorageChangeListener } from "../src/runtime/chrome/storage.js";

function makeChromeApi(): ChromeLikeApi & { localData: Record<string, unknown>; sessionData: Record<string, unknown>; listeners: Set<StorageChangeListener> } {
  const localData: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};
  const listeners = new Set<StorageChangeListener>();

  function area(data: Record<string, unknown>) {
    return {
      get(keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void {
        if (typeof keys === "string") {
          callback({ [keys]: data[keys] });
          return;
        }
        if (Array.isArray(keys)) {
          callback(Object.fromEntries(keys.map((key) => [key, data[key]])));
          return;
        }
        if (keys && typeof keys === "object") {
          callback(Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, data[key] ?? fallback])));
          return;
        }
        callback({ ...data });
      },
      set(items: Record<string, unknown>, callback?: () => void): void {
        Object.assign(data, items);
        callback?.();
      },
      remove(keys: string | string[], callback?: () => void): void {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete data[key];
        }
        callback?.();
      }
    };
  }

  return {
    localData,
    sessionData,
    listeners,
    storage: {
      local: area(localData),
      session: area(sessionData),
      onChanged: {
        addListener(listener: StorageChangeListener): void {
          listeners.add(listener);
        },
        removeListener(listener: StorageChangeListener): void {
          listeners.delete(listener);
        }
      }
    }
  };
}

describe("Chrome storage adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wraps callback-based Chrome storage areas", async () => {
    const chromeApi = makeChromeApi();
    const storage = createChromeStorageDriver(chromeApi);
    const listener = vi.fn();

    await storage.local.set({ one: 1, two: 2 });
    expect(await storage.local.get("one")).toEqual({ one: 1 });
    expect(await storage.local.get(["one", "two"])).toEqual({ one: 1, two: 2 });
    expect(await storage.local.get({ one: 0, missing: "fallback" })).toEqual({ one: 1, missing: "fallback" });
    expect(await storage.local.get(null)).toEqual({ one: 1, two: 2 });
    await storage.local.remove(["one"]);
    expect(chromeApi.localData.one).toBeUndefined();

    await storage.session.set({ flow: "verifier" });
    expect(chromeApi.sessionData.flow).toBe("verifier");

    storage.addChangeListener?.(listener);
    expect(chromeApi.listeners.has(listener)).toBe(true);
    storage.removeChangeListener?.(listener);
    expect(chromeApi.listeners.has(listener)).toBe(false);
  });

  it("uses global chrome storage when available and throws when absent", async () => {
    const chromeApi = makeChromeApi();
    vi.stubGlobal("chrome", chromeApi);
    const storage = getGlobalChromeStorageDriver();
    await storage.local.set({ token: "value" });
    expect(chromeApi.localData.token).toBe("value");

    vi.stubGlobal("chrome", undefined);
    expect(() => getGlobalChromeStorageDriver()).toThrow("Chrome storage is unavailable");
  });
});
