import { ActionForm } from "@formgong/next/client";
import { contact } from "./actions";

export default function ContactPage() {
  return (
    <main>
      <h1>Contact us</h1>
      <ActionForm action={contact} style={{ display: "grid", gap: 12 }}>
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" required />
        <textarea name="message" rows={5} placeholder="Message" required />
        <button type="submit">Send</button>
      </ActionForm>
    </main>
  );
}
