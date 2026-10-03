/**
 * @formgong/svelte: contact forms for Svelte and SvelteKit without a backend.
 * `use:formgong` action + `createFormgong()` store helper. Components live in "@formgong/svelte"
 * under the "svelte" export condition (FormgongForm.svelte, ContactForm.svelte).
 */
import { writable, type Readable } from "svelte/store";
import {
  baseUrlFromEndpoint,
  createTracker,
  FormgongError,
  submit as coreSubmit,
  type FormgongTracker,
  type SubmitData,
  type SubmitResult,
} from "@formgong/core";

export { DEFAULT_ENDPOINT, FormgongError, isFormgongError, submit, createClient, type SubmitData, type SubmitResult, type SubmitOptions, type FormgongErrorCode } from "@formgong/core";

export type FormgongStatus = "idle" | "submitting" | "success" | "error";
export type FormgongState = { status: FormgongStatus; message: string; submitting: boolean; error: FormgongError | null; result: SubmitResult | null };

export type FormgongOptions = {
  /** Public form key (fk_…). Public by design. */
  accessKey: string;
  endpoint?: string;
  /** en, uk, pl, tr, de, es, fr, pt, ar, he, hi, ja. Defaults to <html lang>. */
  lang?: string;
  subject?: string;
  redirect?: string;
  /** Anti-spam signals like Formgong's fg.js. Default true. */
  antiSpam?: boolean;
  /** Reset the form after success. Default true. */
  resetOnSuccess?: boolean;
  onSuccess?: (result: SubmitResult) => void;
  onError?: (error: FormgongError) => void;
  onState?: (state: FormgongState) => void;
};

const IDLE: FormgongState = { status: "idle", message: "", submitting: false, error: null, result: null };
const pageLang = () => (typeof document !== "undefined" && document.documentElement.lang) || undefined;

async function run(opts: FormgongOptions, data: SubmitData, set: (s: FormgongState) => void, tracker?: FormgongTracker, form?: HTMLFormElement): Promise<SubmitResult | null> {
  set({ ...IDLE, status: "submitting", submitting: true });
  try {
    const result = await coreSubmit(opts.accessKey, data, { endpoint: opts.endpoint, lang: opts.lang || pageLang(), subject: opts.subject, tracker });
    tracker?.next();
    set({ status: "success", message: result.message || "Thank you! Your message has been sent.", submitting: false, error: null, result });
    if (form && opts.resetOnSuccess !== false) form.reset();
    opts.onSuccess?.(result);
    if (opts.redirect && typeof window !== "undefined") window.location.assign(opts.redirect);
    return result;
  } catch (caught) {
    tracker?.next();
    const error = caught instanceof FormgongError ? caught : new FormgongError("unknown_error", "Something went wrong. Please try again.");
    set({ status: "error", message: error.message, submitting: false, error, result: null });
    opts.onError?.(error);
    return null;
  }
}

/**
 * Svelte action: `<form use:formgong={{ accessKey: "fk_…", onState: (s) => (state = s) }}>`.
 * Intercepts submit, posts the form's fields to Formgong and adds anti-spam signals.
 */
export function formgong(form: HTMLFormElement, options: FormgongOptions) {
  let opts = options;
  const tracker = opts.antiSpam === false ? null : createTracker(form, () => opts.accessKey, { baseUrl: baseUrlFromEndpoint(opts.endpoint) });
  const onSubmit = (event: Event) => {
    event.preventDefault();
    void run(opts, new FormData(form), (s) => opts.onState?.(s), tracker ?? undefined, form);
  };
  form.addEventListener("submit", onSubmit);
  return {
    update(next: FormgongOptions) { opts = next; },
    destroy() { form.removeEventListener("submit", onSubmit); tracker?.destroy(); },
  };
}

/**
 * Store helper: `const fg = createFormgong({ accessKey }); <form use:fg.enhance>{$fg.message}</form>`.
 * `$fg` is `{ status, message, submitting, error, result }`; `fg.submit(data)` posts any object.
 */
export function createFormgong(options: FormgongOptions): Readable<FormgongState> & {
  enhance: (form: HTMLFormElement) => { destroy(): void };
  submit: (data: SubmitData) => Promise<SubmitResult | null>;
  reset: () => void;
} {
  const store = writable<FormgongState>(IDLE);
  const set = (s: FormgongState) => { store.set(s); options.onState?.(s); };
  return {
    subscribe: store.subscribe,
    enhance(form: HTMLFormElement) {
      return formgong(form, { ...options, onState: set });
    },
    submit: (data) => run(options, data, set),
    reset: () => set(IDLE),
  };
}
