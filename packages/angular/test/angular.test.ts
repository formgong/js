import { Component, ViewChild } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FormgongContactFormComponent,
  FormgongError,
  FormgongFormDirective,
  FormgongService,
  flattenModel,
  injectFormgong,
  provideFormgong,
  type SubmitResult,
} from "../src/public-api";

type Call = { url: string; body: Record<string, string> };
let calls: Call[] = [];
let reply: { status: number; json: unknown } = { status: 200, json: { success: true, id: "s_1", lang: "en", message: "Sent. Thank you!" } };

function bodyOf(init?: RequestInit): Record<string, string> {
  if (!init?.body) return {};
  if (typeof init.body === "string") return JSON.parse(init.body);
  const out: Record<string, string> = {};
  for (const [k, v] of init.body as FormData) out[k] = typeof v === "string" ? v : `[file ${(v as File).name}]`;
  return out;
}

const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const href = String(url);
  if (href.includes("/pow")) return new Response("nope", { status: 503 });
  calls.push({ url: href, body: bodyOf(init) });
  return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { "content-type": "application/json" } });
});

const flush = async () => {
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
};

beforeEach(() => {
  calls = [];
  reply = { status: 200, json: { success: true, id: "s_1", lang: "en", message: "Sent. Thank you!" } };
  vi.stubGlobal("fetch", fetchMock);
  document.documentElement.lang = "uk";
});
afterEach(() => {
  vi.unstubAllGlobals();
  TestBed.resetTestingModule();
});

describe("flattenModel", () => {
  it("flattens nested groups, arrays and dates", () => {
    expect(flattenModel({ a: "x", n: 2, b: true, skip: null, g: { c: "y" }, tags: ["p", "q"], list: [{ v: 1 }], d: new Date("2026-01-02T00:00:00Z") })).toEqual([
      ["a", "x"], ["n", "2"], ["b", "true"], ["g.c", "y"], ["tags", "p, q"], ["list.0.v", "1"], ["d", "2026-01-02T00:00:00.000Z"],
    ]);
  });
});

describe("FormgongService", () => {
  it("merges provideFormgong config with per-call options", async () => {
    TestBed.configureTestingModule({ providers: [provideFormgong({ accessKey: "fk_cfg", subject: "Hello", fetch: fetchMock as typeof fetch })] });
    const service = TestBed.inject(FormgongService);
    const ok = await service.submit({ email: "a@b.co", message: "hi" }, { lang: "pl" });
    expect(ok.message).toBe("Sent. Thank you!");
    expect(calls[0].url).toBe("https://formgong.com/submit");
    expect(calls[0].body).toMatchObject({ access_key: "fk_cfg", _subject: "Hello", _lang: "pl", email: "a@b.co" });
    await service.submit({ email: "a@b.co" }, { accessKey: "fk_other" });
    expect(calls[1].body).toMatchObject({ access_key: "fk_other", _lang: "uk" });
  });

  it("throws typed errors", async () => {
    TestBed.configureTestingModule({ providers: [provideFormgong({ accessKey: "fk_cfg" })] });
    reply = { status: 429, json: { success: false, code: "rate_limited", message: "Too many" } };
    const err = await TestBed.inject(FormgongService).submit({ email: "a@b.co" }).catch((e) => e);
    expect(err).toBeInstanceOf(FormgongError);
    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
    const missing = await TestBed.inject(FormgongService).submit({}, { accessKey: "" }).catch((e) => e);
    expect(missing.code).toBe("rate_limited"); // config key still used when the override is empty
  });

  it("injectFormgong exposes signals", async () => {
    TestBed.configureTestingModule({});
    const state = TestBed.runInInjectionContext(() => injectFormgong({ accessKey: "fk_sig" }));
    expect(state.status()).toBe("idle");
    const pending = state.submit({ email: "a@b.co" });
    expect(state.submitting()).toBe(true);
    await pending;
    expect(state.status()).toBe("success");
    expect(state.succeeded()).toBe(true);
    expect(state.message()).toBe("Sent. Thank you!");
    expect(state.result()?.id).toBe("s_1");
    reply = { status: 404, json: { success: false, code: "unknown_access_key", message: "Unknown key" } };
    expect(await state.submit({ email: "a@b.co" })).toBeNull();
    expect(state.failed()).toBe(true);
    expect(state.error()?.code).toBe("unknown_access_key");
    expect(state.message()).toBe("Unknown key");
    state.reset();
    expect(state.status()).toBe("idle");
    expect(state.error()).toBeNull();
  });
});

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FormgongFormDirective],
  template: `
    <form [formGroup]="form" formgongForm="fk_reactive" formgongSubject="Reactive" [formgongData]="{ plan: 'pro' }" [formgongAntiSpam]="false"
      #fg="formgong" (formgongSuccess)="ok = $event" (formgongInvalid)="invalid = invalid + 1">
      <input formControlName="email" />
      <div formGroupName="profile"><input formControlName="company" /></div>
      <textarea formControlName="message"></textarea>
      <button type="submit" [disabled]="fg.submitting()">Send</button>
      <p class="msg">{{ fg.message() }}</p>
    </form>
  `,
})
class ReactiveHost {
  form = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    profile: new FormGroup({ company: new FormControl("") }),
    message: new FormControl("", { nonNullable: true }),
  });
  ok: SubmitResult | null = null;
  invalid = 0;
  @ViewChild("fg") fg!: FormgongFormDirective;
}

