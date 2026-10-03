/**
 * @formgong/core: tiny, dependency-free client for https://formgong.com/submit.
 * Works in browsers, Node 18+, Deno, Bun, Cloudflare Workers and other edge runtimes.
 */
import { FormgongError, type FormgongErrorCode } from "./errors.js";
import type { FormgongTracker } from "./tracker.js";

export { FormgongError, isFormgongError, type FormgongErrorCode } from "./errors.js";
export { createTracker, type FormgongTracker, type SpamSignals, type TrackerOptions } from "./tracker.js";
export { solvePow, fetchPowChallenge, leadingZeroBits, challengeBits, powSupported, POW_MAX_NONCE } from "./pow.js";

export const VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://formgong.com";
export const DEFAULT_ENDPOINT = `${DEFAULT_BASE_URL}/submit`;
/** Honeypot field names Formgong understands. Keep them empty and hidden from people. */
export const HONEYPOT_FIELDS = ["botcheck", "_honeypot"] as const;
/** Languages for Formgong's messages and autoreplies. */
export const LANGS = ["en", "uk", "pl", "tr", "de", "es", "fr", "pt", "ar", "he", "hi", "ja"] as const;
export type FormgongLang = (typeof LANGS)[number];

export type FieldValue = string | number | boolean | null | undefined | Blob | ReadonlyArray<string | number | boolean>;
/** What you can submit: a plain object, FormData, URLSearchParams or an HTML <form> element. */
export type SubmitData = Record<string, FieldValue> | FormData | URLSearchParams | HTMLFormElementLike;
export type HTMLFormElementLike = { tagName: string; elements: unknown; querySelector?: unknown };

export type SubmitOptions = {
  /** Full submit URL. Default https://formgong.com/submit. */
  endpoint?: string;
  /** Visitor language (en, uk, pl, tr, de, es, fr, pt, ar, he, hi, ja). In browsers defaults to <html lang>. */
  lang?: FormgongLang | (string & {});
  /** Email subject for this submission (`_subject`). */
  subject?: string;
  /** Reply-To address for the notification email (`_replyto`). Defaults to the `email` field server-side. */
  replyTo?: string;
  /** Sender name shown in the notification email (`_from_name`). */
  fromName?: string;
  /** Cloudflare Turnstile token, if the form has Turnstile enabled. */
  turnstileToken?: string;
  /** Browser anti-spam tracker from `createTracker()`. Adds `_fg_b` + `_fg_pow`, exactly like fg.js. */
  tracker?: FormgongTracker;
  /**
   * What to do when a honeypot field (`botcheck`, `_honeypot`) is filled in:
   * "send" (default) lets Formgong file it as spam; "drop" resolves locally without a request.
   */
  honeypot?: "send" | "drop";
  /** Server-side only: Origin to send, for forms restricted to allowed domains. */
  origin?: string;
  headers?: Record<string, string>;
  /** Custom fetch (tests, proxies). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Abort after this many ms. Default 15000. Set 0 to disable. */
  timeoutMs?: number;
};

export type SubmitResult = {
  success: true;
  /** Submission id ("" when dropped locally by the honeypot). */
  id: string;
  /** Language Formgong used for the visitor. */
  lang?: string;
  /** Localized success message, ready to show. */
  message: string;
  /** True when the honeypot was filled and `honeypot: "drop"` skipped the request. */
  dropped?: boolean;
  [extra: string]: unknown;
};

type Json = Record<string, unknown>;

