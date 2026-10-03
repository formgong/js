"use client";
/**
 * @formgong/react: contact forms for React without a backend.
 * The browser posts to Formgong (https://formgong.com), which delivers submissions
 * to email, Telegram and webhooks. The access key (fk_…) is public by design.
 * Built on @formgong/core.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type FormHTMLAttributes, type ReactNode } from "react";
import {
  baseUrlFromEndpoint,
  createTracker,
  DEFAULT_ENDPOINT,
  FormgongError,
  submit as coreSubmit,
  type FormgongTracker,
  type SubmitData,
  type SubmitResult,
} from "@formgong/core";

export { DEFAULT_ENDPOINT, FormgongError, isFormgongError, submit, createClient, type SubmitData, type SubmitResult, type SubmitOptions, type FormgongErrorCode } from "@formgong/core";

export type FormgongStatus = "idle" | "submitting" | "success" | "error";

/** JSON returned by Formgong for `Accept: application/json` requests (0.1.x shape, kept for callbacks). */
export type FormgongResult = { success: boolean; message?: string; code?: string; id?: string; lang?: string };

export type FormgongOptions = {
  /** Public form key from the Formgong dashboard (fk_…). */
  accessKey: string;
  /** Submit URL. Defaults to https://formgong.com/submit. */
  endpoint?: string;
  /** Language of Formgong's messages and autoreply (en, uk, pl, tr, de, es, fr, pt, ar, he, hi, ja). Defaults to <html lang>. */
  lang?: string;
  /** Email subject for this form. */
  subject?: string;
  /** Page to open after a successful submission. Also used by the no-JavaScript fallback. */
  redirect?: string;
  /** Cloudflare Turnstile site key. Only if Turnstile is enabled in the form settings. */
  turnstileSiteKey?: string;
  /**
   * Anti-spam signals (typing/paste counts + proof-of-work), the same as Formgong's fg.js.
   * On by default for forms attached through `formRef` or `<FormgongForm>`. Set false to disable.
   */
  antiSpam?: boolean;
  onSuccess?: (result: FormgongResult) => void;
  onError?: (result: FormgongResult, error?: FormgongError) => void;
};

type TurnstileApi = { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
const turnstile = () => (globalThis as unknown as { turnstile?: TurnstileApi }).turnstile;
const pageLang = () => (typeof document !== "undefined" && document.documentElement.lang) || "en";

/** Mounts a Turnstile widget into the returned ref when a site key is given. */
function useTurnstile(siteKey: string | undefined, lang: string | undefined) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!siteKey || !container.current) return;
    const mount = () => {
      const api = turnstile();
      if (api && container.current && !widget.current) widget.current = api.render(container.current, { sitekey: siteKey, language: lang || pageLang() });
    };
    if (turnstile()) return mount();
    const id = "formgong-turnstile";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", mount);
    return () => script?.removeEventListener("load", mount);
  }, [siteKey, lang]);
  const reset = useCallback(() => { if (widget.current) turnstile()?.reset(widget.current); }, []);
  return { container, reset };
}

export type UseFormgong = {
  status: FormgongStatus;
  message: string;
  submitting: boolean;
  /** Typed error of the last failed submission. */
  error: FormgongError | null;
  /** Success payload of the last submission. */
  result: SubmitResult | null;
  /** Attach to any <form onSubmit={handleSubmit}>. Field names become submission fields. */
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Imperative submit for custom UIs (react-hook-form, Formik, …). Never throws; check the return value. */
  submit: (data: SubmitData) => Promise<SubmitResult | null>;
  /** Callback ref: `<form ref={formRef}>` enables the anti-spam signals. */
  formRef: (form: HTMLFormElement | null) => void;
  reset: () => void;
};

/**
 * Headless hook: attach `handleSubmit` to any <form>. Field names become submission fields.
 * Hidden fields (access_key, _lang, _subject) are added automatically.
 */
export function useFormgong(options: FormgongOptions): UseFormgong {
  const { afterSubmit: _internal, ...api } = useFormgongState(options);
  return api;
}

function useFormgongState(options: FormgongOptions) {
  const [status, setStatus] = useState<FormgongStatus>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<FormgongError | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const afterSubmit = useRef<() => void>(() => {});
  const tracker = useRef<FormgongTracker | null>(null);
  const node = useRef<HTMLFormElement | null>(null);

  const formRef = useCallback((form: HTMLFormElement | null) => {
    if (node.current === form) return;
    tracker.current?.destroy();
    tracker.current = null;
    node.current = form;
    if (form && latest.current.antiSpam !== false) {
      tracker.current = createTracker(form, () => latest.current.accessKey, { baseUrl: baseUrlFromEndpoint(latest.current.endpoint) });
    }
  }, []);
  useEffect(() => () => { tracker.current?.destroy(); tracker.current = null; node.current = null; }, []);

  const send = useCallback(async (data: SubmitData, form?: HTMLFormElement): Promise<SubmitResult | null> => {
    const opts = latest.current;
    setStatus("submitting");
    setMessage("");
    setError(null);
    const useTracker = opts.antiSpam !== false && form && form === node.current ? tracker.current ?? undefined : undefined;
    try {
      const ok = await coreSubmit(opts.accessKey, data, { endpoint: opts.endpoint, lang: opts.lang || pageLang(), subject: opts.subject, tracker: useTracker });
      useTracker?.next();
      afterSubmit.current();
      setStatus("success");
      setResult(ok);
      setMessage(ok.message || "Thank you! Your message has been sent.");
      form?.reset();
      opts.onSuccess?.({ success: true, message: ok.message, id: ok.id, lang: ok.lang });
      if (opts.redirect && typeof window !== "undefined") window.location.assign(opts.redirect);
      return ok;
    } catch (caught) {
      useTracker?.next();
      afterSubmit.current();
      const err = caught instanceof FormgongError ? caught : new FormgongError("unknown_error", "Something went wrong. Please try again.");
      setStatus("error");
      setError(err);
      setMessage(err.code === "network_error" ? "Network error. Check your connection and try again." : err.message || "Something went wrong. Please try again.");
      opts.onError?.({ success: false, code: err.code, message: err.message }, err);
      return null;
    }
  }, []);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    await send(new FormData(form), form);
  }, [send]);

  const submit = useCallback((data: SubmitData) => send(data), [send]);
  const reset = useCallback(() => { setStatus("idle"); setMessage(""); setError(null); setResult(null); }, []);
  return { status, message, submitting: status === "submitting", error, result, handleSubmit, submit, formRef, reset, afterSubmit };
}

