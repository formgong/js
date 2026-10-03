/**
 * Proof-of-work used by Formgong's anti-spam (same algorithm as https://formgong.com/fg.js).
 * GET /pow?k=<access_key> returns `1.<ts36>.<rand>.<bits>.<sig>`; the client finds a decimal
 * nonce n so that SHA-256(`${challenge}:${n}`) starts with at least `bits` zero bits.
 * Submitted as `_fg_pow = "<challenge>~<nonce>"`.
 */

const BATCH = 128;
export const POW_MAX_NONCE = 1_000_000;

type Subtle = { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };

function subtle(): Subtle | undefined {
  const c = (globalThis as { crypto?: { subtle?: Subtle } }).crypto;
  return c && c.subtle ? c.subtle : undefined;
}

/** True when Web Crypto is available (browsers on https, Node 18+, Deno, Bun, Workers). */
export function powSupported(): boolean {
  return subtle() !== undefined;
}

export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) { bits += 8; continue; }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** Difficulty encoded in a challenge (4th dot-separated part). */
export function challengeBits(challenge: string): number {
  const bits = Number(challenge.split(".")[3]);
  if (!Number.isInteger(bits) || bits < 1 || bits > 32) throw new Error("Invalid Formgong proof-of-work challenge");
  return bits;
}

/**
 * Solve a challenge. Returns `"<challenge>~<nonce>"`, or `"na"` when Web Crypto is missing
 * or no nonce was found below `maxNonce` (the server treats "na" as neutral).
 */
export async function solvePow(challenge: string, options: { maxNonce?: number; signal?: AbortSignal } = {}): Promise<string> {
  const api = subtle();
  if (!api) return "na";
  const bits = challengeBits(challenge);
  const max = options.maxNonce ?? POW_MAX_NONCE;
  const encoder = new TextEncoder();
  for (let n = 0; n < max; n += BATCH) {
    if (options.signal?.aborted) throw options.signal.reason ?? new Error("aborted");
    const batch: Promise<ArrayBuffer>[] = [];
    for (let j = 0; j < BATCH; j++) batch.push(api.digest("SHA-256", encoder.encode(`${challenge}:${n + j}`)));
    const hashes = await Promise.all(batch);
    for (let j = 0; j < BATCH; j++) {
      if (leadingZeroBits(new Uint8Array(hashes[j] as ArrayBuffer)) >= bits) return `${challenge}~${n + j}`;
    }
  }
  return "na";
}

/** Fetch a fresh challenge for an access key. */
export async function fetchPowChallenge(accessKey: string, options: { baseUrl?: string; fetch?: typeof fetch; signal?: AbortSignal } = {}): Promise<string> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = `${(options.baseUrl ?? "https://formgong.com").replace(/\/+$/, "")}/pow?k=${encodeURIComponent(accessKey)}`;
  const response = await doFetch(url, { signal: options.signal });
  if (!response.ok) throw new Error(`Formgong /pow returned HTTP ${response.status}`);
  return (await response.text()).trim();
}
