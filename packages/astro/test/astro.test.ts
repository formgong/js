// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { transform } from "@astrojs/compiler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enhanceAll, enhanceForm, forwardToFormgong } from "../src/index";

const challenge = "1.lzx1abc.0123456789abcdef.8.0123456789abcdef0123456789abcdef";
let posts: Array<{ url: string; body: FormData | string }> = [];
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 10)); };

beforeEach(() => {
  posts = [];
  document.body.innerHTML = "";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/pow?")) return new Response(challenge);
    posts.push({ url, body: init?.body as FormData });
    return Response.json({ success: true, id: "sub_a", message: "Gracias" });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("@formgong/astro", () => {
  it("components compile with the Astro compiler", async () => {
    for (const file of ["FormgongForm.astro", "ContactForm.astro"]) {
      const result = await transform(readFileSync(`${process.cwd()}/src/${file}`, "utf8"), { filename: file });
      expect(result.diagnostics.filter((d) => d.severity === 1)).toEqual([]);
      expect(result.code).toContain("$$render");
    }
  });

  it("enhanceAll upgrades form[data-formgong] with status, anti-spam and redirect-free inline submit", async () => {
    document.body.innerHTML = `<form data-formgong data-anti-spam="true" action="https://formgong.com/submit" method="POST">
      <input type="hidden" name="access_key" value="fk_astro001"><input type="hidden" name="_lang" value="es">
      <input name="email" value="a@b.co"><button type="submit">Send</button><p data-formgong-status></p></form>`;
    enhanceAll();
    enhanceAll(); // idempotent
    const form = document.querySelector("form")!;
    const onSuccess = vi.fn();
    form.addEventListener("formgong:success", onSuccess);
    form.querySelector('[name="email"]')!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect(posts).toHaveLength(1);
    const body = posts[0]!.body as FormData;
    expect(body.get("access_key")).toBe("fk_astro001");
    expect(body.get("_lang")).toBe("es");
    expect(String(body.get("_fg_pow"))).toContain("~");
    expect(document.querySelector("[data-formgong-status]")!.textContent).toBe("Gracias");
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("data-anti-spam=false sends no behaviour signals", async () => {
    document.body.innerHTML = `<form data-formgong data-anti-spam="false" action="https://formgong.com/submit"><input type="hidden" name="access_key" value="fk_astro001"></form>`;
    const form = document.querySelector("form")!;
    enhanceForm(form);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await settle();
    expect((posts[0]!.body as FormData).get("_fg_b")).toBeNull();
  });

  it("forwardToFormgong strips client signals on the server", async () => {
    const fd = new FormData();
    fd.set("email", "a@b.co");
    fd.set("_fg_b", "1.10.0.0.0");
    await forwardToFormgong(fd, "fk_astro001");
    const body = posts[0]!.body as FormData;
    expect(body.get("_fg_b")).toBeNull();
    expect(body.get("email")).toBe("a@b.co");
  });
});
