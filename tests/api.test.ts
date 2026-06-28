import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithPassword } from "../src/runtime/api/auth.js";
import { verifyApiKey } from "../src/runtime/api/apiKeys.js";
import { getGoogleLoginUrl } from "../src/runtime/api/oauth.js";
import { getCurrentProfile } from "../src/runtime/api/profile.js";
import { configureFaAuthM8Extension } from "../src/runtime/config.js";
import { storeAuthData } from "../src/runtime/tokenStore.js";
import { MemoryStorageDriver } from "./testStorage.js";

const apiKeyResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "extension-key",
  expires_at: null,
  revoked: false,
  last_used_at: null
};

const profileResponse = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "reader@example.com",
  provider: "password",
  full_name: null,
  avatar: null,
  is_active: true,
  email_verified: false,
  is_superuser: false,
  role: "reader"
};

describe("API helpers", () => {
  let storage: MemoryStorageDriver;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new MemoryStorageDriver();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user/",
      storage,
      fetch: fetchMock,
      now: () => 1,
      randomUUID: () => "uuid"
    });
  });

  it("builds Google login URL requests with encoded query params", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://accounts.google.com/auth" }), { status: 200 }));
    await expect(getGoogleLoginUrl({
      redirect_target: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/oauth-callback.html",
      code_challenge: "challenge"
    })).resolves.toEqual({ url: "https://accounts.google.com/auth" });
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.pathname).toBe("/user/google-api/login-url/");
    expect(url.searchParams.get("code_challenge")).toBe("challenge");
  });

  it("posts password form login and persists the bearer token", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "jwt" }), { status: 200 }));
    await expect(loginWithPassword("reader@example.com", "password")).resolves.toEqual({
      access_token: "jwt",
      token_type: "bearer"
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("username")).toBe("reader@example.com");
    expect(storage.local.data.auth).toMatchObject({ accessToken: "jwt", tokenType: "bearer" });
  });

  it("verifies API keys with the X-API-Key header", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(apiKeyResponse), { status: 200 }));
    await expect(verifyApiKey("secret-key")).resolves.toEqual(apiKeyResponse);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)["X-API-Key"]).toBe("secret-key");
  });

  it("fetches the current profile through authFetch", async () => {
    await storeAuthData("jwt", 100_000, { name: "Reader", email: "reader@example.com", avatar: "" }, "bearer");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(profileResponse), { status: 200 }));
    await expect(getCurrentProfile()).resolves.toEqual(profileResponse);
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Headers).get("Authorization")).toBe("Bearer jwt");
  });

  it("surfaces backend errors from failed requests", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "Nope" }), { status: 400 }));
    await expect(verifyApiKey("bad-key")).rejects.toThrow("Nope");
    fetchMock.mockResolvedValueOnce(new Response("not-json", { status: 500 }));
    await expect(verifyApiKey("bad-key")).rejects.toThrow("HTTP 500");
  });
});
