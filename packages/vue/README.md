# @formgong/vue

[![npm](https://img.shields.io/npm/v/@formgong/vue?color=4f46e5&label=npm)](https://www.npmjs.com/package/@formgong/vue) [![size](https://img.shields.io/bundlephobia/minzip/@formgong/vue?label=min%2Bgzip)](https://bundlephobia.com/package/@formgong/vue) [![types](https://img.shields.io/npm/types/@formgong/vue)](https://www.npmjs.com/package/@formgong/vue) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/@formgong/vue)](https://github.com/formgong/js/blob/main/LICENSE)

> Contact forms for **Vue 3 and Nuxt** without a backend. [Formgong](https://formgong.com) delivers each submission to email, Telegram and webhooks. You don't need an API route, a database or SMTP.

```bash
npm install @formgong/vue
```

## Ready-made form

```vue
<script setup>
import { ContactForm } from "@formgong/vue";
</script>

<template>
  <ContactForm access-key="fk_your_access_key" lang="en" @success="(r) => console.log(r.id)" />
</template>
```

## Your own fields

```vue
<script setup>
import { FormgongForm } from "@formgong/vue";
</script>

<template>
  <FormgongForm access-key="fk_your_access_key" subject="New quote request" v-slot="{ submitting, error }">
    <input name="name" required />
    <input name="phone" type="tel" />
    <button :disabled="submitting">Send</button>
    <small v-if="error?.code === 'rate_limited'">Please wait a minute.</small>
  </FormgongForm>
</template>
```

`<FormgongForm>` adds the hidden `access_key`, `_lang` and `_subject` fields, a `botcheck` honeypot, the anti-spam signals (like Formgong's `fg.js`) and an `aria-live` status line. It emits `success` and `error`. Without JavaScript the form still posts natively.

Props: `access-key` (required), `lang`, `subject`, `redirect`, `endpoint`, `anti-spam` (default `true`), `hide-status`, `status-class`. `ContactForm` also takes `labels`.

## Composable

```vue
<script setup lang="ts">
import { useFormgong } from "@formgong/vue";
const { formRef, handleSubmit, status, message, submitting, error, submit } = useFormgong({ accessKey: "fk_your_access_key" });
</script>

<template>
  <form ref="formRef" @submit="handleSubmit">
    <input name="email" type="email" required />
    <textarea name="message" required />
    <input name="botcheck" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" />
    <button :disabled="submitting">Send</button>
    <p role="status">{{ message }}</p>
  </form>
</template>
```

`submit(data)` posts any object, for VeeValidate, FormKit or your own state. It never throws: check `error` (a typed `FormgongError` with `code`).

## Nuxt

```ts
// plugins/formgong.client.ts
import Formgong from "@formgong/vue";
export default defineNuxtPlugin((nuxt) => nuxt.vueApp.use(Formgong)); // registers <FormgongForm> and <ContactForm>
```

Or run `npx formgong init` in a Nuxt project. It writes `components/ContactForm.vue` with a fresh form key. More: [formgong.com/en/for/vue/](https://formgong.com/en/for/vue/) · [formgong.com/en/for/nuxt/](https://formgong.com/en/for/nuxt/).

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
