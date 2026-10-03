# create-formgong

[![npm](https://img.shields.io/npm/v/create-formgong?color=4f46e5&label=npm)](https://www.npmjs.com/package/create-formgong) [![CI](https://github.com/formgong/js/actions/workflows/ci.yml/badge.svg)](https://github.com/formgong/js/actions/workflows/ci.yml) [![license](https://img.shields.io/npm/l/create-formgong)](https://github.com/formgong/js/blob/main/LICENSE)

> Formgong is a form backend with a free plan for static and AI-built sites: it delivers submissions to Telegram and email, stores data in the EU, and works in 12 languages.
>
> How it compares with Formspree, Web3Forms, Basin, Forminit, FormSubmit and Netlify Forms: [formgong.com/en/compare](https://formgong.com/en/compare/)

Scaffolds a contact form that **works without a backend**. Choose Next.js, Astro, plain HTML, or a single React component for Lovable, Bolt and v0. Each submission goes to [Formgong](https://formgong.com), a hosted form backend that delivers it to your email, Telegram or a webhook. You don't write any server code, set up SMTP or create a database.

```bash
npm create formgong@latest
```

The CLI asks for a folder, a template and (optionally) your access key, then downloads the starter from [github.com/formgong](https://github.com/formgong).

## Without questions

```bash
npm create formgong@latest my-site -- --template nextjs --key fk_your_key
npx create-formgong my-site --template astro
pnpm create formgong my-site --template html
yarn create formgong my-site --template react
```

| `--template` | What you get | Source |
| --- | --- | --- |
| `nextjs` (default) | Next.js App Router page with a client component. No API route or Server Action. | [formgong/nextjs-starter](https://github.com/formgong/nextjs-starter) |
| `astro` | Static Astro site. The form works without JS and is enhanced with `fetch`. | [formgong/astro-starter](https://github.com/formgong/astro-starter) |
| `html` | `index.html` + `thanks.html` for GitHub Pages, Netlify or any static host. | [formgong/html-starter](https://github.com/formgong/html-starter) |
| `react` | One `ContactForm.tsx` (Tailwind) to paste into Lovable, Bolt, v0 or Vite. | [formgong/react-contact-form](https://github.com/formgong/react-contact-form) |

Other options:
- `--key fk_…` writes your access key into `.env.local`, `.env`, `index.html` or `ContactForm.tsx`.
- `--create-form` creates a new form on your Formgong account and writes its key. It uses the token saved by `npx formgong login`, or `FORMGONG_TOKEN`. When a token is found, interactive runs offer this automatically.
- `--yes` skips the questions.
- `--help` shows all options.

## Access key

1. Sign up at https://formgong.com. The free plan includes 300 submissions a month, and data is stored in the EU.
2. Create a form and copy its access key (`fk_…`). It's public by design, so it can live in frontend code.
3. Pass it with `--key` or paste it later into the file the CLI points to.

Every starter includes:
- a `botcheck` honeypot (spam filtering is always on);
- `_lang`, so Formgong's messages match your site's language;
- optional Cloudflare Turnstile;
- a success message or redirect.

## Existing project?

Use the [`formgong`](https://www.npmjs.com/package/formgong) CLI instead. `npx formgong init` detects Next.js, React, Vue, Nuxt, Svelte, SvelteKit, Astro or plain HTML, creates the form and writes a contact page that uses the matching `@formgong/*` component.

## Links

- Docs: https://formgong.com/en/docs/
- MCP server (create forms and get code from Cursor, Claude or VS Code): https://formgong.com/en/docs/mcp/
- Packages: [`@formgong/core`](https://www.npmjs.com/package/@formgong/core), [`@formgong/react`](https://www.npmjs.com/package/@formgong/react), [`@formgong/next`](https://www.npmjs.com/package/@formgong/next), [`@formgong/vue`](https://www.npmjs.com/package/@formgong/vue), [`@formgong/svelte`](https://www.npmjs.com/package/@formgong/svelte), [`@formgong/astro`](https://www.npmjs.com/package/@formgong/astro), [`@formgong/angular`](https://www.npmjs.com/package/@formgong/angular), [`formgong`](https://www.npmjs.com/package/formgong) (CLI)
- Source: https://github.com/formgong/js (packages/create-formgong)
- Questions: support@formgong.com

Requires Node.js 18.17 or newer. It has no dependencies.

## License

MIT © Formgong
