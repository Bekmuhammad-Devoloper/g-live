import type { Metadata, Viewport } from "next";
import "./globals.css";

// Eslatma: sidebar "handwriting" shrifti CSS fallback (Segoe Script / cursive)
// orqali beriladi — globals.css `.font-hand`. Bu ilovani tashqi Google Fonts
// yuklamasidan mustaqil qiladi (internet uzilsa ham ilova ishlaydi).

export const metadata: Metadata = {
  title: "Germaniya Live — Boshqaruv tizimi",
  description: "O'quv markazini boshqarish tizimi (CRM, LMS, to'lov, davomat)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Sahifa chizilishidan oldin mavzuni qo'llash (dark mode "miltillashi"ning oldini oladi)
const themeScript = `
try {
  var t = localStorage.getItem('gl-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
