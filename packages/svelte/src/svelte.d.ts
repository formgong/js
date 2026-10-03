import { SvelteComponent } from "svelte";
import type { FormgongError, SubmitResult } from "@formgong/core";
import type { FormgongStatus } from "./index.js";
export * from "./index.js";

export type FormgongFormProps = {
  accessKey: string;
  endpoint?: string;
  lang?: string;
  subject?: string;
  redirect?: string;
  antiSpam?: boolean;
  hideStatus?: boolean;
  statusClass?: string;
  [attr: string]: unknown;
};
type Events = { success: CustomEvent<SubmitResult>; error: CustomEvent<FormgongError> };
type Slots = { default: { status: FormgongStatus; message: string; submitting: boolean; error: FormgongError | null } };

export declare class FormgongForm extends SvelteComponent<FormgongFormProps, Events, Slots> {}
export declare class ContactForm extends SvelteComponent<FormgongFormProps & { labels?: Partial<Record<"name" | "email" | "message" | "submit" | "sending", string>> }, Events, {}> {}
