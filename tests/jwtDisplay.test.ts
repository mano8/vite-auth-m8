import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "../src/runtime/jwtDisplay.js";

function tokenWithPayload(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

describe("JWT display parsing", () => {
  it("decodes payloads only for display", () => {
    expect(decodeJwtPayload(tokenWithPayload({ sub: "123", role: "reader" }))).toEqual({ sub: "123", role: "reader" });
  });

  it("rejects invalid, oversized, and non-object payloads", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("a.".concat("x".repeat(4097), ".b"))).toBeNull();
    expect(decodeJwtPayload(tokenWithPayload(["array"]))).toBeNull();
    expect(decodeJwtPayload("a.not-base64.b")).toBeNull();
  });
});
