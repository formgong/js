/**
 * @formgong/next/server: forward forms to Formgong from Next.js Server Actions and Route Handlers.
 *
 *   // app/contact/actions.ts
 *   "use server";
 *   import { submitToFormgong } from "@formgong/next/server";
 *   export async function contact(prev: unknown, formData: FormData) {
 *     return submitToFormgong(formData);
 *   }
 */
import { FormgongError, submit, type SubmitOptions } from "@formgong/core";

export type FormgongActionState =
  | { status: "idle"; message: ""; code?: undefined; id?: undefined }
  | { status: "success"; message: string; id: string; code?: undefined }
  | { status: "error"; message: string; code: string; id?: undefined };

/** Initial state for `useActionState(action, initialFormgongState)`. */
export const initialFormgongState: FormgongActionState = { status: "idle", message: "" };

export type ServerSubmitOptions = Omit<SubmitOptions, "tracker"> & {
  /** Defaults to process.env.FORMGONG_ACCESS_KEY, then NEXT_PUBLIC_FORMGONG_ACCESS_KEY. (`endpoint` defaults to FORMGONG_ENDPOINT, then https://formgong.com/submit.) */
  accessKey?: string;
  /**
   * Forward the visitor's Origin/Referer and Accept-Language from next/headers (default true).
   * Needed when the form only allows certain domains.
   */
  forwardHeaders?: boolean;
  /** Return an error message to reject the submission before it is sent. */
  validate?: (data: FormData) => string | null | undefined | Promise<string | null | undefined>;
};

const CLIENT_ONLY_FIELDS = ["_fg_b", "_fg_pow", "$ACTION_ID", "$ACTION_REF"];

function env(name: string): string | undefined {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return value?.trim() || undefined;
}

async function visitorHeaders(): Promise<Record<string, string>> {
  try {
    const mod = (await import("next/headers")) as { headers: () => unknown };
    const list = (await mod.headers()) as { get(name: string): string | null };
    const out: Record<string, string> = {};
    const origin = list.get("origin") || (() => { try { const ref = list.get("referer"); return ref ? new URL(ref).origin : null; } catch { return null; } })();
    if (origin) out.Origin = origin;
    const referer = list.get("referer");
    if (referer) out.Referer = referer;
    const language = list.get("accept-language");
    if (language) out["Accept-Language"] = language;
    return out;
  } catch {
    return {};
  }
}

/**
 * Send FormData (or an object) to Formgong from the server. Never throws: returns a serialisable
 * state for `useActionState`. Behaviour signals are not forwarded or fabricated (server posts are
 * never penalised for lacking them). Rate limits apply to your server's IP: 20/min, form: 30/min.
 */
export async function submitToFormgong(data: FormData | Record<string, string>, options: ServerSubmitOptions = {}): Promise<FormgongActionState> {
  const { accessKey = env("FORMGONG_ACCESS_KEY") ?? env("NEXT_PUBLIC_FORMGONG_ACCESS_KEY"), forwardHeaders = true, validate, ...rest } = options;
  const body = new FormData();
  if (data instanceof FormData) {
    for (const [k, v] of data) if (!CLIENT_ONLY_FIELDS.includes(k) && !k.startsWith("$ACTION_")) body.append(k, v);
  } else for (const [k, v] of Object.entries(data)) body.append(k, v);
  if (validate) {
    const problem = await validate(body);
    if (problem) return { status: "error", message: problem, code: "validation_failed" };
  }
  const headers = forwardHeaders ? { ...(await visitorHeaders()), ...rest.headers } : rest.headers;
  try {
    const result = await submit(accessKey ?? "", body, { ...rest, endpoint: rest.endpoint ?? env("FORMGONG_ENDPOINT"), headers, origin: rest.origin });
    return { status: "success", message: result.message || "Thank you! Your message has been sent.", id: result.id };
  } catch (error) {
    if (error instanceof FormgongError) return { status: "error", message: error.message, code: error.code };
    return { status: "error", message: "Something went wrong. Please try again.", code: "unknown_error" };
  }
}

/**
 * Build a Server Action for `useActionState`. Wrap it in your own "use server" function:
 *
 *   const send = createFormgongAction({ subject: "New lead" });
 *   export async function contact(prev: FormgongActionState, fd: FormData) { return send(prev, fd); }
 */
export function createFormgongAction(options: ServerSubmitOptions = {}) {
  return async function formgongAction(_prev: FormgongActionState | undefined, formData: FormData): Promise<FormgongActionState> {
    return submitToFormgong(formData, options);
  };
}

/** Route Handler helper: `export const POST = formgongRoute()` forwards any form POST to Formgong as JSON. */
export function formgongRoute(options: ServerSubmitOptions = {}) {
  return async function POST(request: Request): Promise<Response> {
    let data: FormData;
    try {
      data = await request.formData();
    } catch {
      return Response.json({ success: false, code: "unsupported_type", message: "Send multipart/form-data or urlencoded." }, { status: 415 });
    }
    const headers: Record<string, string> = {};
    for (const name of ["origin", "referer", "accept-language"]) { const v = request.headers.get(name); if (v) headers[name] = v; }
    const state = await submitToFormgong(data, { forwardHeaders: false, ...options, headers: { ...headers, ...options.headers } });
    return Response.json(state.status === "success" ? { success: true, id: state.id, message: state.message } : { success: false, code: state.code, message: state.message }, { status: state.status === "success" ? 200 : 400 });
  };
}
