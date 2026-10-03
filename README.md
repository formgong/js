# Formgong JavaScript SDKs

[![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![core size](https://img.shields.io/bundlephobia/minzip/@formgong/core?label=%40formgong%2Fcore)](https://bundlephobia.com/package/@formgong/core)

Official packages for **[Formgong](https://formgong.com)**, the form backend for contact forms. Your form posts to Formgong, and each submission arrives by **email, Telegram or webhook**. You don't need a server, a database or SMTP. There is a free plan, data is stored in the EU, and messages come in 12 languages.

```bash
npx formgong init        # create a form + add a contact page to your Next.js / React / Vue / Svelte / Astro / HTML project
```

| Package | Version | Use it for |
| --- | --- | --- |
| [`@formgong/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@formgong/core?label=)](https://www.npmjs.com/package/@formgong/core) | Any JS runtime: `submit()`, typed errors, anti-spam tracker, account API. About 3 kB, no dependencies, ESM + CJS. |
| [`@formgong/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@formgong/react?label=)](https://www.npmjs.com/package/@formgong/react) | `<ContactForm>`, `<FormgongForm>`, `useFormgong()` in React, Lovable, Bolt, v0 and Vite |
| [`@formgong/next`](packages/next) | [![npm](https://img.shields.io/npm/v/@formgong/next?label=)](https://www.npmjs.com/package/@formgong/next) | Next.js Server Actions (`useActionState`), Route Handlers, App Router components |
| [`@formgong/vue`](packages/vue) | [![npm](https://img.shields.io/npm/v/@formgong/vue?label=)](https://www.npmjs.com/package/@formgong/vue) | Vue 3 and Nuxt components and the `useFormgong()` composable |
| [`@formgong/svelte`](packages/svelte) | [![npm](https://img.shields.io/npm/v/@formgong/svelte?label=)](https://www.npmjs.com/package/@formgong/svelte) | `use:formgong` action, store helper and components for Svelte 4/5 and SvelteKit |
| [`@formgong/astro`](packages/astro) | [![npm](https://img.shields.io/npm/v/@formgong/astro?label=)](https://www.npmjs.com/package/@formgong/astro) | Astro components with progressive enhancement, plus a helper for Astro Actions |
| [`formgong`](packages/cli) | [![npm](https://img.shields.io/npm/v/formgong?label=)](https://www.npmjs.com/package/formgong) | CLI: `login`, `init`, `forms`, `create`, `snippet`, `submissions` |
| [`create-formgong`](packages/create-formgong) | [![npm](https://img.shields.io/npm/v/create-formgong?label=)](https://www.npmjs.com/package/create-formgong) | `npm create formgong@latest`: Next.js, Astro, HTML and React starters |

## 30-second examples

```tsx
// React / Next.js / Lovable / Bolt
import { ContactForm } from "@formgong/react";
<ContactForm accessKey="fk_your_access_key" />
```

```ts
// Anywhere (Node, Workers, Deno, Bun, browser)
import { submit } from "@formgong/core";
await submit("fk_your_access_key", { email: "ada@example.com", message: "Hi!" });
```

```astro
---
import ContactForm from "@formgong/astro/ContactForm.astro";
---
<ContactForm accessKey="fk_your_access_key" />
```

The access key (`fk_…`) is public by design: it can only send submissions to your form. Get one free at [formgong.com](https://formgong.com).

## What every package does for you

- It adds the hidden `access_key` and `_lang` fields and a `botcheck` honeypot. Without JavaScript the form still posts natively.
- It shows Formgong's localized success or error message in an `aria-live` region.
- It sends the same cookie-free anti-spam signals as Formgong's `fg.js`: fill time, typing and paste counts, and a small SHA-256 proof-of-work. Server-side posts never fabricate them and are never penalised for lacking them.
- Errors are typed, with stable codes (`unknown_access_key`, `rate_limited`, `turnstile_missing`, …).

## Compared with other form backends

Formgong delivers to Telegram as well as email, stores data in the EU, works in 12 languages and has a free plan. See the side-by-side comparison with Formspree, Web3Forms, Basin, Getform, FormSubmit and Netlify Forms: **[formgong.com/en/compare](https://formgong.com/en/compare/)**. Coming from Formspree? [Switch in one line](https://formgong.com/en/formspree-alternative/).

## Development

```bash
pnpm install
pnpm build && pnpm typecheck && pnpm test
```

- `packages/*`: published packages (pnpm workspaces, tsup, vitest).
- `examples/next-server-action`: Next.js Server Action example.
- `scripts/e2e.mjs`: end-to-end check against a live Formgong deployment.
- Releases: [Changesets](.changeset/README.md) + a manual GitHub Actions workflow with npm provenance. See [RELEASING.md](RELEASING.md). (Workflows live in `.github/workflows-to-enable/` until they are moved into `.github/workflows/`.)

Docs: https://formgong.com/en/docs/ · MCP server: https://formgong.com/en/docs/mcp/ · Support: support@formgong.com

MIT © Formgong
