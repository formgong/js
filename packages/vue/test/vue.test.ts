// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import { ContactForm, FormgongForm, useFormgong } from "../src/index";

const challenge = "1.lzx1abc.0123456789abcdef.8.0123456789abcdef0123456789abcdef";
let posts: Array<FormData | string> = [];
const flush = async () => { for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 10)); await nextTick(); } };

beforeEach(() => {
  posts = [];
  document.body.innerHTML = "";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/pow?")) return new Response(challenge);
    posts.push(init?.body as FormData);
    return Response.json({ success: true, id: "sub_v", message: "Merci" });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function mount(component: unknown, props: Record<string, unknown> = {}) {
  const el = document.createElement("div");
  document.body.append(el);
  const app = createApp(component as never, props);
  app.mount(el);
  return { el, app };
}

describe("@formgong/vue", () => {
  it("ContactForm renders hidden fields + honeypot and submits with anti-spam signals", async () => {
    const onSuccess = vi.fn();
    const { el } = mount(ContactForm, { accessKey: "fk_vue12345", lang: "fr", onSuccess });
    const form = el.querySelector("form")!;
    expect((form.querySelector('[name="access_key"]') as HTMLInputElement).value).toBe("fk_vue12345");
    expect((form.querySelector('[name="botcheck"]') as HTMLInputElement).value).toBe("");
    const name = form.querySelector('[name="name"]') as HTMLInputElement;
    name.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    name.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    name.value = "Ada";
    name.dispatchEvent(new Event("input", { bubbles: true }));
    (form.querySelector('[name="email"]') as HTMLInputElement).value = "ada@example.com";
    (form.querySelector('[name="message"]') as HTMLTextAreaElement).value = "Bonjour";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    expect(posts).toHaveLength(1);
    const body = posts[0] as FormData;
    expect(body.get("_lang")).toBe("fr");
    expect(body.get("name")).toBe("Ada");
    expect(String(body.get("_fg_b"))).toMatch(/^1\.\d+\.1\.0\.1$/);
    expect(String(body.get("_fg_pow"))).toContain("~");
    expect(el.querySelector('[role="status"]')!.textContent).toBe("Merci");
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "sub_v" }));
  });

  it("FormgongForm exposes slot state", async () => {
    const { el } = mount(defineComponent({ render: () => h(FormgongForm, { accessKey: "fk_vue12345", antiSpam: false }, { default: ({ status }: { status: string }) => h("span", { id: "s" }, status) }) }));
    expect(el.querySelector("#s")!.textContent).toBe("idle");
  });

  it("useFormgong submit() works without a form and sends no behaviour signals", async () => {
    let api!: ReturnType<typeof useFormgong>;
    mount(defineComponent({ setup() { api = useFormgong({ accessKey: "fk_vue12345" }); return () => h("div"); } }));
    await api.submit({ email: "a@b.co" });
    expect(api.status.value).toBe("success");
    expect(JSON.parse(posts[0] as string)._fg_b).toBeUndefined();
  });
});
