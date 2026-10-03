import { describe, expect, it, vi } from "vitest";
import { FormgongApi, FormgongApiError } from "../src/api";

function rpcFetch(handler: (body: any, headers: Record<string, string>) => { status?: number; json: unknown }) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const { status = 200, json } = handler(JSON.parse(init.body as string), init.headers as Record<string, string>);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("FormgongApi", () => {
  it("calls tools with the bearer token and returns structuredContent", async () => {
    let seen: any;
    const api = new FormgongApi({ token: "fgp_secret", fetch: rpcFetch((body, headers) => {
      seen = { body, headers };
      return { json: { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "{}" }], structuredContent: { endpoint: "https://formgong.com/submit", forms: [] } } } };
    }) });
    expect(await api.listForms()).toEqual({ endpoint: "https://formgong.com/submit", forms: [] });
    expect(seen.headers.Authorization).toBe("Bearer fgp_secret");
    expect(seen.body).toMatchObject({ jsonrpc: "2.0", method: "tools/call", params: { name: "list_forms", arguments: {} } });
  });

  it("falls back to parsing text content", async () => {
    const api = new FormgongApi({ token: "fgp_x", fetch: rpcFetch((body) => ({ json: { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "{\"form\":{\"id\":\"f1\"}}" }] } } })) });
    expect(await api.createForm({ name: "Test" })).toEqual({ form: { id: "f1" } });
  });

  it("maps tool errors, auth errors and rate limits", async () => {
    const toolError = new FormgongApi({ token: "fgp_x", fetch: rpcFetch((body) => ({ json: { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "Form not found." }], isError: true } } })) });
    await expect(toolError.getFormSnippet({ form_id: "nope" })).rejects.toMatchObject({ code: "tool_error", message: "Form not found." });
    const noToken = new FormgongApi({ fetch: rpcFetch((body) => ({ json: { jsonrpc: "2.0", id: body.id, error: { code: -32001, message: "Token required", data: { reason: "token_required" } } } })) });
    const error = await noToken.listForms().catch((e) => e);
    expect(error).toBeInstanceOf(FormgongApiError);
    expect(error.code).toBe("token_required");
    const limited = new FormgongApi({ token: "fgp_x", fetch: rpcFetch(() => ({ status: 429, json: { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limit exceeded." } } })) });
    await expect(limited.listForms()).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("lists tools without a token", async () => {
    const api = new FormgongApi({ fetch: rpcFetch((body, headers) => {
      expect(headers.Authorization).toBeUndefined();
      return { json: { jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "list_forms" }] } } };
    }) });
    expect((await api.tools()).map((t) => t.name)).toEqual(["list_forms"]);
  });
});
