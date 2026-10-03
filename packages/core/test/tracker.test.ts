// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createTracker } from "../src/tracker";

const challenge = "1.lzx1abc.0123456789abcdef.8.0123456789abcdef0123456789abcdef";

describe("createTracker", () => {
  it("counts keys, pastes and distinct fields like fg.js and solves PoW on first interaction", async () => {
    const form = document.createElement("form");
    form.innerHTML = `<input name="name"><textarea name="message"></textarea>`;
    document.body.append(form);
    const fetch = vi.fn(async () => new Response(challenge)) as unknown as typeof globalThis.fetch;
    const tracker = createTracker(form, "fk_track000", { fetch });
    const [name, message] = [form.querySelector("input")!, form.querySelector("textarea")!];
    expect(fetch).not.toHaveBeenCalled();
    name.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    for (let i = 0; i < 3; i++) name.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    name.dispatchEvent(new Event("input", { bubbles: true }));
    name.dispatchEvent(new Event("input", { bubbles: true }));
    message.dispatchEvent(new Event("paste", { bubbles: true }));
    message.dispatchEvent(new Event("input", { bubbles: true }));
    const signals = await tracker.signals(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(signals._fg_b).toMatch(/^1\.\d+\.3\.1\.2$/);
    expect(signals._fg_pow.startsWith(`${challenge}~`)).toBe(true);
    tracker.next();
    expect((await tracker.signals(0))._fg_pow).toBe("p");
    tracker.destroy();
    name.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    expect((await tracker.signals(0))._fg_b).toMatch(/\.3\.1\.2$/);
  });

  it("reports \"p\" when the challenge cannot be fetched", async () => {
    const form = document.createElement("form");
    const fetch = vi.fn(async () => new Response("", { status: 500 })) as unknown as typeof globalThis.fetch;
    const tracker = createTracker(form, () => "fk_track000", { fetch, eager: true });
    expect((await tracker.signals(1000))._fg_pow).toBe("p");
  });
});
