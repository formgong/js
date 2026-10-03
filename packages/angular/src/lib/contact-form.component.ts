import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, booleanAttribute } from "@angular/core";
import type { FormgongError, SubmitResult } from "@formgong/core";
import { FormgongFormDirective } from "./form.directive";

export interface ContactFormLabels {
  name: string;
  email: string;
  message: string;
  submit: string;
  sending: string;
}

export const DEFAULT_LABELS: ContactFormLabels = {
  name: "Name",
  email: "Email",
  message: "Message",
  submit: "Send",
  sending: "Sending…",
};

/**
 * Drop-in contact form: `<formgong-contact-form accessKey="fk_..." />`.
 * Name, email and message fields, honeypot, `_lang`, anti-spam signals and a localized status line.
 * Style it with the `formgong-*` classes or pass `[labels]` to translate the field labels.
 */
@Component({
  selector: "formgong-contact-form",
  standalone: true,
  imports: [FormgongFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="formgong-form"
      [attr.action]="endpoint || 'https://formgong.com/submit'"
      method="POST"
      [formgongForm]="accessKey"
      [formgongLang]="lang"
      [formgongSubject]="subject"
      [formgongRedirect]="redirect"
      [formgongEndpoint]="endpoint"
      [formgongAntiSpam]="antiSpam"
      #fg="formgong"
      (formgongSuccess)="success.emit($event)"
      (formgongError)="error.emit($event)"
    >
      <input type="hidden" name="access_key" [value]="accessKey" />
      <label class="formgong-field">
        <span>{{ text.name }}</span>
        <input type="text" name="name" autocomplete="name" required />
      </label>
      <label class="formgong-field">
        <span>{{ text.email }}</span>
        <input type="email" name="email" autocomplete="email" required />
      </label>
      <label class="formgong-field">
        <span>{{ text.message }}</span>
        <textarea name="message" rows="5" required></textarea>
      </label>
      <input
        type="text"
        name="botcheck"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
        style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"
      />
      <button type="submit" class="formgong-submit" [disabled]="fg.submitting()">
        {{ fg.submitting() ? text.sending : text.submit }}
      </button>
      @if (fg.message()) {
        <p class="formgong-status" [class.formgong-success]="fg.succeeded()" [class.formgong-error]="fg.failed()" [attr.role]="fg.failed() ? 'alert' : 'status'">
          {{ fg.message() }}
        </p>
      }
    </form>
  `,
})
export class FormgongContactFormComponent {
  /** Public form key (fk_…). Leave empty to use `provideFormgong({ accessKey })`. */
  @Input() accessKey = "";
  /** Visitor language; defaults to <html lang>. Formgong answers in it. */
  @Input() lang?: string;
  @Input() subject?: string;
  @Input() redirect?: string;
  @Input() endpoint?: string;
  @Input({ transform: booleanAttribute }) antiSpam = true;
  /** Translate the visible labels; the status message comes localized from Formgong. */
  @Input() labels?: Partial<ContactFormLabels> | null;

  @Output() readonly success = new EventEmitter<SubmitResult>();
  @Output() readonly error = new EventEmitter<FormgongError>();

  get text(): ContactFormLabels {
    return { ...DEFAULT_LABELS, ...(this.labels ?? {}) };
  }
}
