import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Framework, Project } from "./detect.js";

export type Scaffold = { file: string; content: string; package?: string; usage: string };

const q = (value: string) => JSON.stringify(value);

/** File to write for a framework, using the Formgong component packages. */
export function scaffoldFor(framework: Framework, project: Project, dir: string, accessKey: string, lang?: string): Scaffold {
  const ext = project.typescript ? "tsx" : "jsx";
  const langAttr = (sep: string) => (lang ? `${sep}lang=${q(lang)}` : "");
  switch (framework) {
    case "next": {
      if (!project.appRouter) {
        const base = existsSync(join(dir, "src", "pages")) ? "src/pages" : "pages";
        return {
          file: `${base}/contact.${ext}`,
          package: "@formgong/react",
          usage: "Open /contact",
          content: `import { ContactForm } from "@formgong/react";

// Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
export default function ContactPage() {
  return (
    <main style={{ padding: "48px 16px" }}>
      <h1>Contact us</h1>
      <ContactForm accessKey=${q(accessKey)}${langAttr(" ")} />
    </main>
  );
}
`,
        };
      }
      const base = existsSync(join(dir, "src", "app")) ? "src/app" : "app";
      return {
        file: `${base}/contact/page.${ext}`,
        package: "@formgong/react",
        usage: "Open /contact",
        content: `import { ContactForm } from "@formgong/react";

export const metadata = { title: "Contact" };

// Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
export default function ContactPage() {
  return (
    <main style={{ padding: "48px 16px" }}>
      <h1>Contact us</h1>
      <ContactForm accessKey=${q(accessKey)}${langAttr(" ")} />
    </main>
  );
}
`,
      };
    }
    case "react":
      return {
        file: `${project.srcDir ? "src/" : ""}components/ContactForm.${ext}`,
        package: "@formgong/react",
        usage: "import ContactForm from \"./components/ContactForm\" and render <ContactForm />",
        content: `import { ContactForm as FormgongContactForm } from "@formgong/react";

// Contact form powered by Formgong: submissions go to your email / Telegram.
// No backend, Supabase table or Edge Function needed. The access key is public by design.
export default function ContactForm() {
  return <FormgongContactForm accessKey=${q(accessKey)}${langAttr(" ")} />;
}
`,
      };
    case "vue":
    case "nuxt":
      return {
        file: framework === "nuxt" ? "components/ContactForm.vue" : `${project.srcDir ? "src/" : ""}components/ContactForm.vue`,
        package: "@formgong/vue",
        usage: framework === "nuxt" ? "Use <ContactForm /> in any page (auto-imported)" : "import ContactForm from \"./components/ContactForm.vue\"",
        content: `<script setup${project.typescript ? ' lang="ts"' : ""}>
// Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
import { ContactForm as FormgongContactForm } from "@formgong/vue";
</script>

<template>
  <FormgongContactForm access-key=${q(accessKey)}${langAttr(" ")} />
</template>
`,
      };
    case "sveltekit":
      return {
        file: "src/routes/contact/+page.svelte",
        package: "@formgong/svelte",
        usage: "Open /contact",
        content: `<script>
  // Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
  import { ContactForm } from "@formgong/svelte";
</script>

<h1>Contact us</h1>
<ContactForm accessKey=${q(accessKey)}${langAttr(" ")} />
`,
      };
    case "svelte":
      return {
        file: `${project.srcDir ? "src/" : ""}lib/ContactForm.svelte`,
        package: "@formgong/svelte",
        usage: "import ContactForm from \"./lib/ContactForm.svelte\"",
        content: `<script>
  // Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
  import { ContactForm } from "@formgong/svelte";
</script>

<ContactForm accessKey=${q(accessKey)}${langAttr(" ")} />
`,
      };
    case "astro":
      return {
        file: "src/pages/contact.astro",
        package: "@formgong/astro",
        usage: "Open /contact",
        content: `---
// Contact form powered by Formgong: submissions go to your email / Telegram. The access key is public by design.
import ContactForm from "@formgong/astro/ContactForm.astro";
---

<html lang=${q(lang ?? "en")}>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>Contact</title></head>
  <body>
    <main style="padding:48px 16px">
      <h1>Contact us</h1>
      <ContactForm accessKey=${q(accessKey)}${langAttr(" ")} />
    </main>
  </body>
</html>
`,
      };
    case "html":
    default:
      return {
        file: "contact.html",
        usage: "Open contact.html or link to it from your site",
        content: htmlPage(accessKey, lang),
      };
  }
}

/** Local fallback when the API snippet is not available. */
export function htmlPage(accessKey: string, lang?: string, formHtml?: string): string {
  const form = formHtml ?? `<form action="https://formgong.com/submit" method="POST">
  <input type="hidden" name="access_key" value=${q(accessKey)}>${lang ? `\n  <input type="hidden" name="_lang" value=${q(lang)}>` : ""}
  <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden"><input name="botcheck" tabindex="-1" autocomplete="off"></div>
  <label>Name <input name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Message <textarea name="message" rows="5" required></textarea></label>
  <button type="submit">Send</button>
</form>
<script src="https://formgong.com/fg.js" defer></script>`;
  return `<!doctype html>
<html lang=${q(lang ?? "en")}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Contact</title>
</head>
<body>
<!-- Contact form powered by Formgong (https://formgong.com): submissions go to your email / Telegram. -->
${form}
</body>
</html>
`;
}
