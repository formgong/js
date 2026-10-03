# @formgong/react

[![npm](https://img.shields.io/npm/v/@formgong/react?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/react) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/react?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/react) [![types](https://img.shields.io/npm/types/@formgong/react)](https://www.npmjs.com/package/@formgong/react) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/react)](https://github.com/formgong/js/blob/main/LICENSE)

> A React contact form that **works without a backend**. The browser posts to [Formgong](https://formgong.com), a hosted form backend that delivers each submission to your email, Telegram and webhooks (Make, n8n, Zapier). You don't need an API route, a Server Action, Supabase or Edge Functions, Resend or SMTP.

It works in Lovable, Bolt, v0, Next.js (App Router and Pages), Vite, Remix and Astro islands, and supports React 18 and 19. It is built on [`@formgong/core`](https://www.npmjs.com/package/@formgong/core) (about 3 kB, no other dependencies).

```bash
npm install @formgong/react
```

```tsx
import { ContactForm } from "@formgong/react";

export default function Contact() {
  return <ContactForm accessKey="fk_your_access_key" />;
}
```

1. Sign up at https://formgong.com and create a form. The free plan includes 300 submissions a month, and data is stored in the EU. Or run `npx formgong init`, which creates the form and writes this file for you.
2. Copy the form's access key (`fk_…`). It's **public by design**: put it in frontend code or a `NEXT_PUBLIC_` / `VITE_` env var, not in server secrets.
3. Submit the form once, and the message arrives in your inbox.

## Props

| Prop | Description |
| --- | --- |
| `accessKey` | **Required.** Public form key `fk_…`. |
| `lang` | Language of Formgong's messages, thank-you text and autoreply: `en uk pl tr de es fr pt ar he hi ja`. Defaults to `<html lang>`. |
| `subject` | Email subject. |
| `redirect` | Page to open after a successful submission. Also used when JavaScript is off. |
| `turnstileSiteKey` | Cloudflare Turnstile site key. Only use it if Turnstile is enabled in the form settings. |
| `antiSpam` | Typing/paste signals plus proof-of-work, like Formgong's `fg.js`. Default `true`. |
| `onSuccess(result)` | Called with `{ success, message, id, lang }`. |
| `onError(result, error)` | Called with `{ success: false, code, message }` and the typed `FormgongError`. |
| `labels` | `ContactForm` only: `{ name, email, message, submit, sending }`. |
| `unstyled` | `ContactForm` only: remove the inline styles and style it with `className` or your own CSS (e.g. Tailwind). |
| `endpoint` | Override the submit URL (default `https://formgong.com/submit`). |

Every form includes a hidden `botcheck` honeypot, and Formgong always filters spam. Formgong's response message is shown inline in an `aria-live` status line.

## Your own fields

```tsx
import { FormgongForm } from "@formgong/react";

<FormgongForm accessKey="fk_your_access_key" lang="de" subject="New quote request" className="grid gap-3">
  {({ submitting, error }) => (
    <>
      <input name="name" required className="input" />
      <input name="phone" type="tel" className="input" />
      <select name="service"><option>Website</option><option>Shop</option></select>
      <button disabled={submitting}>Send</button>
      {error?.code === "rate_limited" && <p>Please wait a minute.</p>}
    </>
  )}
</FormgongForm>
```

Every named field becomes a field in the submission. The form also posts natively when JavaScript is disabled.

## Headless hook

```tsx
import { useFormgong, Honeypot } from "@formgong/react";

function Contact() {
  const { formRef, handleSubmit, status, message, submitting, error } = useFormgong({ accessKey: "fk_your_access_key" });
  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <textarea name="message" required />
      <Honeypot />
      <button disabled={submitting}>Send</button>
      <p role="status">{message}</p>
    </form>
  );
}
```

`formRef` is optional and turns on the anti-spam signals. For react-hook-form, Formik or a custom state machine, call `submit(data)`. It returns the result, or `null` and sets `error`, and never throws.

```tsx
const { submit } = useFormgong({ accessKey: "fk_your_access_key" });
const onValid = (values) => submit(values); // react-hook-form's handleSubmit(onValid)
```

## Prompt for Lovable, Bolt or v0

```text
Install @formgong/react and add a contact section with <ContactForm accessKey="fk_..." />.
Do not create Supabase tables, Edge Functions, API routes or email code for this form,
and do not move the access key to secrets: it is public by design.
```

Guides: [Lovable](https://formgong.com/en/docs/lovable/), [Bolt](https://formgong.com/en/docs/bolt/), [v0](https://formgong.com/en/docs/v0/). Prefer copying a single file? See [formgong/react-contact-form](https://github.com/formgong/react-contact-form).

## Upgrading from 0.1

0.2 is backwards compatible: `<ContactForm>`, `<FormgongForm>`, `useFormgong()` and the default export work as before. New in 0.2:

- built on `@formgong/core`
- typed `error`, `result` and `submit()` in the hook
- `formRef` and the `antiSpam` prop
- `<Honeypot />`
- a CJS build

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
