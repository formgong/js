/**
 * Browser-only anti-spam signals, identical to what https://formgong.com/fg.js adds:
 *   _fg_b   = "1.<ms since the form was seen>.<keydowns>.<pastes>.<fields typed into>"
 *   _fg_pow = "<challenge>~<nonce>" | "p" (not solved yet) | "na" (no Web Crypto)
 *
 * Formgong only scores these when `_fg_b` is present, and plain server/SDK posts without it are
 * never penalised. So: use a tracker only for a real form a person is filling in, never fabricate
 * these values on a server.
 */
import { fetchPowChallenge, powSupported, solvePow } from "./pow.js";

type Listener = (event: Event) => void;
type Target = { addEventListener(type: string, fn: Listener, opts?: unknown): void; removeEventListener(type: string, fn: Listener, opts?: unknown): void };

export type TrackerOptions = {
  /** Origin of the Formgong API. Default https://formgong.com. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Start the proof-of-work right away instead of on first interaction. */
  eager?: boolean;
};

export type SpamSignals = { _fg_b: string; _fg_pow: string };

export interface FormgongTracker {
  /** Current signals. Waits up to `waitMs` (default 2000, like fg.js) for the proof-of-work. */
  signals(waitMs?: number): Promise<SpamSignals>;
  /** Start solving now (also happens on focus, pointer, touch or key events). */
  warmUp(): void;
  /** Forget the used proof-of-work after a submission (counters keep running). */
  next(): void;
  /** Remove all listeners. */
  destroy(): void;
}

const TRIGGERS = ["focusin", "pointerdown", "touchstart", "keydown"] as const;

export function createTracker(target: Target, accessKey: string | (() => string), options: TrackerOptions = {}): FormgongTracker {
  const started = Date.now();
  let keys = 0;
  let pastes = 0;
  let typed = 0;
  const seen = new Set<string>();
  let pow = "";
  let pending: Promise<string> | null = null;
  const key = () => (typeof accessKey === "function" ? accessKey() : accessKey).trim();

  const warmUp = () => {
    if (pending) return;
    if (!powSupported()) { pending = Promise.resolve("na"); pending.then((v) => { pow = v; }); return; }
    const current = pending = fetchPowChallenge(key(), { baseUrl: options.baseUrl, fetch: options.fetch })
      .then((challenge) => solvePow(challenge))
      .catch(() => "");
    current.then((value) => { if (pending === current) pow = value; });
  };

  const listeners: Array<[string, Listener]> = [
    ["keydown", () => { keys++; }],
    ["paste", () => { pastes++; }],
    ["input", (event) => {
      const name = `$${(event.target as { name?: string } | null)?.name ?? ""}`;
      if (!seen.has(name)) { seen.add(name); typed++; }
    }],
    ...TRIGGERS.map((type) => [type, warmUp] as [string, Listener]),
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn, { passive: true });
  if (options.eager) warmUp();

  return {
    async signals(waitMs = 2000) {
      let value = pow;
      if (!value && pending) {
        value = (await Promise.race([pending, new Promise<string>((resolve) => setTimeout(() => resolve(""), waitMs))])) || "";
      }
      return { _fg_b: `1.${Date.now() - started}.${keys}.${pastes}.${typed}`, _fg_pow: value || "p" };
    },
    warmUp,
    next() { pow = ""; pending = null; },
    destroy() { for (const [type, fn] of listeners) target.removeEventListener(type, fn); },
  };
}
