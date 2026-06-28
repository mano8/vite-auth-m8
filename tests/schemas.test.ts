import { describe, expect, it } from "vitest";
import {
  ApiKeyPublicSchema,
  AuthStorageSchema,
  GoogleExchangeResponseSchema,
  GoogleLoginUrlResponseSchema,
  TokenSchema,
  UserPublicSchema,
  parseAuthStorage
} from "../src/runtime/schemas.js";

describe("runtime schemas", () => {
  it("validates extension endpoint responses strictly", () => {
    expect(GoogleLoginUrlResponseSchema.parse({ url: "https://accounts.google.com/o/oauth2/v2/auth" })).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth"
    });
    expect(() => GoogleLoginUrlResponseSchema.parse({ url: "nope" })).toThrow();
    expect(() => GoogleLoginUrlResponseSchema.parse({ url: "https://example.com", extra: true })).toThrow();

    const exchange = GoogleExchangeResponseSchema.parse({
      version: 1,
      auth_provider: "google",
      access_token: "header.payload.signature",
      expires_at: 1_800_000,
      user: { name: "M8", email: "m8@example.com", avatar: "https://example.com/avatar.png" }
    });
    expect(exchange.user.email).toBe("m8@example.com");
    expect(() => GoogleExchangeResponseSchema.parse({ ...exchange, auth_provider: "password" })).toThrow();
  });

  it("validates auth, profile, token, and API key contract shapes", () => {
    expect(TokenSchema.parse({ access_token: "token" }).token_type).toBe("bearer");
    expect(UserPublicSchema.parse({
      id: "00000000-0000-4000-8000-000000000000",
      email: "reader@example.com"
    }).role).toBe("user");
    expect(ApiKeyPublicSchema.parse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "default-key",
      expires_at: null
    }).last_used_at).toBeNull();
  });

  it("parses persisted extension auth state", () => {
    const storage = {
      auth: {
        accessToken: "token",
        expiresAt: 10,
        sessionId: "session",
        tokenType: "bearer",
        loginTimestamp: 1
      },
      user: { name: "User", email: "user@example.com", avatar: "" }
    };
    expect(AuthStorageSchema.parse(storage)).toEqual(storage);
    expect(parseAuthStorage(storage)).toEqual(storage);
    expect(parseAuthStorage({ ...storage, auth: { ...storage.auth, tokenType: "cookie" } })).toBeNull();
  });
});
