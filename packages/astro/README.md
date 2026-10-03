# @formgong/astro

[![npm](https://img.shields.io/npm/v/@formgong/astro?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/astro) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/astro?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/astro) [![types](https://img.shields.io/npm/types/@formgong/astro)](https://www.npmjs.com/package/@formgong/astro) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/astro)](https://github.com/formgong/js/blob/main/LICENSE)

> Contact forms for **Astro** without a backend. [Formgong](https://formgong.com) delivers each submission to email, Telegram and webhooks. The components work on fully static sites: no adapter, no API route, no Netlify Forms lock-in.

```bash
npm install @formgong/astro
```

## Ready-made form

```astro
---
import ContactForm from "@formgong/astro/ContactForm.astro";
---
<ContactForm accessKey="fk_your_access_key" lang="en" />
```

## Your own fields

```astro
---
import FormgongForm from "@formgong/astro/FormgongForm.astro";
---
<FormgongForm accessKey="fk_your_access_key" subject="New quote request" redirect="/thanks" class="grid gap-3">
  <input name="name" required />
  <input name="phone" type="tel" />
  <button type="submit">Send</button>
</FormgongForm>
```

How it behaves:

- **Without JavaScript:** a plain HTML form posts to Formgong and follows `redirect`.
- **With JavaScript:** a ~3 kB script submits inline, shows Formgong's localized message in an `aria-live` status line and adds the anti-spam signals (like `fg.js`). It also re-binds after View Transitions (`astro:page-load`).
- It dispatches `formgong:success` and `formgong:error` DOM events on the form.

Props: `accessKey` (required), `lang`, `subject`, `redirect`, `endpoint`, `antiSpam` (default `true`), `hideStatus`, `statusClass`, plus any `<form>` attribute. `ContactForm` also takes `labels`.

## Astro Actions / API routes (server)

```ts
// src/actions/index.ts
import { defineAction } from "astro:actions";
import { forwardToFormgong } from "@formgong/astro";

export const server = {
  contact: defineAction({
    accept: "form",
    handler: async (formData) => forwardToFormgong(formData, import.meta.env.FORMGONG_ACCESS_KEY),
  }),
};
```

Client helpers for custom markup: `enhanceForm(form, options)` and `enhanceAll(root)` from `@formgong/astro/client`.

Starter project: `npm create formgong@latest -- --template astro`. In an existing project, `npx formgong init` writes `src/pages/contact.astro`. More: [formgong.com/en/for/astro/](https://formgong.com/en/for/astro/).

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
