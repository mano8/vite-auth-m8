import { beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "../src/runtime/authFetch.js";
import { configureFaAuthM8Extension } from "../src/runtime/config.js";
import { isFreshAuthState, getAuthState, isSessionExpired, logout, storeAuthData, subscribeAuthState, userProfileFromUnknown } from "../src/runtime/tokenStore.js";
import type { AuthState } from "../src/runtime/schemas.js";
import { MemoryStorageDriver } from "./testStorage.js";

const user = { name: "User", email: "user@example.com", avatar: "" };

function authState(loginTimestamp: number): AuthState {
  return {
    accessToken: `token-${loginTimestamp}`,
    expiresAt: 10_000,
    sessionId: `session-${loginTimestamp}`,
    tokenType: "bearer",
    loginTimestamp
  };
}

describe("runtime auth storage and authFetch", () => {
  let storage: MemoryStorageDriver;
  let fetchMock: ReturnType<typeof vi.fn>;
  let now = 1_000;

  beforeEach(() => {
    storage = new MemoryStorageDriver();
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    now = 1_000;
    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage,
      fetch: fetchMock,
      now: () => now,
      randomUUID: () => "uuid"
    });
  });

  it("stores, reads, subscribes, and clears validated auth state", async () => {
    await storeAuthData("token", 10_000, user, "bearer");
    expect(await getAuthState()).toEqual({
      auth: {
        accessToken: "token",
        expiresAt: 10_000,
        sessionId: "uuid",
        tokenType: "bearer",
        loginTimestamp: 1_000
      },
      user
    });

    const callback = vi.fn();
    const unsubscribe = subscribeAuthState(callback);
    for (const listener of storage.listeners) {
      listener({}, "local");
      listener({ auth: { newValue: storage.local.data.auth } }, "session");
    }
    storage.emitAuthChanged(storage.local.data.auth);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(expect.objectContaining({ user })));
    unsubscribe();

    await logout();
    expect(storage.local.data.auth).toBeUndefined();
    expect(storage.local.data.user).toBeUndefined();
  });

  it("clears invalid stored auth and applies stale-session ordering", async () => {
    await storage.local.set({ auth: { accessToken: "bad" }, user });
    await expect(getAuthState()).resolves.toBeNull();
    expect(storage.local.data.auth).toBeUndefined();
    expect(isFreshAuthState(null, authState(1))).toBe(true);
    expect(isFreshAuthState(authState(2), authState(1))).toBe(false);
    expect(isFreshAuthState(authState(1), authState(2))).toBe(true);
  });

  it("selects bearer and API-key auth headers", async () => {
    await storeAuthData("bearer-token", 100_000, user, "bearer");
    await authFetch("https://api.example.com/data", { headers: { Accept: "application/json" } });
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe("Bearer bearer-token");
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Accept")).toBe("application/json");

    await storeAuthData("api-key", 100_000, user, "apikey");
    await authFetch("https://api.example.com/data");
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Headers).get("X-API-Key")).toBe("api-key");
  });

  it("clears auth on expiry and unauthorized responses", async () => {
    now = 10_000;
    expect(isSessionExpired(authState(1), now)).toBe(true);
    await storeAuthData("expired", 10_000, user, "bearer");
    await expect(authFetch("https://api.example.com/data")).rejects.toThrow("Session expired");
    expect(fetchMock).not.toHaveBeenCalled();

    now = 1_000;
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await storeAuthData("token", 100_000, user, "bearer");
    await authFetch("https://api.example.com/data");
    expect(storage.local.data.auth).toBeUndefined();
  });

  it("normalizes unknown user profiles defensively", () => {
    expect(userProfileFromUnknown({ name: "A", email: "a@example.com", avatar: "x", ignored: true })).toEqual({
      name: "A",
      email: "a@example.com",
      avatar: "x"
    });
    expect(userProfileFromUnknown(null)).toEqual({
      name: "",
      email: "unknown@example.invalid",
      avatar: ""
    });
  });
});
