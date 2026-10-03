# @formgong/angular

[![npm](https://img.shields.io/npm/v/@formgong/angular?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/angular) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/angular?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/angular) [![types](https://img.shields.io/npm/types/@formgong/angular)](https://www.npmjs.com/package/@formgong/angular) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/angular)](https://github.com/formgong/js/blob/main/LICENSE)

> Contact forms for **Angular 17+** without a backend. [Formgong](https://formgong.com) delivers each submission to email, Telegram and webhooks. You don't need an API route, a database or SMTP.

```bash
npm install @formgong/angular
```

Standalone APIs, signals, Reactive and template-driven forms. Built with ng-packagr (partial Ivy), so it works with Angular 17, 18, 19 and newer, with or without zone.js.

## Ready-made form

```ts
import { Component } from "@angular/core";
import { FormgongContactFormComponent } from "@formgong/angular";

@Component({
  selector: "app-contact",
  standalone: true,
  imports: [FormgongContactFormComponent],
  template: `<formgong-contact-form accessKey="fk_your_access_key" lang="en" (success)="sent($event.id)" />`,
})
export class ContactComponent {
  sent(id: string) { console.log("submission", id); }
}
```

You get name, email and message fields, a `botcheck` honeypot, `_lang`, anti-spam signals and a status line with Formgong's localized message (`role="status"`, or `role="alert"` on errors). Style it with the `formgong-form`, `formgong-field`, `formgong-submit`, `formgong-status`, `formgong-success` and `formgong-error` classes. Inputs: `accessKey`, `lang`, `subject`, `redirect`, `endpoint`, `antiSpam` (default `true`) and `labels` (`{ name, email, message, submit, sending }`). Outputs: `success` and `error`.

## Reactive forms

Add `formgongForm` to your own `<form>`. The directive reads the `FormGroup` value, so inputs don't need `name` attributes. Nested groups are sent as `group.field`.

```ts
import { Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { FormgongFormDirective, type FormgongError } from "@formgong/angular";

@Component({
  selector: "app-quote",
  standalone: true,
  imports: [ReactiveFormsModule, FormgongFormDirective],
  template: `
    <form [formGroup]="form" formgongForm="fk_your_access_key" formgongSubject="New quote request"
          #fg="formgong" (formgongError)="onError($event)">
      <input formControlName="email" type="email" />
      <textarea formControlName="message"></textarea>
      <button [disabled]="fg.submitting()">{{ fg.submitting() ? "Sending…" : "Send" }}</button>
      <p role="status">{{ fg.message() }}</p>
    </form>
  `,
})
export class QuoteComponent {
  form = new FormGroup({
    email: new FormControl("", { nonNullable: true, validators: [Validators.required, Validators.email] }),
    message: new FormControl("", { nonNullable: true, validators: Validators.required }),
  });
  onError(error: FormgongError) {
    if (error.code === "rate_limited") console.warn("Please wait a minute");
  }
}
```

An invalid form isn't sent. The directive marks every control as touched and emits `formgongInvalid`. After a successful send it calls `resetForm()`.

## Template-driven forms and plain forms

```html
<form formgongForm="fk_your_access_key" #fg="formgong">
  <input name="email" type="email" [(ngModel)]="email" required />
  <textarea name="message" ngModel required></textarea>
  <button [disabled]="fg.submitting()">Send</button>
  @if (fg.failed()) { <p role="alert">{{ fg.error()?.code }}: {{ fg.message() }}</p> }
  @if (fg.succeeded()) { <p role="status">{{ fg.message() }}</p> }
</form>
```

It also works without `FormsModule`: the directive sends the form's named fields, including files.

| Directive input | Default | |
| --- | --- | --- |
| `formgongForm` | `provideFormgong()` key | Public form key `fk_…` |
| `formgongLang` | `<html lang>` | `en`, `uk`, `pl`, `tr`, `de`, `es`, `fr`, `pt`, `ar`, `he`, `hi`, `ja` |
| `formgongSubject`, `formgongRedirect`, `formgongEndpoint` | | Email subject, page to open after success, custom endpoint |
| `formgongData` | | Extra fields merged into every submission |
| `formgongAntiSpam` | `true` | fg.js-style behaviour signal and proof-of-work |
| `formgongHoneypot` | `true` | Add a hidden `botcheck` field if the form has none |
| `formgongResetOnSuccess`, `formgongRequireValid` | `true` | |

Outputs: `formgongSuccess` (`SubmitResult`), `formgongError` (`FormgongError`), `formgongInvalid`. Through `#fg="formgong"` you get these signals: `status()`, `message()`, `error()`, `result()`, `submitting()`, `succeeded()` and `failed()`. You can also call `fg.submit()` from code.

## Service and signals

```ts
// app.config.ts
import { provideFormgong } from "@formgong/angular";
export const appConfig = { providers: [provideFormgong({ accessKey: "fk_your_access_key", lang: "en" })] };
```

```ts
import { Component, inject } from "@angular/core";
import { FormgongService, injectFormgong, isFormgongError } from "@formgong/angular";

@Component({ /* … */ })
export class SignupComponent {
  // Headless signals: form.status(), form.message(), form.error(), form.submitting()
  readonly form = injectFormgong({ subject: "Waitlist" });
  private readonly formgong = inject(FormgongService);

  join(email: string) {
    return this.form.submit({ email }); // never throws; check form.error()
  }

  async direct(email: string) {
    try {
      await this.formgong.submit({ email }); // throws FormgongError with a stable code
    } catch (error) {
      if (isFormgongError(error) && error.retryable) { /* try again later */ }
    }
  }
}
```

SSR (Angular Universal / `@angular/ssr`) is fine. The anti-spam tracker starts only in the browser. You can also run `npx formgong init` in an Angular project: it creates a form and writes a standalone contact component with the new key. More: [formgong.com/en/for/angular/](https://formgong.com/en/for/angular/).

The access key (`fk_…`) is **public by design**: it can only send submissions to your form.

## Why Formgong

Formgong is a hosted form backend with a free plan, built for static and AI-built sites. Submissions go to **email and Telegram**, plus webhooks for Make, n8n and Zapier. Data is stored in the EU, and messages and autoreplies come in 12 languages. Spam filtering includes a honeypot, optional Cloudflare Turnstile and cookie-free behaviour signals, with no stored fingerprints.

How it compares with Formspree, Web3Forms, Basin, Getform, FormSubmit and Netlify Forms: **[formgong.com/en/compare](https://formgong.com/en/compare/)**. Moving from Formspree takes one line: change the form `action` or the access key ([guide](https://formgong.com/en/formspree-alternative/)).

## Packages

| Package | What it is |
| --- | --- |
| [`@formgong/core`](https://www.npmjs.com/package/@formgong/core) | Tiny typed client: `submit()`, typed errors, anti-spam tracker, account API |
| [`@formgong/react`](https://www.npmjs.com/package/@formgong/react) | `<ContactForm>`, `<FormgongForm>`, `useFormgong()` for React, Lovable, Bolt and v0 |
| [`@formgong/next`](https://www.npmjs.com/package/@formgong/next) | Next.js Server Action and Route Handler helpers, plus App Router components |
| [`@formgong/vue`](https://www.npmjs.com/package/@formgong/vue) | Vue 3 and Nuxt components and the `useFormgong()` composable |
| [`@formgong/svelte`](https://www.npmjs.com/package/@formgong/svelte) | `use:formgong` action, store helper, Svelte components |
| [`@formgong/astro`](https://www.npmjs.com/package/@formgong/astro) | Astro components with progressive enhancement, plus a helper for Actions |
| [`@formgong/angular`](https://www.npmjs.com/package/@formgong/angular) | Angular 17+ standalone component, `formgongForm` directive and `FormgongService` with signals |
| [`formgong`](https://www.npmjs.com/package/formgong) | CLI: `npx formgong init` creates a form and adds it to your project |
| [`create-formgong`](https://www.npmjs.com/package/create-formgong) | `npm create formgong@latest`: starter projects |

## Links

- Docs: https://formgong.com/en/docs/
- MCP server for Cursor, Claude and VS Code: https://formgong.com/en/docs/mcp/
- Source: https://github.com/formgong/js
- Issues: https://github.com/formgong/js/issues
- Support: support@formgong.com

## License

MIT © Formgong
