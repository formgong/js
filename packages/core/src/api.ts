/**
 * @formgong/core/api: account API for scripts, CLIs and AI agents.
 * Talks to the Formgong MCP endpoint (POST https://formgong.com/mcp, JSON-RPC 2.0) with a
 * personal API token (fgp_…) from Dashboard → Account → API tokens. Server-side / CLI only:
 * never ship a personal token to a browser.
 */
export const DEFAULT_API_URL = "https://formgong.com/mcp";
export const MCP_PROTOCOL_VERSION = "2025-06-18";

export type FormSummary = { id: string; name: string; access_key: string; created_at: string; submissions_this_month: number; dashboard_url: string };
export type ListFormsResult = { endpoint: string; forms: FormSummary[] };
export type CreateFormInput = { name: string; notify_email?: boolean };
export type CreateFormResult = {
  form: { id: string; name: string; access_key: string; endpoint: string };
  notifications: { email: string | null; email_verified: boolean; telegram: string };
  dashboard: { install: string; inbox: string; email_settings: string; telegram_settings: string };
  next_step?: string;
};
export type SnippetFramework = "html" | "react" | "next";
export type GetSnippetInput = { form_id: string; framework?: SnippetFramework; lang?: string };
export type GetSnippetResult = { form_id: string; framework: SnippetFramework; lang: string; code: string; notes: string[] };
export type ListSubmissionsInput = { form_id: string; limit?: number; include_spam?: boolean };
export type Submission = { id: string; created_at: string; spam?: boolean; fields: Record<string, string> };
export type ListSubmissionsResult = { form_id: string; notice: string; submissions: Submission[] };
export type ToolInfo = { name: string; title?: string; description?: string; inputSchema?: unknown; annotations?: Record<string, unknown> };

export type ApiErrorCode = "token_required" | "invalid_token" | "rate_limited" | "tool_error" | "rpc_error" | "http_error" | "network_error" | "invalid_response";

export class FormgongApiError extends Error {
  override readonly name = "FormgongApiError";
  constructor(readonly code: ApiErrorCode, message: string, readonly status = 0, readonly data?: unknown) {
    super(message);
  }
}

export type FormgongApiOptions = {
  /** Personal API token (fgp_…). Optional for `tools()` / `ping()`. */
  token?: string;
  /** MCP endpoint. Default https://formgong.com/mcp. */
  url?: string;
  fetch?: typeof fetch;
  userAgent?: string;
};

let nextId = 1;

export class FormgongApi {
  readonly url: string;
  private readonly token?: string;
  private readonly doFetch: typeof fetch;
  private readonly userAgent?: string;

  constructor(options: FormgongApiOptions = {}) {
    this.url = options.url ?? DEFAULT_API_URL;
    this.token = options.token?.trim() || undefined;
    this.doFetch = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent;
  }

  /** Raw JSON-RPC call. */
  async rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.userAgent) headers["User-Agent"] = this.userAgent;
    let response: Response;
    try {
      response = await this.doFetch(this.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }) });
    } catch (error) {
      throw new FormgongApiError("network_error", `Could not reach ${this.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const text = await response.text();
    let json: { result?: T; error?: { code: number; message: string; data?: { reason?: string } } } | undefined;
    try {
      json = JSON.parse(text);
    } catch {
      throw new FormgongApiError(response.ok ? "invalid_response" : "http_error", `Unexpected response from Formgong (HTTP ${response.status}).`, response.status);
    }
    if (json?.error) {
      const reason = json.error.data?.reason;
      const code: ApiErrorCode = response.status === 429 ? "rate_limited" : reason === "invalid_token" ? "invalid_token" : reason === "token_required" ? "token_required" : "rpc_error";
      throw new FormgongApiError(code, json.error.message, response.status, json.error.data);
    }
    if (!response.ok || !json || !("result" in json)) throw new FormgongApiError("http_error", `Formgong returned HTTP ${response.status}.`, response.status);
    return json.result as T;
  }

  /** Call a tool and return its structured result. Throws `FormgongApiError("tool_error")` for tool errors. */
  async call<T = Record<string, unknown>>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = await this.rpc<{ content?: Array<{ type: string; text?: string }>; structuredContent?: T; isError?: boolean }>("tools/call", { name, arguments: args });
    const text = result.content?.map((part) => part.text ?? "").join("\n") ?? "";
    if (result.isError) throw new FormgongApiError("tool_error", text || `Tool ${name} failed.`);
    if (result.structuredContent !== undefined) return result.structuredContent;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new FormgongApiError("invalid_response", `Tool ${name} returned no structured result.`);
    }
  }

  async tools(): Promise<ToolInfo[]> {
    return (await this.rpc<{ tools: ToolInfo[] }>("tools/list")).tools;
  }

  async ping(): Promise<boolean> {
    await this.rpc("ping");
    return true;
  }

  listForms(): Promise<ListFormsResult> {
    return this.call("list_forms");
  }

  createForm(input: CreateFormInput): Promise<CreateFormResult> {
    return this.call("create_form", input);
  }

  getFormSnippet(input: GetSnippetInput): Promise<GetSnippetResult> {
    return this.call("get_form_snippet", input);
  }

  listRecentSubmissions(input: ListSubmissionsInput): Promise<ListSubmissionsResult> {
    return this.call("list_recent_submissions", input);
  }
}
