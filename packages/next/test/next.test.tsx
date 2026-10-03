// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFormgongAction, formgongRoute, initialFormgongState, submitToFormgong } from "../src/server";
import { ActionForm, ContactForm } from "../src/client";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://acme.test", referer: "https://acme.test/contact", "accept-language": "uk,en;q=0.8" }),
}));

let posts: Array<{ body: FormData; headers: Record<string, string> }> = [];
beforeEach(() => {
  posts = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body as FormData;
    posts.push({ body, headers: init?.headers as Record<string, string> });
    if (body.get("email") === "limit@example.com") return Response.json({ success: false, code: "rate_limited", message: "Too many" }, { status: 429 });
    return Response.json({ success: true, id: "sub_n", message: "Дякуємо" });
  }));
  process.env.FORMGONG_ACCESS_KEY = "fk_envkey01";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete process.env.FORMGONG_ACCESS_KEY; });

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("@formgong/next/server", () => {
  it("submitToFormgong uses the env key, forwards visitor headers and strips client/action fields", async () => {
    const state = await submitToFormgong(fd({ email: "a@b.co", _fg_b: "1.1.1.1.1", $ACTION_ID_abc: "", "$ACTION_REF_1": "" }));
    expect(state).toEqual({ status: "success", message: "Дякуємо", id: "sub_n" });
    const { body, headers } = posts[0]!;
    expect(body.get("access_key")).toBe("fk_envkey01");
    expect(body.get("_fg_b")).toBeNull();
    expect([...body.keys()].some((k) => k.startsWith("$ACTION"))).toBe(false);
    expect(headers.Origin).toBe("https://acme.test");
    expect(headers["Accept-Language"]).toBe("uk,en;q=0.8");
  });

  it("returns serialisable error states (never throws)", async () => {
    expect(await submitToFormgong(fd({ email: "limit@example.com" }))).toEqual({ status: "error", message: "Too many", code: "rate_limited" });
    expect(await submitToFormgong(fd({}), { accessKey: "" , forwardHeaders: false })).toMatchObject({ status: "error", code: "missing_access_key" });
    delete process.env.FORMGONG_ACCESS_KEY;
    expect(await submitToFormgong(fd({}))).toMatchObject({ status: "error", code: "missing_access_key" });
    expect(await submitToFormgong(fd({ email: "x" }), { accessKey: "fk_a0000000", validate: () => "Email looks wrong" })).toEqual({ status: "error", message: "Email looks wrong", code: "validation_failed" });
  });

  it("createFormgongAction works as a useActionState action", async () => {
    const action = createFormgongAction({ subject: "Lead" });
    const state = await action(initialFormgongState, fd({ email: "a@b.co" }));
    expect(state.status).toBe("success");
    expect(posts[0]!.body.get("_subject")).toBe("Lead");
  });

  it("formgongRoute proxies a POST", async () => {
    const POST = formgongRoute({ accessKey: "fk_route001" });
    const res = await POST(new Request("https://acme.test/api/contact", { method: "POST", body: fd({ email: "a@b.co" }), headers: { origin: "https://acme.test" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, id: "sub_n", message: "Дякуємо" });
    expect(posts[0]!.headers.origin).toBe("https://acme.test");
  });
});

describe("@formgong/next/client", () => {
  it("re-exports the React components", () => {
    expect(typeof ContactForm).toBe("function");
  });

  it("ActionForm renders honeypot and shows the action state", async () => {
    const action = vi.fn(async () => ({ status: "success" as const, message: "Sent!", id: "1" }));
    render(<ActionForm action={action}>{({ pending }) => <button type="submit" disabled={pending}>Go</button>}</ActionForm>);
    expect(document.querySelector('[name="botcheck"]')).not.toBeNull();
    await act(async () => { fireEvent.click(screen.getByText("Go")); });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Sent!"));
    expect(action).toHaveBeenCalled();
  });
});
