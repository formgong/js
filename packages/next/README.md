# @formgong/next

[![npm](https://img.shields.io/npm/v/@formgong/next?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/next) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/next?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/next) [![types](https://img.shields.io/npm/types/@formgong/next)](https://www.npmjs.com/package/@formgong/next) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/next)](https://github.com/formgong/js/blob/main/LICENSE)

> Contact forms for **Next.js** with [Formgong](https://formgong.com). Use a Server Action or Route Handler helper, or App Router components that post straight from the browser. Submissions go to email, Telegram and webhooks. You don't need a database, Resend or SMTP.

```bash
npm install @formgong/next
```

## Option A: browser-direct (no server code)

```tsx
// app/contact/page.tsx (a Server Component is fine: the form is a client component)
import { ContactForm } from "@formgong/next/client";

export default function Page() {
  return <ContactForm accessKey={process.env.NEXT_PUBLIC_FORMGONG_ACCESS_KEY!} />;
}
```

`@formgong/next/client` re-exports everything from [`@formgong/react`](https://www.npmjs.com/package/@formgong/react).

## Option B: Server Action (`useActionState`)

```ts
// app/contact/actions.ts
"use server";
import { submitToFormgong, type FormgongActionState } from "@formgong/next/server";

export async function contact(_prev: FormgongActionState, formData: FormData) {
  return submitToFormgong(formData, {
    subject: "New message from the website",
    validate: (data) => (String(data.get("message")).length < 5 ? "Please write a little more." : null),
  });
}
```

```tsx
// app/contact/page.tsx
import { ActionForm } from "@formgong/next/client";
import { contact } from "./actions";

export default function Page() {
  return (
    <ActionForm action={contact}>
      <input name="email" type="email" required />
      <textarea name="message" required />
      <button>Send</button>
    </ActionForm>
  );
}
```

Set `FORMGONG_ACCESS_KEY=fk_…` in `.env.local`. `submitToFormgong` never throws. It returns a serialisable `{ status: "success" | "error", message, id?, code? }`, so you can render it directly.

`<ActionForm>` adds the honeypot and an `aria-live` status line, and uses `useActionState` (React 19), falling back to `useFormState` on Next 14. Use `useFormgongAction(action)` to build your own UI.

## Option C: Route Handler

```ts
// app/api/contact/route.ts
import { formgongRoute } from "@formgong/next/server";
export const POST = formgongRoute({ subject: "Website lead" });
```

## Server helper options

| Option | Default | Description |
| --- | --- | --- |
| `accessKey` | `FORMGONG_ACCESS_KEY`, then `NEXT_PUBLIC_FORMGONG_ACCESS_KEY` | Public form key. |
| `endpoint` | `FORMGONG_ENDPOINT`, then `https://formgong.com/submit` | Submit URL. |
| `forwardHeaders` | `true` | Forwards the visitor's `Origin`/`Referer` (needed for allowed-domain forms) and `Accept-Language`. |
| `validate(formData)` | – | Return an error message to reject the submission before it is sent. |
| `subject`, `replyTo`, `fromName`, `lang`, `honeypot`, `timeoutMs` | – | Same as [`@formgong/core`](https://www.npmjs.com/package/@formgong/core). |

Notes:

- Server posts carry no browser behaviour signals, and Formgong never penalises them for that. Next.js internal `$ACTION_*` fields are stripped.
- Rate limits then apply to your server's IP (20 per minute) and to the form (30 per minute). For high-traffic public forms, Option A spreads the load across visitors.
- Turnstile-protected forms need the widget token in the browser. Use Option A with `turnstileSiteKey`.

A full example lives in [`examples/next-server-action`](https://github.com/formgong/js/tree/main/examples/next-server-action). For a whole starter project, run `npm create formgong@latest -- --template nextjs`. More: [formgong.com/en/for/next/](https://formgong.com/en/for/next/).

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
