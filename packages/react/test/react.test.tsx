// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactForm, { ContactForm as Named, FormgongForm, useFormgong, DEFAULT_ENDPOINT } from "../src/index";

const challenge = "1.lzx1abc.0123456789abcdef.8.0123456789abcdef0123456789abcdef";
let posts: Array<{ url: string; body: FormData | string }> = [];

beforeEach(() => {
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/pow?")) return new Response(challenge);
    posts.push({ url, body: init?.body as FormData });
    const raw = init?.body;
    const email = typeof raw === "string" ? JSON.parse(raw).email : (raw as FormData).get("email");
    if (email === "bad@example.com") return Response.json({ success: false, code: "rate_limited", message: "Too many" }, { status: 429 });
    return Response.json({ success: true, id: "sub_1", lang: "en", message: "Thanks from Formgong" });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function fill(email = "ada@example.com") {
  fireEvent.focusIn(screen.getByLabelText("Name"));
  fireEvent.keyDown(screen.getByLabelText("Name"));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
}

describe("@formgong/react", () => {
  it("keeps the 0.1 API: default export, ContactForm, FormgongForm, useFormgong, DEFAULT_ENDPOINT", () => {
    expect(ContactForm).toBe(Named);
    expect(typeof FormgongForm).toBe("function");
    expect(typeof useFormgong).toBe("function");
    expect(DEFAULT_ENDPOINT).toBe("https://formgong.com/submit");
  });

  it("renders a progressive-enhancement form with hidden fields and honeypot", () => {
    const { container } = render(<ContactForm accessKey="fk_test123" lang="de" subject="Hi" redirect="https://acme.test/thanks" />);
    const form = container.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("https://formgong.com/submit");
    expect(form.getAttribute("method")).toBe("POST");
    const value = (name: string) => (container.querySelector(`[name="${name}"]`) as HTMLInputElement | null)?.value;
    expect(value("access_key")).toBe("fk_test123");
    expect(value("_lang")).toBe("de");
    expect(value("_subject")).toBe("Hi");
    expect(value("_redirect")).toBe("https://acme.test/thanks");
    expect(value("botcheck")).toBe("");
  });

  it("submits through @formgong/core with anti-spam signals and shows the message", async () => {
    const onSuccess = vi.fn();
    render(<ContactForm accessKey="fk_test123" onSuccess={onSuccess} />);
    fill();
    await act(async () => { fireEvent.submit(screen.getByRole("button").closest("form")!); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Thanks from Formgong"));
    expect(posts).toHaveLength(1);
    const body = posts[0]!.body as FormData;
    expect(body.get("access_key")).toBe("fk_test123");
    expect(body.get("_lang")).toBe("en");
    expect(body.get("name")).toBe("Ada");
    expect(String(body.get("_fg_b"))).toMatch(/^1\.\d+\.1\.0\.\d+$/);
    expect(String(body.get("_fg_pow")).startsWith(`${challenge}~`)).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ success: true, id: "sub_1" }));
  });

  it("antiSpam={false} sends no behaviour signals", async () => {
    render(<ContactForm accessKey="fk_test123" antiSpam={false} />);
    fill();
    await act(async () => { fireEvent.submit(screen.getByRole("button").closest("form")!); });
    await waitFor(() => expect(posts).toHaveLength(1));
    expect((posts[0]!.body as FormData).get("_fg_b")).toBeNull();
  });

  it("reports typed errors through onError with the 0.1 result shape", async () => {
    const onError = vi.fn();
    render(<ContactForm accessKey="fk_test123" onError={onError} />);
    fill("bad@example.com");
    await act(async () => { fireEvent.submit(screen.getByRole("button").closest("form")!); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Too many"));
    expect(onError).toHaveBeenCalledWith({ success: false, code: "rate_limited", message: "Too many" }, expect.objectContaining({ code: "rate_limited", status: 429 }));
  });

  it("useFormgong exposes an imperative submit for custom UIs", async () => {
    let api: ReturnType<typeof useFormgong> | undefined;
    function Custom() {
      api = useFormgong({ accessKey: "fk_test123", lang: "uk" });
      return <p>{api.status}</p>;
    }
    render(<Custom />);
    await act(async () => { await api!.submit({ email: "x@y.z", message: "hi" }); });
    expect(api!.error).toBeNull();
    expect(api!.status).toBe("success");
    expect(api!.result?.id).toBe("sub_1");
    const body = JSON.parse(posts[0]!.body as string);
    expect(body).toMatchObject({ email: "x@y.z", access_key: "fk_test123", _lang: "uk" });
    expect(body._fg_b).toBeUndefined();
  });
});
