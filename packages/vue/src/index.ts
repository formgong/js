/**
 * @formgong/vue: contact forms for Vue 3 and Nuxt without a backend.
 * Submissions go to email, Telegram and webhooks via Formgong (https://formgong.com).
 */
import { computed, defineComponent, h, onBeforeUnmount, ref, shallowRef, watch, type App, type PropType, type Ref } from "vue";
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

export type FormgongOptions = {
  /** Public form key (fk_…). Public by design. */
  accessKey: string;
  endpoint?: string;
  /** en, uk, pl, tr, de, es, fr, pt, ar, he, hi, ja. Defaults to <html lang>. */
  lang?: string;
  subject?: string;
  /** Page to open after success. */
  redirect?: string;
  /** Anti-spam signals like fg.js (needs `formRef`). Default true. */
  antiSpam?: boolean;
  onSuccess?: (result: SubmitResult) => void;
  onError?: (error: FormgongError) => void;
};

const pageLang = () => (typeof document !== "undefined" && document.documentElement.lang) || undefined;

/**
 * Composable: `const { formRef, handleSubmit, status, message } = useFormgong({ accessKey })`
 * then `<form ref="formRef" @submit="handleSubmit">` (or bind with `:ref`).
 */
export function useFormgong(options: FormgongOptions | Ref<FormgongOptions> | (() => FormgongOptions)) {
  const read = (): FormgongOptions => (typeof options === "function" ? options() : "value" in options ? options.value : options);
  const status = ref<FormgongStatus>("idle");
  const message = ref("");
  const error = shallowRef<FormgongError | null>(null);
  const result = shallowRef<SubmitResult | null>(null);
  const formRef = shallowRef<HTMLFormElement | null>(null);
  let tracker: FormgongTracker | null = null;

  watch(formRef, (form) => {
    tracker?.destroy();
    tracker = null;
    if (form && read().antiSpam !== false) tracker = createTracker(form, () => read().accessKey, { baseUrl: baseUrlFromEndpoint(read().endpoint) });
  }, { flush: "sync" });
  onBeforeUnmount(() => { tracker?.destroy(); tracker = null; });

  async function send(data: SubmitData, form?: HTMLFormElement): Promise<SubmitResult | null> {
    const opts = read();
    status.value = "submitting";
    message.value = "";
    error.value = null;
    const useTracker = form && form === formRef.value && opts.antiSpam !== false ? tracker ?? undefined : undefined;
    try {
      const ok = await coreSubmit(opts.accessKey, data, { endpoint: opts.endpoint, lang: opts.lang || pageLang(), subject: opts.subject, tracker: useTracker });
      useTracker?.next();
      result.value = ok;
      status.value = "success";
      message.value = ok.message || "Thank you! Your message has been sent.";
      form?.reset();
      opts.onSuccess?.(ok);
      if (opts.redirect && typeof window !== "undefined") window.location.assign(opts.redirect);
      return ok;
    } catch (caught) {
      useTracker?.next();
      const err = caught instanceof FormgongError ? caught : new FormgongError("unknown_error", "Something went wrong. Please try again.");
      error.value = err;
      status.value = "error";
      message.value = err.message;
      opts.onError?.(err);
      return null;
    }
  }

  return {
    status,
    message,
    error,
    result,
    submitting: computed(() => status.value === "submitting"),
    formRef,
    /** `<form @submit="handleSubmit">` */
    handleSubmit: (event: Event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      return send(new FormData(form), form);
    },
    /** Imperative submit for custom state (never throws). */
    submit: (data: SubmitData) => send(data),
    reset: () => { status.value = "idle"; message.value = ""; error.value = null; result.value = null; },
  };
}

const honeypotStyle = { position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" };

const formProps = {
  accessKey: { type: String, required: true as const },
  endpoint: String,
  lang: String,
  subject: String,
  redirect: String,
  antiSpam: { type: Boolean, default: true },
  hideStatus: Boolean,
  statusClass: String,
};

/**
 * `<FormgongForm access-key="fk_…" v-slot="{ submitting }">…fields…</FormgongForm>`
 * Adds the hidden fields, honeypot, anti-spam signals and an aria-live status line. Emits `success` and `error`.
 */
export const FormgongForm = defineComponent({
  name: "FormgongForm",
  props: formProps,
  emits: { success: (_result: SubmitResult) => true, error: (_error: FormgongError) => true },
  setup(props, { slots, emit }) {
    const api = useFormgong(() => ({
      accessKey: props.accessKey,
      endpoint: props.endpoint,
      lang: props.lang,
      subject: props.subject,
      redirect: props.redirect,
      antiSpam: props.antiSpam,
      onSuccess: (r) => emit("success", r),
      onError: (e) => emit("error", e),
    }));
    return () => {
      const hidden = (name: string, value?: string) => (value ? h("input", { type: "hidden", name, value }) : null);
      const state = { status: api.status.value, message: api.message.value, submitting: api.submitting.value, error: api.error.value };
      return h("form", { ref: api.formRef, action: props.endpoint || DEFAULT_ENDPOINT, method: "POST", onSubmit: api.handleSubmit, "aria-busy": state.submitting }, [
        hidden("access_key", props.accessKey),
        hidden("_lang", props.lang),
        hidden("_subject", props.subject),
        hidden("_redirect", props.redirect),
        h("div", { "aria-hidden": "true", style: honeypotStyle }, [h("input", { name: "botcheck", tabindex: -1, autocomplete: "off" })]),
        slots.default?.(state),
        props.hideStatus
          ? null
          : h("p", { role: "status", "aria-live": "polite", class: props.statusClass, "data-status": state.status, style: props.statusClass ? undefined : { margin: 0, fontSize: "14px", color: state.status === "error" ? "#b91c1c" : "#15803d" } }, state.message),
      ]);
    };
  },
});

export type ContactFormLabels = { name: string; email: string; message: string; submit: string; sending: string };
const DEFAULT_LABELS: ContactFormLabels = { name: "Name", email: "Email", message: "Message", submit: "Send", sending: "Sending…" };

/** Ready-made name / email / message form: `<ContactForm access-key="fk_…" />`. */
export const ContactForm = defineComponent({
  name: "ContactForm",
  props: { ...formProps, labels: Object as PropType<Partial<ContactFormLabels>> },
  emits: ["success", "error"],
  setup(props, { emit }) {
    return () => {
      const text = { ...DEFAULT_LABELS, ...props.labels };
      const label = (title: string, field: ReturnType<typeof h>) => h("label", { style: { display: "grid", gap: "6px" } }, [title, field]);
      return h(FormgongForm, {
        ...props,
        style: { display: "grid", gap: "16px", maxWidth: "512px" },
        onSuccess: (r: SubmitResult) => emit("success", r),
        onError: (e: FormgongError) => emit("error", e),
      }, {
        default: ({ submitting }: { submitting: boolean }) => [
          label(text.name, h("input", { name: "name", autocomplete: "name", required: true })),
          label(text.email, h("input", { type: "email", name: "email", autocomplete: "email", required: true })),
          label(text.message, h("textarea", { name: "message", rows: 5, required: true })),
          h("button", { type: "submit", disabled: submitting }, submitting ? text.sending : text.submit),
        ],
      });
    };
  },
});

/** `app.use(Formgong)` registers <FormgongForm> and <ContactForm> globally (handy in Nuxt plugins). */
export const Formgong = {
  install(app: App) {
    app.component("FormgongForm", FormgongForm);
    app.component("ContactForm", ContactForm);
  },
};

export default Formgong;
