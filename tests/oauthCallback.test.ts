import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleOAuthCallback, readOAuthCallbackUrl, savePkceVerifier, takePkceVerifier } from "../src/runtime/chrome/oauthCallback.js";
import { configureFaAuthM8Extension } from "../src/runtime/config.js";
import { MemoryStorageDriver } from "./testStorage.js";

describe("OAuth callback runtime", () => {
  let storage: MemoryStorageDriver;
  let fetchMock: ReturnType<typeof vi.fn>;
  let order: string[];

  beforeEach(() => {
    storage = new MemoryStorageDriver();
    order = [];
    fetchMock = vi.fn(async () => {
      order.push("fetch");
      return new Response(JSON.stringify({
        version: 1,
        auth_provider: "google",
        access_token: "header.payload.signature",
        expires_at: 123_000,
        user: { name: "OAuth User", email: "oauth@example.com", avatar: "https://example.com/avatar.png" }
      }), { status: 200 });
    });
    configureFaAuthM8Extension({
      apiBase: "https://localhost:4430/user",
      storage,
      fetch: fetchMock,
      now: () => 100,
      randomUUID: () => "session-id"
    });
  });

  it("reads auth_code from the fragment and flow_id from query params", () => {
    expect(readOAuthCallbackUrl(new URL("chrome-extension://id/oauth-callback.html?flow_id=f1#auth_code=c1"))).toEqual({
      authCode: "c1",
      flowId: "f1"
    });
  });

  it("stores and consumes only the matching PKCE verifier", async () => {
    await savePkceVerifier("flow-1", "verifier-1");
    await savePkceVerifier("flow-2", "verifier-2");
    await expect(takePkceVerifier("flow-1")).resolves.toBe("verifier-1");
    await expect(takePkceVerifier("flow-1")).resolves.toBe("");
    await expect(takePkceVerifier("flow-2")).resolves.toBe("verifier-2");
  });

  it("clears the URL before exchanging and stores validated auth state", async () => {
    await savePkceVerifier("flow-1", "verifier-1");
    const result = await handleOAuthCallback({
      url: new URL("chrome-extension://id/oauth-callback.html?flow_id=flow-1#auth_code=code-1"),
      clearUrl: () => order.push("clear-url"),
      closeWindow: () => order.push("close"),
      clientHint: "extension"
    });

    expect(result).toBe(true);
    expect(order).toEqual(["clear-url", "fetch", "close"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://localhost:4430/user/google-api/exchange/");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      code: "code-1",
      code_verifier: "verifier-1",
      client_hint: "extension"
    });
    expect(storage.local.data.auth).toMatchObject({
      accessToken: "header.payload.signature",
      expiresAt: 123_000,
      sessionId: "session-id",
      tokenType: "bearer",
      loginTimestamp: 100
    });
    expect(storage.local.data.user).toEqual({
      name: "OAuth User",
      email: "oauth@example.com",
      avatar: "https://example.com/avatar.png"
    });
  });

  it("closes without exchange when the callback is incomplete or verifier is missing", async () => {
    await expect(handleOAuthCallback({
      url: new URL("chrome-extension://id/oauth-callback.html?flow_id=flow-1"),
      clearUrl: () => order.push("clear-url"),
      closeWindow: () => order.push("close")
    })).resolves.toBe(false);
    expect(order).toEqual(["clear-url", "close"]);

    order = [];
    await expect(handleOAuthCallback({
      url: new URL("chrome-extension://id/oauth-callback.html?flow_id=flow-1#auth_code=code-1"),
      clearUrl: () => order.push("clear-url"),
      closeWindow: () => order.push("close")
    })).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(order).toEqual(["clear-url", "close"]);
  });
});