/** Origin of a submit URL, used for /pow: "https://formgong.com/submit" -> "https://formgong.com". */
export function baseUrlFromEndpoint(endpoint?: string): string {
  if (!endpoint) return DEFAULT_BASE_URL;
  try {
    return new URL(endpoint).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function isFormElement(data: unknown): data is HTMLFormElementLike {
  return typeof data === "object" && data !== null && "elements" in data && String((data as { tagName?: unknown }).tagName).toUpperCase() === "FORM";
}

function browserLang(): string | undefined {
  const doc = (globalThis as { document?: { documentElement?: { lang?: string } } }).document;
  const lang = doc?.documentElement?.lang?.trim();
  return lang || undefined;
}

function flatten(value: FieldValue): string | Blob | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(String).join(", ");
  return String(value);
}

/** Normalised body: either flat string fields (sent as JSON) or FormData (multipart, needed for files). */
function toBody(data: SubmitData): { fields: Map<string, string>; form?: FormData } {
  if (typeof FormData !== "undefined" && data instanceof FormData) return { fields: new Map(), form: data };
  if (isFormElement(data)) return { fields: new Map(), form: new FormData(data as unknown as HTMLFormElement) };
  const fields = new Map<string, string>();
  if (typeof URLSearchParams !== "undefined" && data instanceof URLSearchParams) {
    for (const [k, v] of data) fields.set(k, fields.has(k) ? `${fields.get(k)}, ${v}` : v);
    return { fields };
  }
  let form: FormData | undefined;
  for (const [k, raw] of Object.entries(data as Record<string, FieldValue>)) {
    const v = flatten(raw);
    if (v === undefined) continue;
    if (typeof v !== "string") {
      form ??= new FormData();
      form.append(k, v);
    } else fields.set(k, v);
  }
  if (form) { for (const [k, v] of fields) form.append(k, v); return { fields: new Map(), form }; }
  return { fields };
}

function readField(body: { fields: Map<string, string>; form?: FormData }, name: string): string {
  const value = body.form ? body.form.get(name) : body.fields.get(name);
  return typeof value === "string" ? value : "";
}

function setField(body: { fields: Map<string, string>; form?: FormData }, name: string, value: string): void {
  if (body.form) body.form.set(name, value);
  else body.fields.set(name, value);
}

/** True when a honeypot field is filled in, i.e. the sender is most likely a bot. */
export function honeypotTriggered(data: SubmitData): boolean {
  const body = toBody(data);
  return HONEYPOT_FIELDS.some((name) => readField(body, name).trim() !== "");
}

/**
 * Send a submission to Formgong. Resolves with the success payload or throws `FormgongError`
 * with a stable `code` (e.g. `unknown_access_key`, `rate_limited`, `turnstile_missing`).
 *
 * ```ts
 * await submit("fk_...", { name: "Ada", email: "ada@example.com", message: "Hi" });
 * ```
 */
export async function submit(accessKey: string, data: SubmitData, options: SubmitOptions = {}): Promise<SubmitResult> {
  const key = typeof accessKey === "string" ? accessKey.trim() : "";
  if (!key) throw new FormgongError("missing_access_key", "Formgong access key is missing. Copy it (fk_…) from https://formgong.com/dashboard.");
  const body = toBody(data);
  // Copy FormData so the caller's object is untouched.
  if (body.form && (data instanceof FormData)) {
    const copy = new FormData();
    for (const [k, v] of body.form) copy.append(k, v);
    body.form = copy;
  }

  if (options.honeypot === "drop" && HONEYPOT_FIELDS.some((name) => readField(body, name).trim() !== "")) {
    return { success: true, id: "", message: "", dropped: true };
  }

  setField(body, "access_key", key);
  const lang = options.lang ?? (readField(body, "_lang") || browserLang());
  if (lang) setField(body, "_lang", lang);
  if (options.subject) setField(body, "_subject", options.subject);
  if (options.replyTo) setField(body, "_replyto", options.replyTo);
  if (options.fromName) setField(body, "_from_name", options.fromName);
  if (options.turnstileToken) setField(body, "cf-turnstile-response", options.turnstileToken);
  if (options.tracker) {
    const signals = await options.tracker.signals();
    setField(body, "_fg_b", signals._fg_b);
    setField(body, "_fg_pow", signals._fg_pow);
  }

  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.origin) headers.Origin = options.origin;
  let payload: BodyInit;
  if (body.form) payload = body.form;
  else {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(Object.fromEntries(body.fields));
  }

  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new FormgongError("network_error", "fetch is not available in this runtime. Pass options.fetch.");
  const timeoutMs = options.timeoutMs ?? 15_000;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const onAbort = () => controller?.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) throw new FormgongError("aborted", "The submission was aborted.");
    options.signal.addEventListener("abort", onAbort, { once: true });
  }
  let timedOut = false;
  const timer = timeoutMs > 0 && controller ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs) : undefined;

  let response: Response;
  try {
    response = await doFetch(options.endpoint ?? DEFAULT_ENDPOINT, { method: "POST", headers, body: payload, signal: controller?.signal });
  } catch (error) {
    if (timedOut) throw new FormgongError("timeout", `Formgong did not answer within ${timeoutMs} ms.`, 0, undefined, { cause: error });
    if (options.signal?.aborted) throw new FormgongError("aborted", "The submission was aborted.", 0, undefined, { cause: error });
    throw new FormgongError("network_error", "Network error. Check your connection and try again.", 0, undefined, { cause: error });
  } finally {
    if (timer) clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }

  let json: Json | undefined;
  try {
    json = (await response.json()) as Json;
  } catch {
    json = undefined;
  }
  if (!json || typeof json !== "object") {
    throw new FormgongError("invalid_response", `Unexpected response from Formgong (HTTP ${response.status}).`, response.status);
  }
  if (json.success === true && response.ok) {
    return { ...json, success: true, id: String(json.id ?? ""), message: String(json.message ?? "") } as SubmitResult;
  }
  const code = (typeof json.code === "string" && json.code) || (typeof json.error === "string" && /^[a-z_]+$/.test(json.error) ? json.error : "unknown_error");
  const message = (typeof json.message === "string" && json.message) || `Something went wrong (HTTP ${response.status}). Please try again.`;
  throw new FormgongError(code as FormgongErrorCode, message, response.status, json);
}

export type FormgongClient = {
  readonly accessKey: string;
  submit(data: SubmitData, options?: SubmitOptions): Promise<SubmitResult>;
};

/** Bind an access key and default options once, then call `client.submit(data)`. */
export function createClient(accessKey: string, defaults: SubmitOptions = {}): FormgongClient {
  return {
    accessKey,
    submit: (data, options) => submit(accessKey, data, { ...defaults, ...options, headers: { ...defaults.headers, ...options?.headers } }),
  };
}

/** Non-throwing variant: `{ ok: true, result }` or `{ ok: false, error }`. Handy in UI state machines. */
export async function trySubmit(accessKey: string, data: SubmitData, options?: SubmitOptions): Promise<{ ok: true; result: SubmitResult } | { ok: false; error: FormgongError }> {
  try {
    return { ok: true, result: await submit(accessKey, data, options) };
  } catch (error) {
    if (error instanceof FormgongError) return { ok: false, error };
    return { ok: false, error: new FormgongError("unknown_error", error instanceof Error ? error.message : String(error), 0, undefined, { cause: error }) };
  }
}
