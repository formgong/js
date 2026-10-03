# @formgong/svelte

[![npm](https://img.shields.io/npm/v/@formgong/svelte?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/svelte) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/svelte?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/svelte) [![types](https://img.shields.io/npm/types/@formgong/svelte)](https://www.npmjs.com/package/@formgong/svelte) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/svelte)](https://github.com/formgong/js/blob/main/LICENSE)

> Contact forms for **Svelte and SvelteKit** without a backend. [Formgong](https://formgong.com) delivers each submission to email, Telegram and webhooks. Works with Svelte 4 and 5.

```bash
npm install @formgong/svelte
```

## Ready-made form

```svelte
<script>
  import { ContactForm } from "@formgong/svelte";
</script>

<ContactForm accessKey="fk_your_access_key" lang="en" on:success={(e) => console.log(e.detail.id)} />
```

## Your own fields

```svelte
<script>
  import { FormgongForm } from "@formgong/svelte";
</script>

<FormgongForm accessKey="fk_your_access_key" subject="New quote request" let:submitting let:error>
  <input name="name" required />
  <input name="phone" type="tel" />
  <button disabled={submitting}>Send</button>
  {#if error?.code === "rate_limited"}<small>Please wait a minute.</small>{/if}
</FormgongForm>
```

`<FormgongForm>` adds the hidden fields, a `botcheck` honeypot, the anti-spam signals (like Formgong's `fg.js`) and an `aria-live` status line. It dispatches `success` and `error`. Without JavaScript the form still posts natively.

## Action, the smallest option

```svelte
<script>
  import { formgong } from "@formgong/svelte";
  let state = { status: "idle", message: "" };
</script>

<form action="https://formgong.com/submit" method="POST" use:formgong={{ accessKey: "fk_your_access_key", onState: (s) => (state = s) }}>
  <input type="hidden" name="access_key" value="fk_your_access_key" />
  <input name="email" type="email" required />
  <input name="botcheck" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" />
  <button disabled={state.status === "submitting"}>Send</button>
  <p role="status">{state.message}</p>
</form>
```

## Store helper

```svelte
<script>
  import { createFormgong } from "@formgong/svelte";
  const fg = createFormgong({ accessKey: "fk_your_access_key" });
</script>

<form use:fg.enhance>…</form>
<p>{$fg.message}</p>
<!-- or fg.submit({ email, message }) from your own handler -->
```

SvelteKit users can run `npx formgong init`, which writes `src/routes/contact/+page.svelte` with a fresh form key. More: [formgong.com/en/for/svelte/](https://formgong.com/en/for/svelte/).

The access key (`fk_…`) is **public by design**: it can only send submissions to your form.

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
