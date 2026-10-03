import { computed, signal, type Signal } from "@angular/core";
import {
  FormgongError,
  submit as coreSubmit,
  type FormgongTracker,
  type SubmitData,
  type SubmitOptions,
  type SubmitResult,
} from "@formgong/core";

export type FormgongStatus = "idle" | "submitting" | "success" | "error";

/** Options shared by the service, the directive and the component. */
export interface FormgongOptions {
  /** Public form key (fk_…). Public by design: it only allows sending submissions to this form. */
  accessKey?: string;
  /** Full submit URL. Default https://formgong.com/submit. */
  endpoint?: string;
  /** Visitor language: en, uk, pl, tr, de, es, fr, pt, ar, he, hi, ja. Defaults to <html lang>. */
  lang?: string;
  /** Email subject (`_subject`). */
  subject?: string;
  /** Page to open after a successful submission. */
  redirect?: string;
  /** Anti-spam signals like fg.js (`_fg_b` + proof-of-work) for forms in the browser. Default true. */
  antiSpam?: boolean;
  /** "send" (default) lets Formgong file filled honeypots as spam; "drop" resolves locally without a request. */
  honeypot?: "send" | "drop";
  /** Abort after this many ms. Default 15000. */
  timeoutMs?: number;
  /** Custom fetch (tests, proxies). */
  fetch?: typeof fetch;
}

export const DEFAULT_SUCCESS_MESSAGE = "Thank you! Your message has been sent.";

const pageLang = (): string | undefined =>
  (typeof document !== "undefined" && document.documentElement && document.documentElement.lang) || undefined;

export function toFormgongError(caught: unknown): FormgongError {
  return caught instanceof FormgongError ? caught : new FormgongError("unknown_error", "Something went wrong. Please try again.");
}

/** Core submit options from Formgong options. */
export function submitOptions(options: FormgongOptions, tracker?: FormgongTracker): SubmitOptions {
  return {
    endpoint: options.endpoint,
    lang: options.lang || pageLang(),
    subject: options.subject,
    honeypot: options.honeypot,
    timeoutMs: options.timeoutMs,
    fetch: options.fetch,
    tracker,
  };
}

/**
 * Signal-based submission state. Read `status()`, `message()`, `error()`, `result()`, `submitting()`
 * in templates or `computed()`; call `submit(data)` from a handler.
 */
export class FormgongState {
  private readonly _status = signal<FormgongStatus>("idle");
  private readonly _message = signal("");
  private readonly _error = signal<FormgongError | null>(null);
  private readonly _result = signal<SubmitResult | null>(null);

  readonly status: Signal<FormgongStatus> = this._status.asReadonly();
  /** Localized success message from Formgong, or the error message. */
  readonly message: Signal<string> = this._message.asReadonly();
  readonly error: Signal<FormgongError | null> = this._error.asReadonly();
  readonly result: Signal<SubmitResult | null> = this._result.asReadonly();
  readonly submitting: Signal<boolean> = computed(() => this._status() === "submitting");
  readonly succeeded: Signal<boolean> = computed(() => this._status() === "success");
  readonly failed: Signal<boolean> = computed(() => this._status() === "error");

  constructor(private readonly options: () => FormgongOptions) {}

  /** Send `data` (object, FormData or <form>). Resolves with the result, or null on error (see `error()`). */
  async submit(data: SubmitData, extra: { tracker?: FormgongTracker; accessKey?: string } = {}): Promise<SubmitResult | null> {
    const opts = this.options();
    this._status.set("submitting");
    this._message.set("");
    this._error.set(null);
    try {
      const ok = await coreSubmit(extra.accessKey ?? opts.accessKey ?? "", data, submitOptions(opts, extra.tracker));
      extra.tracker?.next();
      this._result.set(ok);
      this._message.set(ok.message || DEFAULT_SUCCESS_MESSAGE);
      this._status.set("success");
      if (opts.redirect && typeof window !== "undefined" && window.location) window.location.assign(opts.redirect);
      return ok;
    } catch (caught) {
      extra.tracker?.next();
      const err = toFormgongError(caught);
      this._error.set(err);
      this._message.set(err.message);
      this._status.set("error");
      return null;
    }
  }

  /** Back to idle (clears message, error and result). */
  reset(): void {
    this._status.set("idle");
    this._message.set("");
    this._error.set(null);
    this._result.set(null);
  }
}
