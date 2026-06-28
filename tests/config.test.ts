import { describe, expect, it, vi } from "vitest";

describe("runtime config defaults", () => {
  it("requires explicit configuration and validates protocols", async () => {
    vi.resetModules();
    const config = await import("../src/runtime/config.js");
    expect(() => config.getRuntimeConfig()).toThrow("configureFaAuthM8Extension");
    expect(() => config.configureFaAuthM8Extension({ apiBase: "ftp://example.com" })).toThrow("apiBase");
  });

  it("falls back to platform fetch, time, randomUUID, and chrome storage", async () => {
    vi.resetModules();
    const chromeApi = {
      storage: {
        local: {
          get(_keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void {
            callback({});
          },
          set(_items: Record<string, unknown>, callback?: () => void): void {
            callback?.();
          },
          remove(_keys: string | string[], callback?: () => void): void {
            callback?.();
          }
        },
        session: {
          get(_keys: string | string[] | Record<string, unknown> | null, callback: (items: Record<string, unknown>) => void): void {
            callback({});
          },
          set(_items: Record<string, unknown>, callback?: () => void): void {
            callback?.();
          },
          remove(_keys: string | string[], callback?: () => void): void {
            callback?.();
          }
        },
        onChanged: {
          addListener(_listener: (changes: Record<string, unknown>, areaName: string) => void): void {},
          removeListener(_listener: (changes: Record<string, unknown>, areaName: string) => void): void {}
        }
      }
    };
    vi.stubGlobal("chrome", chromeApi);
    const config = await import("../src/runtime/config.js");
    config.configureFaAuthM8Extension({ apiBase: "https://example.com/user/" });
    expect(config.getConfiguredFetch()).toBe(fetch);
    expect(config.getConfiguredNow()).toBe(Date.now);
    expect(config.getConfiguredRandomUUID()()).toMatch(/[0-9a-f-]{36}/);
    await expect(config.getConfiguredStorage().local.get("auth")).resolves.toEqual({});
    expect(config.buildApiUrl("profile/get/me/")).toBe("https://example.com/user/profile/get/me/");
    vi.unstubAllGlobals();
  });
});
