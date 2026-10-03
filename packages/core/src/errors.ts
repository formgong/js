/** Stable error codes returned by https://formgong.com/submit, plus client-side codes. */
export type FormgongErrorCode =
  // request / parsing
  | "missing_access_key"
  | "unknown_access_key"
  | "invalid_json"
  | "unsupported_type"
  | "files_not_supported"
  | "too_many_fields"
  | "too_large"
  // policy
  | "origin_not_allowed"
  | "rate_limited"
  | "limit_exceeded"
  | "email_unconfirmed_cap"
  | "turnstile_missing"
  | "turnstile_failed"
  | "turnstile_not_configured"
  | "uploads_disabled"
  | "uploads_unverified"
  | "uploads_unavailable"
  | "file_unsafe"
  // client side
  | "network_error"
  | "timeout"
  | "aborted"
  | "invalid_response"
  | "invalid_access_key"
  | "unknown_error"
  // forward compatible: the server may add codes
  | (string & {});

/** Error thrown by `submit()` when Formgong rejects a submission or the request fails. */
export class FormgongError extends Error {
  override readonly name = "FormgongError";
  /** Stable machine-readable code, e.g. `unknown_access_key` or `rate_limited`. */
  readonly code: FormgongErrorCode;
  /** HTTP status (0 for network errors). */
  readonly status: number;
  /** Raw JSON body from Formgong, when there was one. */
  readonly body?: unknown;

  constructor(code: FormgongErrorCode, message: string, status = 0, body?: unknown, options?: { cause?: unknown }) {
    super(message);
    this.code = code;
    this.status = status;
    this.body = body;
    if (options && "cause" in options) (this as { cause?: unknown }).cause = options.cause;
  }

  /** True for errors worth retrying later (network trouble, rate limits). */
  get retryable(): boolean {
    return this.code === "network_error" || this.code === "timeout" || this.code === "rate_limited" || this.status >= 500;
  }
}

export function isFormgongError(error: unknown): error is FormgongError {
  return error instanceof FormgongError || (typeof error === "object" && error !== null && (error as { name?: unknown }).name === "FormgongError" && typeof (error as { code?: unknown }).code === "string");
}