describe("formgongForm directive", () => {
  it("works with Reactive forms (model values, honeypot, _lang, extra data, reset)", async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    const form: HTMLFormElement = fixture.nativeElement.querySelector("form");
    const honeypot = form.querySelector<HTMLInputElement>('input[name="botcheck"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot!.getAttribute("tabindex")).toBe("-1");

    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(calls).toHaveLength(0);
    expect(fixture.componentInstance.invalid).toBe(1);
    expect(fixture.componentInstance.form.controls.email.touched).toBe(true);

    fixture.componentInstance.form.setValue({ email: "ada@example.com", profile: { company: "ACME" }, message: "Hi" });
    const event = new Event("submit", { cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await flush();
    fixture.detectChanges();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({
      access_key: "fk_reactive", email: "ada@example.com", "profile.company": "ACME", message: "Hi",
      plan: "pro", _subject: "Reactive", _lang: "uk", botcheck: "",
    });
    expect(calls[0].body._fg_b).toBeUndefined();
    expect(fixture.componentInstance.ok?.id).toBe("s_1");
    expect(fixture.componentInstance.fg.status()).toBe("success");
    expect(fixture.nativeElement.querySelector(".msg").textContent).toContain("Sent. Thank you!");
    expect(fixture.componentInstance.form.value.email).toBe("");
  });

  it("emits typed errors", async () => {
    @Component({
      standalone: true,
      imports: [FormgongFormDirective],
      template: `<form formgongForm="fk_x" formgongAntiSpam="false" (formgongError)="err = $event"><input name="email" value="a@b.co" /></form>`,
    })
    class Host { err: FormgongError | null = null; }
    reply = { status: 403, json: { success: false, code: "origin_not_allowed", message: "Not allowed" } };
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    expect(fixture.componentInstance.err?.code).toBe("origin_not_allowed");
    expect(fixture.componentInstance.err?.status).toBe(403);
  });

  it("works with template-driven forms and app-wide config, adding anti-spam signals", async () => {
    @Component({
      standalone: true,
      imports: [FormsModule, FormgongFormDirective],
      template: `<form formgongForm formgongLang="de" #f="ngForm">
        <input name="email" [(ngModel)]="email" required />
        <input name="botcheck" ngModel />
      </form>`,
    })
    class Host { email = ""; @ViewChild(FormgongFormDirective) fg!: FormgongFormDirective; }
    TestBed.configureTestingModule({ providers: [provideFormgong({ accessKey: "fk_global" })] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const form: HTMLFormElement = fixture.nativeElement.querySelector("form");
    expect(form.querySelectorAll('[name="botcheck"]')).toHaveLength(1);
    fixture.componentInstance.email = "td@example.com";
    fixture.detectChanges();
    await fixture.whenStable();
    form.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(calls).toHaveLength(1), { timeout: 4000 });
    expect(calls[0].body).toMatchObject({ access_key: "fk_global", email: "td@example.com", _lang: "de" });
    expect(calls[0].body._fg_b).toMatch(/^1\.\d+\.1\.0\.\d+$/);
  });
});

describe("<formgong-contact-form>", () => {
  it("renders the fields and shows Formgong's localized message", async () => {
    @Component({
      standalone: true,
      imports: [FormgongContactFormComponent],
      template: `<formgong-contact-form accessKey="fk_contact" lang="uk" antiSpam="false" [labels]="{ submit: 'Надіслати' }" (success)="ok = $event" />`,
    })
    class Host { ok: SubmitResult | null = null; }
    reply = { status: 200, json: { success: true, id: "s_9", lang: "uk", message: "Надіслано. Дякуємо!" } };
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const form = el.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("https://formgong.com/submit");
    expect(el.querySelectorAll('[name="botcheck"]')).toHaveLength(1);
    expect(el.querySelector("button")!.textContent).toContain("Надіслати");
    (el.querySelector('[name="name"]') as HTMLInputElement).value = "Ada";
    (el.querySelector('[name="email"]') as HTMLInputElement).value = "ada@example.com";
    (el.querySelector('[name="message"]') as HTMLTextAreaElement).value = "Hello";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    fixture.detectChanges();
    expect(calls[0].body).toMatchObject({ access_key: "fk_contact", name: "Ada", email: "ada@example.com", message: "Hello", _lang: "uk", botcheck: "" });
    expect(fixture.componentInstance.ok?.id).toBe("s_9");
    const status = el.querySelector(".formgong-status")!;
    expect(status.textContent).toContain("Надіслано. Дякуємо!");
    expect(status.getAttribute("role")).toBe("status");
    expect((el.querySelector('[name="email"]') as HTMLInputElement).value).toBe("");
  });

  it("shows errors with role=alert", async () => {
    @Component({ standalone: true, imports: [FormgongContactFormComponent], template: `<formgong-contact-form accessKey="fk_bad" antiSpam="false" (error)="err = $event" />` })
    class Host { err: FormgongError | null = null; }
    reply = { status: 404, json: { success: false, code: "unknown_access_key", message: "Unknown access key" } };
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    fixture.nativeElement.querySelector("form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector(".formgong-status");
    expect(status.getAttribute("role")).toBe("alert");
    expect(status.classList.contains("formgong-error")).toBe(true);
    expect(fixture.componentInstance.err?.code).toBe("unknown_access_key");
  });
});
