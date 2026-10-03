/**
 * Browser side of @formgong/astro: progressively enhances <form data-formgong> elements
 * rendered by <FormgongForm>: fetch submit, inline status, anti-spam signals like fg.js.
 */
import { baseUrlFromEndpoint, createTracker, FormgongError, submit, type SubmitResult } from "@formgong/core";

export type EnhanceOptions = {
  accessKey?: string;
  endpoint?: string;
  lang?: string;
  subject?: string;
  redirect?: string;
  antiSpam?: boolean;
  onSuccess?: (result: SubmitResult, form: HTMLFormElement) => void;
  onError?: (error: FormgongError, form: HTMLFormElement) => void;
};

const enhanced = new WeakSet<HTMLFormElement>();

/** Enhance one form. Options default to the form's data-* attributes and hidden inputs. */
export function enhanceForm(form: HTMLFormElement, options: EnhanceOptions = {}): () => void {
  if (enhanced.has(form)) return () => {};
  enhanced.add(form);
  const ds = form.dataset;
  const hidden = (name: string) => (form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value || undefined;
  const accessKey = () => options.accessKey ?? hidden("access_key") ?? ds.accessKey ?? "";
  const endpoint = options.endpoint ?? (form.getAttribute("action") || undefined);
  const antiSpam = options.antiSpam ?? ds.antiSpam !== "false";
  const tracker = antiSpam ? createTracker(form, accessKey, { baseUrl: baseUrlFromEndpoint(endpoint) }) : undefined;
  const status = form.querySelector<HTMLElement>("[data-formgong-status]");
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"], button:not([type])');

  const show = (state: "submitting" | "success" | "error", text: string) => {
    form.setAttribute("aria-busy", String(state === "submitting"));
    form.dataset.status = state;
    if (button) button.disabled = state === "submitting";
    if (status) { status.textContent = text; status.dataset.status = state; }
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    show("submitting", "");
    const lang = options.lang ?? hidden("_lang") ?? (document.documentElement.lang || undefined);
    try {
      const result = await submit(accessKey(), new FormData(form), { endpoint, lang, subject: options.subject, tracker });
      tracker?.next();
      show("success", result.message || "Thank you! Your message has been sent.");
      form.reset();
      options.onSuccess?.(result, form);
      form.dispatchEvent(new CustomEvent("formgong:success", { detail: result, bubbles: true }));
      const redirect = options.redirect ?? hidden("_redirect");
      if (redirect) window.location.assign(redirect);
    } catch (caught) {
      tracker?.next();
      const error = caught instanceof FormgongError ? caught : new FormgongError("unknown_error", "Something went wrong. Please try again.");
      show("error", error.message);
      options.onError?.(error, form);
      form.dispatchEvent(new CustomEvent("formgong:error", { detail: error, bubbles: true }));
    }
  };
  form.addEventListener("submit", onSubmit);
  return () => { form.removeEventListener("submit", onSubmit); tracker?.destroy(); enhanced.delete(form); };
}

/** Enhance every `form[data-formgong]` under `root` (default: document). Safe to call repeatedly (View Transitions). */
export function enhanceAll(root: ParentNode = document, options: EnhanceOptions = {}): void {
  root.querySelectorAll<HTMLFormElement>("form[data-formgong]").forEach((form) => enhanceForm(form, options));
}
