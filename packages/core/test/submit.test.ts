import { describe, expect, it, vi } from "vitest";
import { createClient, FormgongError, honeypotTriggered, isFormgongError, submit, trySubmit } from "../src/index";

type Call = { url: string; init: RequestInit };

function mockFetch(status: number, body: unknown, calls: Call[] = []) {
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return fn as unknown as typeof fetch;
}

describe("submit", () => {
  it("posts flat JSON with access key, _lang and reserved fields", async () => {
    const calls: Call[] = [];
    const result = await submit(" fk_test123 ", { name: "Ada", tags: ["a", "b"], n: 3, ok: true, skip: undefined, nil: null }, {
      fetch: mockFetch(200, { success: true, id: "sub_1", lang: "en", message: "Thanks!" }, calls),
      lang: "uk",
      subject: "Hello",
      replyTo: "ada@example.com",
      fromName: "Site",
      turnstileToken: "tok",
    });
    expect(result).toMatchObject({ success: true, id: "sub_1", message: "Thanks!", lang: "en" });
    expect(calls).toHaveLength(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://formgong.com/submit");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada", tags: "a, b", n: "3", ok: "true",
      access_key: "fk_test123", _lang: "uk", _subject: "Hello", _replyto: "ada@example.com", _from_name: "Site", "cf-turnstile-response": "tok",
    });
  });

  it("sends FormData as multipart without touching the caller's object and without a Content-Type", async () => {
    const calls: Call[] = [];
    const fd = new FormData();
    fd.append("email", "a@b.co");
    await submit("fk_test123", fd, { fetch: mockFetch(200, { success: true, id: "x", message: "ok" }, calls) });
    const body = calls[0]!.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body).not.toBe(fd);
    expect(body.get("access_key")).toBe("fk_test123");
    expect(body.get("email")).toBe("a@b.co");
    expect(fd.get("access_key")).toBeNull();
    expect((calls[0]!.init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("switches to multipart when an object contains a Blob", async () => {
    const calls: Call[] = [];
    await submit("fk_test123", { file: new Blob(["hi"], { type: "text/plain" }), name: "x" }, { fetch: mockFetch(200, { success: true, id: "x", message: "" }, calls) });
    const body = calls[0]!.init.body as FormData;
    expect(body.get("name")).toBe("x");
    expect(body.get("file")).toBeInstanceOf(Blob);
  });

  it("accepts URLSearchParams and keeps an explicit _lang", async () => {
    const calls: Call[] = [];
    await submit("fk_test123", new URLSearchParams("a=1&a=2&_lang=pl"), { fetch: mockFetch(200, { success: true, id: "x", message: "" }, calls) });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ a: "1, 2", _lang: "pl", access_key: "fk_test123" });
  });

  it("throws typed errors with the server code and status", async () => {
    const error = await submit("fk_nope0000", { a: "1" }, { fetch: mockFetch(404, { success: false, code: "unknown_access_key", message: "Unknown key" }) }).catch((e) => e);
    expect(error).toBeInstanceOf(FormgongError);
    expect(isFormgongError(error)).toBe(true);
    expect(error).toMatchObject({ code: "unknown_access_key", status: 404, message: "Unknown key" });
    expect(error.retryable).toBe(false);
    const limited = await submit("fk_x0000000", {}, { fetch: mockFetch(429, { success: false, code: "rate_limited", message: "Slow down" }) }).catch((e) => e);
    expect(limited.retryable).toBe(true);
  });

  it("rejects an empty access key without a request", async () => {
    const fetch = mockFetch(200, {});
    await expect(submit("  ", {}, { fetch })).rejects.toMatchObject({ code: "missing_access_key" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps network failures, timeouts, aborts and non-JSON answers", async () => {
    const failing = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    await expect(submit("fk_x0000000", {}, { fetch: failing })).rejects.toMatchObject({ code: "network_error", status: 0 });
    const hanging = ((_: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
    await expect(submit("fk_x0000000", {}, { fetch: hanging, timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
    const controller = new AbortController();
    const pending = submit("fk_x0000000", {}, { fetch: hanging, signal: controller.signal, timeoutMs: 0 });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "aborted" });
    await expect(submit("fk_x0000000", {}, { fetch: mockFetch(502, "<html>bad gateway</html>") })).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });

  it("honeypot: sends by default, drops locally when asked", async () => {
    expect(honeypotTriggered({ botcheck: "buy now" })).toBe(true);
    expect(honeypotTriggered({ botcheck: "  " })).toBe(false);
    const fetch = mockFetch(200, { success: true, id: "spam1", message: "ok" });
    expect((await submit("fk_x0000000", { botcheck: "x" }, { fetch })).id).toBe("spam1");
    const dropped = await submit("fk_x0000000", { _honeypot: "x" }, { fetch, honeypot: "drop" });
    expect(dropped).toEqual({ success: true, id: "", message: "", dropped: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("adds tracker signals and the Origin header when configured", async () => {
    const calls: Call[] = [];
    const tracker = { signals: async () => ({ _fg_b: "1.5000.12.0.3", _fg_pow: "chal~42" }), warmUp() {}, next() {}, destroy() {} };
    await submit("fk_x0000000", { a: "1" }, { fetch: mockFetch(200, { success: true, id: "x", message: "" }, calls), tracker, origin: "https://acme.test", endpoint: "http://localhost:8787/submit" });
    expect(calls[0]!.url).toBe("http://localhost:8787/submit");
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ _fg_b: "1.5000.12.0.3", _fg_pow: "chal~42" });
    expect((calls[0]!.init.headers as Record<string, string>).Origin).toBe("https://acme.test");
  });

  it("never invents behaviour signals without a tracker", async () => {
    const calls: Call[] = [];
    await submit("fk_x0000000", { a: "1" }, { fetch: mockFetch(200, { success: true, id: "x", message: "" }, calls) });
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body._fg_b).toBeUndefined();
    expect(body._fg_pow).toBeUndefined();
  });

  it("createClient and trySubmit", async () => {
    const calls: Call[] = [];
    const client = createClient("fk_client00", { fetch: mockFetch(200, { success: true, id: "c", message: "" }, calls), subject: "Default" });
    await client.submit({ a: "1" }, { subject: "Override" });
    expect(JSON.parse(calls[0]!.init.body as string)._subject).toBe("Override");
    const bad = await trySubmit("fk_x0000000", {}, { fetch: mockFetch(400, { success: false, code: "too_many_fields", message: "Too many" }) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("too_many_fields");
  });
});
