export const metadata = { title: "Formgong + Next.js Server Actions" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 560, margin: "48px auto", padding: "0 16px" }}>{children}</body>
    </html>
  );
}
