import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createPkcePair } from "../src/runtime/pkce.js";

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

describe("PKCE", () => {
  it("creates an RFC 7636 verifier and S256 challenge", async () => {
    const pair = await createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9\-_]{43,128}$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9\-_]{43,128}$/);
    expect(pair.challenge).toBe(base64Url(createHash("sha256").update(pair.verifier).digest()));
  });
});
