import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  PLATFORM_ID,
  Renderer2,
  booleanAttribute,
  inject,
  numberAttribute,
} from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { ControlContainer } from "@angular/forms";
import { HONEYPOT_FIELDS, type FormgongError, type FormgongTracker, type SubmitResult } from "@formgong/core";
import { FormgongService } from "./service";
import type { FormgongOptions, FormgongState } from "./state";

type Primitive = string | number | boolean | null | undefined;
type ResettableContainer = ControlContainer & { resetForm?: (value?: unknown) => void };

/** Flatten a (possibly nested) form model into `field` / `group.field` entries. */
export function flattenModel(value: unknown, prefix = "", out: Array<[string, string | Blob]> = []): Array<[string, string | Blob]> {
  if (value === null || value === undefined) return out;
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    if (prefix) out.push([prefix, value]);
    return out;
  }
  if (value instanceof Date) {
    if (prefix) out.push([prefix, value.toISOString()]);
    return out;
  }
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== "object")) {
      if (prefix) out.push([prefix, (value as Primitive[]).filter((item) => item !== null && item !== undefined).map(String).join(", ")]);
    } else value.forEach((item, index) => flattenModel(item, prefix ? `${prefix}.${index}` : String(index), out));
    return out;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) flattenModel(item, prefix ? `${prefix}.${key}` : key, out);
    return out;
  }
  if (prefix) out.push([prefix, String(value)]);
  return out;
}

/**
 * Turns any `<form>` into a Formgong form: plain, template-driven (`ngForm`) or Reactive (`[formGroup]`).
 *
 * ```html
 * <form [formGroup]="form" formgongForm="fk_..." #fg="formgong" (formgongSuccess)="done($event)">
 *   …
 *   <button [disabled]="fg.submitting()">Send</button>
 *   <p role="status">{{ fg.message() }}</p>
 * </form>
 * ```
 *
 * Adds a hidden `botcheck` honeypot when the form has none, sends `_lang` and fg.js-style anti-spam
 * signals, and exposes signals: `status()`, `message()`, `error()`, `result()`, `submitting()`.
 */
@Directive({
  selector: "form[formgongForm]",
  standalone: true,
  exportAs: "formgong",
})
export class FormgongFormDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly service = inject(FormgongService);
  private readonly container = inject(ControlContainer, { self: true, optional: true }) as ResettableContainer | null;
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private tracker: FormgongTracker | null = null;

  /** Public form key (fk_…). Leave empty to use `provideFormgong({ accessKey })`. */
  @Input("formgongForm") accessKey = "";
  @Input("formgongLang") lang?: string;
  @Input("formgongSubject") subject?: string;
  @Input("formgongRedirect") redirect?: string;
  @Input("formgongEndpoint") endpoint?: string;
  /** Extra fields merged into every submission (e.g. `{ plan: 'pro' }`). */
  @Input("formgongData") data?: Record<string, unknown> | null;
  /** fg.js-style anti-spam signals. Default true. */
  @Input({ alias: "formgongAntiSpam", transform: booleanAttribute }) antiSpam = true;
  /** Add a hidden `botcheck` honeypot when the form has none. Default true. */
  @Input({ alias: "formgongHoneypot", transform: booleanAttribute }) addHoneypot = true;
  /** Reset the form after success. Default true. */
  @Input({ alias: "formgongResetOnSuccess", transform: booleanAttribute }) resetOnSuccess = true;
  /** With ngForm / [formGroup]: do not send while invalid (marks all controls touched). Default true. */
  @Input({ alias: "formgongRequireValid", transform: booleanAttribute }) requireValid = true;
  @Input({ alias: "formgongTimeoutMs", transform: numberAttribute }) timeoutMs?: number;

  /** Formgong accepted the submission (localized `message`, submission `id`). */
  @Output() readonly formgongSuccess = new EventEmitter<SubmitResult>();
  /** Typed error with a stable `code` (`rate_limited`, `unknown_access_key`, `network_error`…). */
  @Output() readonly formgongError = new EventEmitter<FormgongError>();
  /** Submit was blocked because the Angular form is invalid. */
  @Output() readonly formgongInvalid = new EventEmitter<void>();

  readonly state: FormgongState = this.service.state(() => this.options());
  readonly status = this.state.status;
  readonly message = this.state.message;
  readonly error = this.state.error;
  readonly result = this.state.result;
  readonly submitting = this.state.submitting;
  readonly succeeded = this.state.succeeded;
  readonly failed = this.state.failed;

  /** Effective options (directive inputs over `provideFormgong()` defaults). */
  options(): FormgongOptions {
    return this.service.options({
      accessKey: this.accessKey || undefined,
      lang: this.lang || undefined,
      subject: this.subject || undefined,
      redirect: this.redirect || undefined,
      endpoint: this.endpoint || undefined,
      timeoutMs: this.timeoutMs,
    });
  }

  ngAfterViewInit(): void {
    const form = this.host.nativeElement;
    if (this.addHoneypot && !HONEYPOT_FIELDS.some((name) => form.querySelector(`[name="${name}"]`))) {
      const input = this.renderer.createElement("input") as HTMLInputElement;
      for (const [name, value] of Object.entries({ type: "text", name: "botcheck", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" })) {
        this.renderer.setAttribute(input, name, value);
      }
      this.renderer.setAttribute(input, "style", "position:absolute;left:-9999px;width:1px;height:1px;opacity:0");
      this.renderer.appendChild(form, input);
    }
    if (this.browser && this.antiSpam && this.options().antiSpam !== false && typeof form.addEventListener === "function") {
      this.tracker = this.service.tracker(form, { accessKey: this.accessKey || undefined, endpoint: this.endpoint || undefined });
    }
  }

  ngOnDestroy(): void {
    this.tracker?.destroy();
    this.tracker = null;
  }

  @HostListener("submit", ["$event"])
  onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  /** Validate (Angular forms), collect fields and send. Also callable from code: `fg.submit()`. */
  async submit(): Promise<SubmitResult | null> {
    if (this.state.submitting()) return null;
    const control = this.container?.control;
    if (this.requireValid && control && control.invalid) {
      control.markAllAsTouched();
      this.formgongInvalid.emit();
      return null;
    }
    const result = await this.state.submit(this.collect(), { tracker: this.tracker ?? undefined });
    if (result) {
      if (this.resetOnSuccess) this.resetForm();
      this.formgongSuccess.emit(result);
    } else {
      const err = this.state.error();
      if (err) this.formgongError.emit(err);
    }
    return result;
  }

  /** FormData from the DOM (named inputs, files, honeypot) overlaid with the Angular form model. */
  collect(): FormData {
    const body = new FormData(this.host.nativeElement);
    const model = this.container?.control?.value;
    if (model && typeof model === "object") for (const [key, value] of flattenModel(model)) body.set(key, value);
    if (this.data) for (const [key, value] of flattenModel(this.data)) body.set(key, value);
    return body;
  }

  /** Reset the Angular form (if any) or the native form, and keep the state message. */
  resetForm(): void {
    if (this.container) {
      if (typeof this.container.resetForm === "function") this.container.resetForm();
      else this.container.control?.reset();
    } else this.host.nativeElement.reset();
  }
}
