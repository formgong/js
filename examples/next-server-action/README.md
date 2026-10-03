# Next.js Server Action example

A contact form that posts to a Next.js Server Action, which forwards it to [Formgong](https://formgong.com) with `@formgong/next/server`. The home page shows the browser-direct variant (`<ContactForm>`), which needs no server code at all.

```bash
cp .env.example .env.local   # paste your fk_… key
npm install
npm run dev                  # open http://localhost:3000/contact
```

- `app/contact/actions.ts`: `"use server"` action calling `submitToFormgong(formData)`.
- `app/contact/page.tsx`: `<ActionForm action={contact}>` adds the honeypot and the status line (`useActionState`).
