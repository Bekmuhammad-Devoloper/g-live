import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeShell from "./NativeShell";

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
  // Android ilovasida ekranning kesik (notch) va pastki chiziq ostigacha
  // bo'yalsin — chetlarda oq yo'l qolib ketmasin. Xavfsiz masofalarni
  // `env(safe-area-inset-*)` bilan komponentlarning o'zi hisobga oladi.
  viewportFit: "cover",
  themeColor: "#0b3c4d",
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
        {/* Shrift ilova bilan birga keladi (public/fonts). Lotin qismi
            oldindan yuklanadi: aks holda birinchi chizishda zaxira shrift
            ko'rinib, keyin Inter kelganda matn "sakrardi". */}
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/* Android ilovasi ichida ishlaydigan qatlam (brauzerda jim turadi):
            ochilish ekrani, holat qatori, "orqaga" tugmasi, tashqi havolalar */}
        <NativeShell />
        {children}
      </body>
    </html>
  );
}
