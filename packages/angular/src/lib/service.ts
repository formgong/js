import { Injectable, InjectionToken, inject, makeEnvironmentProviders, type EnvironmentProviders } from "@angular/core";
import { createTracker, baseUrlFromEndpoint, submit as coreSubmit, type FormgongTracker, type SubmitData, type SubmitResult } from "@formgong/core";
import { FormgongState, submitOptions, type FormgongOptions } from "./state";

/** App-wide defaults (access key, language, endpoint…). Provide with `provideFormgong({ accessKey: "fk_..." })`. */
export const FORMGONG_CONFIG = new InjectionToken<FormgongOptions>("FORMGONG_CONFIG", { factory: () => ({}) });

/** `bootstrapApplication(App, { providers: [provideFormgong({ accessKey: "fk_..." })] })` */
export function provideFormgong(config: FormgongOptions): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: FORMGONG_CONFIG, useValue: config }]);
}

/**
 * Injectable Formgong client. `inject(FormgongService).submit({ email, message })` throws `FormgongError`
 * with a stable `code`; `state()` gives you signals for a headless form.
 */
@Injectable({ providedIn: "root" })
export class FormgongService {
  readonly config: FormgongOptions = inject(FORMGONG_CONFIG);

  /** Merge per-call options over the app-wide `provideFormgong()` config. */
  options(overrides: FormgongOptions = {}): FormgongOptions {
    const merged: FormgongOptions = { ...this.config };
    for (const [key, value] of Object.entries(overrides)) if (value !== undefined && value !== "") (merged as Record<string, unknown>)[key] = value;
    return merged;
  }

  /** Send a submission. Resolves with Formgong's localized success payload or throws `FormgongError`. */
  submit(data: SubmitData, options: FormgongOptions & { tracker?: FormgongTracker } = {}): Promise<SubmitResult> {
    const opts = this.options(options);
    return coreSubmit(opts.accessKey ?? "", data, submitOptions(opts, options.tracker));
  }

  /** Signal-based state bound to these options (re-read on every submit when you pass a function). */
  state(options: FormgongOptions | (() => FormgongOptions) = {}): FormgongState {
    return new FormgongState(() => this.options(typeof options === "function" ? options() : options));
  }

  /** fg.js-style anti-spam tracker for a <form> element (browser only). */
  tracker(form: HTMLElement, options: FormgongOptions = {}): FormgongTracker {
    return createTracker(form, () => this.options(options).accessKey ?? "", { baseUrl: baseUrlFromEndpoint(this.options(options).endpoint) });
  }
}

/**
 * Headless signals in a component field initializer:
 * `form = injectFormgong({ accessKey: "fk_..." })`, then `await this.form.submit(this.model)` and
 * `{{ form.message() }}` in the template.
 */
export function injectFormgong(options: FormgongOptions | (() => FormgongOptions) = {}): FormgongState {
  return inject(FormgongService).state(options);
}