const honeypotStyle: CSSProperties = { position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" };

/** Hidden `botcheck` honeypot for custom forms built with `useFormgong`. Keep it empty. */
export function Honeypot() {
  return (
    <div aria-hidden="true" style={honeypotStyle}>
      <input name="botcheck" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export type FormgongFormProps = FormgongOptions &
  Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit" | "action" | "method" | "onError" | "children"> & {
    /** Your fields and submit button. A function child receives the current status. */
    children: ReactNode | ((state: { status: FormgongStatus; message: string; submitting: boolean; error: FormgongError | null }) => ReactNode);
    /** Hide the built-in status line (render `message` yourself through a function child). */
    hideStatus?: boolean;
    statusClassName?: string;
  };

/**
 * <form> wired to Formgong: hidden fields, honeypot, anti-spam signals, optional Turnstile and an inline status line.
 * Without JavaScript the browser still posts the form (and follows `redirect`).
 */
export function FormgongForm({ accessKey, endpoint, lang, subject, redirect, turnstileSiteKey, antiSpam, onSuccess, onError, children, hideStatus, statusClassName, ...rest }: FormgongFormProps) {
  const { status, message, submitting, error, handleSubmit, formRef, afterSubmit } = useFormgongState({ accessKey, endpoint, lang, subject, redirect, turnstileSiteKey, antiSpam, onSuccess, onError });
  const captcha = useTurnstile(turnstileSiteKey, lang);
  afterSubmit.current = captcha.reset;
  return (
    <form {...rest} ref={formRef} action={endpoint || DEFAULT_ENDPOINT} method="POST" onSubmit={handleSubmit} aria-busy={submitting}>
      <input type="hidden" name="access_key" value={accessKey} />
      {lang ? <input type="hidden" name="_lang" value={lang} /> : null}
      {subject ? <input type="hidden" name="_subject" value={subject} /> : null}
      {redirect ? <input type="hidden" name="_redirect" value={redirect} /> : null}
      {/* Honeypot: hidden from people, filled by bots. Keep it empty. */}
      <Honeypot />
      {typeof children === "function" ? children({ status, message, submitting, error }) : children}
      {turnstileSiteKey ? <div ref={captcha.container} /> : null}
      {hideStatus ? null : (
        <p role="status" aria-live="polite" className={statusClassName} data-status={status} style={statusClassName ? undefined : { margin: 0, fontSize: 14, color: status === "error" ? "#b91c1c" : "#15803d" }}>
          {message}
        </p>
      )}
    </form>
  );
}

export type ContactFormLabels = { name: string; email: string; message: string; submit: string; sending: string };

export type ContactFormProps = Omit<FormgongFormProps, "children"> & {
  labels?: Partial<ContactFormLabels>;
  /** Drop the default inline styles and style everything through className / your CSS. */
  unstyled?: boolean;
};

const DEFAULT_LABELS: ContactFormLabels = { name: "Name", email: "Email", message: "Message", submit: "Send", sending: "Sending…" };

const styles = {
  form: { display: "grid", gap: 16, width: "100%", maxWidth: 512, margin: "0 auto", fontFamily: "inherit" },
  label: { display: "grid", gap: 6, fontSize: 14, fontWeight: 500, color: "inherit" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, font: "inherit", fontWeight: 400, background: "#fff", color: "#111827" },
  button: { padding: "10px 16px", border: 0, borderRadius: 8, background: "#4f46e5", color: "#fff", font: "inherit", fontWeight: 600, cursor: "pointer" },
} satisfies Record<string, CSSProperties>;

/** Ready-made name / email / message form. */
export function ContactForm({ labels, unstyled, style, ...props }: ContactFormProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const s = (key: keyof typeof styles) => (unstyled ? undefined : styles[key]);
  return (
    <FormgongForm {...props} style={unstyled ? style : { ...styles.form, ...style }}>
      {({ submitting }) => (
        <>
          <label style={s("label")}>
            {text.name}
            <input name="name" autoComplete="name" required style={s("input")} />
          </label>
          <label style={s("label")}>
            {text.email}
            <input type="email" name="email" autoComplete="email" required style={s("input")} />
          </label>
          <label style={s("label")}>
            {text.message}
            <textarea name="message" rows={5} required style={s("input")} />
          </label>
          <button type="submit" disabled={submitting} style={unstyled ? undefined : { ...styles.button, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? text.sending : text.submit}
          </button>
        </>
      )}
    </FormgongForm>
  );
}

export default ContactForm;
