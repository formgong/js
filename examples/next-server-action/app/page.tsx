import { ContactForm } from "@formgong/next/client";

// Client-side variant: the browser posts straight to Formgong (no server code at all).
export default function Home() {
  return (
    <main>
      <h1>Formgong + Next.js</h1>
      <p>Browser-direct form below; a Server Action version lives at <a href="/contact">/contact</a>.</p>
      <ContactForm accessKey={process.env.NEXT_PUBLIC_FORMGONG_ACCESS_KEY ?? "fk_your_access_key"} />
    </main>
  );
}
