/**
 * @formgong/angular: contact forms for Angular 17+ without a backend.
 * Submissions go to email, Telegram and webhooks via Formgong (https://formgong.com).
 */
export { FormgongState, DEFAULT_SUCCESS_MESSAGE, type FormgongOptions, type FormgongStatus } from "./lib/state";
export { FormgongService, FORMGONG_CONFIG, provideFormgong, injectFormgong } from "./lib/service";
export { FormgongFormDirective, flattenModel } from "./lib/form.directive";
export { FormgongContactFormComponent, DEFAULT_LABELS, type ContactFormLabels } from "./lib/contact-form.component";
export {
  FormgongError,
  isFormgongError,
  submit,
  createClient,
  DEFAULT_ENDPOINT,
  type FormgongErrorCode,
  type SubmitData,
  type SubmitOptions,
  type SubmitResult,
} from "@formgong/core";
