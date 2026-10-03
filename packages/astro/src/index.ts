/**
 * @formgong/astro: contact forms for Astro without a backend.
 *   import FormgongForm from "@formgong/astro/FormgongForm.astro";
 *   import ContactForm from "@formgong/astro/ContactForm.astro";
 * Server helper for Astro Actions / API routes: `forwardToFormgong(formData, accessKey)`.
 */
import { submit, type SubmitOptions, type SubmitResult } from "@formgong/core";

export { submit, createClient, FormgongError, isFormgongError, DEFAULT_ENDPOINT, type SubmitData, type SubmitResult, type SubmitOptions, type FormgongErrorCode } from "@formgong/core";
export { enhanceForm, enhanceAll, type EnhanceOptions } from "./client.js";

/**
 * Forward a form posted to your own Astro endpoint or Action to Formgong (server-side).
 * Behaviour signals are never fabricated here; Formgong does not penalise server posts for lacking them.
 * Note: per-IP rate limits then apply to your server's IP (20/min) and the form's own limit (30/min).
 */
export function forwardToFormgong(data: FormData | Record<string, string>, accessKey: string, options: SubmitOptions = {}): Promise<SubmitResult> {
  if (data instanceof FormData) {
    const copy = new FormData();
    for (const [k, v] of data) if (k !== "_fg_b" && k !== "_fg_pow") copy.append(k, v);
    return submit(accessKey, copy, options);
  }
  return submit(accessKey, data, options);
}
