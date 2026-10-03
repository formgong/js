# @formgong/core

[![npm](https://img.shields.io/npm/v/@formgong/core?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/core) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/core?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/core) [![types](https://img.shields.io/npm/types/@formgong/core)](https://www.npmjs.com/package/@formgong/core) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/core)](https://github.com/formgong/js/blob/main/LICENSE)

> A tiny, typed client for **[Formgong](https://formgong.com)**, the form backend for contact forms. Post a form from any JavaScript runtime and the submission arrives by email, Telegram or webhook. You don't need a server, a database or SMTP.

- **About 3 kB min+gzip, no dependencies.** ESM and CJS builds with TypeScript types.
- **Runs anywhere:** browsers, Node 18+, Deno, Bun, Cloudflare Workers, Vercel and Netlify Edge.
- **Typed errors** carry stable codes such as `unknown_access_key`, `rate_limited` and `turnstile_missing`.
- **Anti-spam built in:** honeypot handling, and the same behaviour signals and proof-of-work as Formgong's `fg.js`.
- **Account API** (`@formgong/core/api`) for scripts and AI agents: list forms, create a form, get a snippet, read submissions.

```bash
npm install @formgong/core
```

## Quick start

```ts
import { submit, FormgongError } from "@formgong/core";

try {
  const { id, message } = await submit("fk_your_access_key", {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello!",
  });
  console.log(message); // "Sent. Thank you!" (localized)
} catch (error) {
  if (error instanceof FormgongError) console.error(error.code, error.message);
}
```

Get a free access key (`fk_…`) at [formgong.com](https://formgong.com). It is **public by design**: it can only send submissions to your form, so it is safe in frontend code.

## Browser forms

```ts
import { createTracker, submit } from "@formgong/core";

const form = document.querySelector("form")!;
// Optional: the same anti-spam signals as fg.js (typing/paste counts + a small proof-of-work).
const tracker = createTracker(form, "fk_your_access_key");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = await submit("fk_your_access_key", form, { tracker, lang: "de" });
  form.reset();
  tracker.next();
  alert(result.message);
});
```

Add a hidden honeypot field to the form, `<input name="botcheck" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px">`, and keep it empty.

## API

### `submit(accessKey, data, options?) => Promise<SubmitResult>`

`data` can be a plain object, `FormData`, `URLSearchParams` or an `HTMLFormElement`. Objects are sent as JSON, with arrays joined as `"a, b"`. Objects that contain a `Blob` or `File` are sent as multipart. FormData is copied, so your object is never modified.

| Option | Description |
| --- | --- |
| `lang` | Visitor language for messages and the autoreply: `en uk pl tr de es fr pt ar he hi ja`. Defaults to `<html lang>` in browsers. |
| `subject`, `replyTo`, `fromName` | Email subject, Reply-To address and sender name (`_subject`, `_replyto`, `_from_name`). |
| `turnstileToken` | Cloudflare Turnstile token, if the form has Turnstile enabled. |
| `tracker` | A `createTracker()` instance. It adds `_fg_b` and `_fg_pow`, exactly like fg.js. |
| `honeypot` | `"send"` (default) lets Formgong file a filled honeypot as spam. `"drop"` resolves locally without sending a request. |
| `origin` | Server-side only: the `Origin` header to send, for forms restricted to allowed domains. |
| `endpoint` | Submit URL. Default `https://formgong.com/submit`. |
| `timeoutMs`, `signal`, `fetch`, `headers` | Transport controls. The default timeout is 15 s. |

It resolves to `{ success: true, id, lang, message }` and throws `FormgongError` on failure.

### `FormgongError`

| Property | Description |
| --- | --- |
| `code` | Stable code. Server codes: `missing_access_key`, `unknown_access_key`, `invalid_json`, `too_many_fields`, `too_large`, `origin_not_allowed`, `rate_limited`, `limit_exceeded`, `turnstile_missing`, `turnstile_failed`, `uploads_disabled`, `file_unsafe`, … Client codes: `network_error`, `timeout`, `aborted`, `invalid_response`. |
| `status` | HTTP status, or `0` for network errors. |
| `message` | Localized, human-readable text that is ready to show. |
| `retryable` | `true` for network problems, rate limits and 5xx responses. |

Other helpers:

- `trySubmit()`: the same as `submit` but never throws. It returns `{ ok, result | error }`.
- `createClient(accessKey, defaults)`: binds an access key and default options once.
- `honeypotTriggered(data)`: tells you whether a honeypot field is filled in.

### Anti-spam: `createTracker(target, accessKey, options?)`

It counts keydowns, pastes and the distinct fields typed into, starting from when the form is seen. On the first interaction it fetches a signed challenge from `GET /pow?k=…` and solves it in the background with Web Crypto (SHA-256, about 13 bits, typically a fraction of a second). Call `tracker.signals()` to get `{ _fg_b, _fg_pow }`. It waits up to 2 s for the proof-of-work, like fg.js.

Formgong only scores these signals when `_fg_b` is present. Server-side and SDK posts without them are **never penalised**, so never create a tracker on a server and never fake the values.

Lower-level helpers: `solvePow(challenge)`, `fetchPowChallenge(accessKey)`, `leadingZeroBits()`.

### Account API: `@formgong/core/api`

```ts
import { FormgongApi } from "@formgong/core/api";

const api = new FormgongApi({ token: process.env.FORMGONG_TOKEN }); // fgp_… personal API token
const { form } = await api.createForm({ name: "Contact – acme.com" });
const { code } = await api.getFormSnippet({ form_id: form.id, framework: "react" });
const { submissions } = await api.listRecentSubmissions({ form_id: form.id, limit: 5 });
```

This talks JSON-RPC to the [Formgong MCP endpoint](https://formgong.com/en/docs/mcp/) (`POST https://formgong.com/mcp`). Create tokens under Dashboard → Account → API tokens. Personal tokens are secrets: use them on the server, in scripts or in CI, never in a browser. Limits: 60 requests per minute per token and 10 new forms per hour.

## Server-side notes

From a server (Node, Workers, Server Actions), per-IP rate limits apply to **your server's IP**: 20 submissions per minute per IP and 30 per minute per form. If the form only allows certain domains, pass `origin`. For Next.js, use [`@formgong/next`](https://www.npmjs.com/package/@formgong/next), which forwards Origin and Accept-Language for you.

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
