# formgong

[![npm](https://img.shields.io/npm/v/formgong?color=4f46e5&label=npm)](https://www.npmjs.com/package/formgong) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/formgong)](https://github.com/formgong/js/blob/main/LICENSE) [![node](https://img.shields.io/node/v/formgong)](https://nodejs.org)

> The [Formgong](https://formgong.com) CLI. A contact form backend from your terminal: create a form, drop a working contact page into Next.js, React, Vue, Nuxt, Svelte, SvelteKit, Astro or plain HTML, and read submissions. Submissions also go to your email and Telegram.

```bash
npx formgong login     # paste a personal API token (fgp_…)
npx formgong init      # create a form + write a contact page for your framework
```

## Commands

| Command | What it does |
| --- | --- |
| `login` | Saves a personal API token (create one under Dashboard → Account → API tokens). Input is hidden, and the token is checked against the API before it is saved to `~/.config/formgong/credentials.json` (mode 600). It also takes `--token`, `--stdin` or `FORMGONG_TOKEN`. |
| `logout` | Removes the saved token. |
| `init` | Detects your framework and package manager, creates a form (or reuses one with `--form <id>` / `--key fk_…`), writes a contact page and installs the matching `@formgong/*` package. |
| `forms` | Lists your forms: id, name, access key, submissions this month. |
| `create <name>` | Creates a form (`--no-email` turns off email notifications). |
| `snippet <form>` | Prints ready-to-paste, dependency-free code (`--framework html\|react\|next`, `--lang uk`). |
| `submissions <form>` | Shows recent submissions (`--limit 10`, `--spam`). Field values are visitor data; control characters are stripped. |
| `new [dir]` | Scaffolds a whole starter project (runs [`create-formgong`](https://www.npmjs.com/package/create-formgong)). |

`<form>` can be a form id, an access key (`fk_…`) or the exact form name. Add `--json` to any read command for machine-readable output (handy in CI or for AI agents).

## What `init` writes

| Detected | File | Package |
| --- | --- | --- |
| Next.js (App Router) | `app/contact/page.tsx` (or `src/app/…`) | `@formgong/react` |
| Next.js (Pages) | `pages/contact.tsx` | `@formgong/react` |
| React / Vite / Lovable / Bolt | `src/components/ContactForm.tsx` | `@formgong/react` |
| Vue | `src/components/ContactForm.vue` | `@formgong/vue` |
| Nuxt | `components/ContactForm.vue` | `@formgong/vue` |
| SvelteKit | `src/routes/contact/+page.svelte` | `@formgong/svelte` |
| Svelte | `src/lib/ContactForm.svelte` | `@formgong/svelte` |
| Astro | `src/pages/contact.astro` | `@formgong/astro` |
| No framework | `contact.html` (official snippet from the API) | – |

Useful flags:

- `--framework <name>` overrides detection.
- `--snippet` writes the dependency-free API snippet instead of a package import.
- `--lang uk` sets the visitor language.
- `--name "Contact – acme.com"` names the new form.
- `--dir` writes into another folder.
- `--no-install` skips the package install.
- `--dry-run` shows what would be written.
- `--force` overwrites existing files.

## How it works

The CLI calls Formgong's account API, the same JSON-RPC endpoint the [MCP server](https://formgong.com/en/docs/mcp/) uses (`https://formgong.com/mcp`), with your personal token. The token never leaves your machine except in requests to that endpoint. Limits: 60 requests per minute per token and 10 new forms per hour. The form's access key (`fk_…`) written into your code is public by design.

Environment variables:

- `FORMGONG_TOKEN`: token for CI. It takes priority over the saved token.
- `FORMGONG_API_URL`: another API endpoint.
- `FORMGONG_CONFIG_DIR`: where credentials are stored.
- `NO_COLOR`: plain output.

Requires Node.js 18.17+. The CLI is a single bundled file with no dependencies to install.

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
