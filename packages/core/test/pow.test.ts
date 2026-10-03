import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { challengeBits, fetchPowChallenge, leadingZeroBits, solvePow } from "../src/pow";

describe("proof-of-work", () => {
  it("counts leading zero bits", () => {
    expect(leadingZeroBits(new Uint8Array([0, 0, 0x80]))).toBe(16);
    expect(leadingZeroBits(new Uint8Array([0x0f]))).toBe(4);
    expect(leadingZeroBits(new Uint8Array([0xff]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
  });

  it("reads the difficulty from the challenge", () => {
    expect(challengeBits("1.abc.0123456789abcdef.13.sig")).toBe(13);
    expect(() => challengeBits("garbage")).toThrow();
  });

  it("finds a nonce whose SHA-256 has enough leading zero bits (same format as fg.js)", async () => {
    const challenge = "1.lzx1abc.0123456789abcdef.13.0123456789abcdef0123456789abcdef";
    const solved = await solvePow(challenge);
    const [ch, nonce] = solved.split("~");
    expect(ch).toBe(challenge);
    const digest = createHash("sha256").update(`${challenge}:${nonce}`).digest();
    expect(leadingZeroBits(new Uint8Array(digest))).toBeGreaterThanOrEqual(13);
  });

  it("gives up with \"na\" past maxNonce", async () => {
    expect(await solvePow("1.a.b.30.c", { maxNonce: 256 })).toBe("na");
  });

  it("fetches a challenge for the access key", async () => {
    const fetch = vi.fn(async () => new Response("1.a.b.13.c\n")) as unknown as typeof globalThis.fetch;
    expect(await fetchPowChallenge("fk_abc12345", { fetch, baseUrl: "https://example.test/" })).toBe("1.a.b.13.c");
    expect(fetch).toHaveBeenCalledWith("https://example.test/pow?k=fk_abc12345", expect.anything());
  });
});
