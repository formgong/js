"use server";

import { submitToFormgong, type FormgongActionState } from "@formgong/next/server";

// Runs on the server: forwards the form to Formgong, which emails / Telegrams it to you.
export async function contact(_prev: FormgongActionState, formData: FormData): Promise<FormgongActionState> {
  return submitToFormgong(formData, {
    subject: "New message from the website",
    validate: (data) => (String(data.get("message") ?? "").trim().length < 5 ? "Please write a little more." : null),
  });
}
