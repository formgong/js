import { flushSync, mount, unmount } from "svelte";
import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFormgong, formgong } from "../src/index";
import ContactForm from "../src/ContactForm.svelte";

const challenge = "1.lzx1abc.0123456789abcdef.8.0123456789abcdef0123456789abcdef";
let posts: Array<FormData | string> = [];
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 10)); flushSync(); };

beforeEach(() => {
  posts = [];
  document.body.innerHTML = "";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/pow?")) return new Response(challenge);
    posts.push(init?.body as FormData);
    return Response.json({ success: true, id: "sub_s", message: "Danke" });
  }));
});
afterEach(() => vi.unstubAllGlobals());

function makeForm() {
  const form = document.createElement("form");
  form.innerHTML = `<input name="access_key" value="fk_svelte01"><input name="email" value="a@b.co">`;
  document.body.append(form);
  return form;
}

describe("@formgong/svelte", () => {
  it("use:formgong intercepts submit and reports state", async () => {
    const form = makeForm();
    const states: string[] = [];
    const action = formgong(form, { accessKey: "fk_svelte01", lang: "de", onState: (s) => states.push(s.status) });
    form.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect(states).toEqual(["submitting", "success"]);
    const body = posts[0] as FormData;
    expect(body.get("_lang")).toBe("de");
    expect(String(body.get("_fg_pow"))).toContain("~");
    action.destroy();
  });

  it("createFormgong store + submit()", async () => {
    const fg = createFormgong({ accessKey: "fk_svelte01" });
    await fg.submit({ message: "hi" });
    expect(get(fg)).toMatchObject({ status: "success", message: "Danke" });
    expect(JSON.parse(posts[0] as string)._fg_b).toBeUndefined();
  });

  it("ContactForm.svelte mounts, submits and shows the message", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const app = mount(ContactForm, { target, props: { accessKey: "fk_svelte01", lang: "de" } });
    flushSync();
    const form = target.querySelector("form")!;
    expect((form.querySelector('[name="access_key"]') as HTMLInputElement).value).toBe("fk_svelte01");
    expect(form.querySelector('[name="botcheck"]')).not.toBeNull();
    (form.querySelector('[name="name"]') as HTMLInputElement).value = "Ada";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect(posts).toHaveLength(1);
    expect((posts[0] as FormData).get("name")).toBe("Ada");
    expect(target.querySelector('[role="status"]')!.textContent).toBe("Danke");
    unmount(app);
  });
});
