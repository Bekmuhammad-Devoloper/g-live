import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeShell from "./NativeShell";
import DeployWatcher from "./DeployWatcher";
import { getBuildId } from "@/lib/buildId";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { instanceBlockState, isDevPanel, isPathEnabled } from "@/lib/instance";
import { getBrand } from "@/lib/brand";
import { BlockedScreen, ModuleOffScreen } from "./InstanceGate";

// Bir xil build bir nechta markaz nusxasida ishlaydi; markaz sozlamalari (nomi, litsenziya,
// modullar) jarayon muhitidan va bazadan ish vaqtida o'qiladi — statik prerender bo'lmasin.
export const dynamic = "force-dynamic";

// Eslatma: sidebar "handwriting" shrifti CSS fallback (Segoe Script / cursive)
// orqali beriladi — globals.css `.font-hand`. Bu ilovani tashqi Google Fonts
// yuklamasidan mustaqil qiladi (internet uzilsa ham ilova ishlaydi).

export async function generateMetadata(): Promise<Metadata> {
  if (isDevPanel()) return { title: "Dev panel — markazlar boshqaruvi", robots: { index: false, follow: false } };
  const brand = await getBrand();
  return {
    title: `${brand.name} — Boshqaruv tizimi`,
    description: "O'quv markazini boshqarish tizimi (CRM, LMS, to'lov, davomat)",
  };
}

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-gl-path") ?? "/";
  const devArea = path === "/dev" || path.startsWith("/dev/");
  // Dev panel jarayoni faqat /dev ni ko'rsatadi; o'quv markazlarida /dev umuman yo'q
  if (isDevPanel() && !devArea) redirect("/dev");
  let gate: React.ReactNode = null;
  if (!isDevPanel()) {
    if (devArea) gate = <ModuleOffScreen />;
    else {
      const block = instanceBlockState();
      if (block.blocked) gate = <BlockedScreen state={block} orgName={(await getBrand()).name} />;
      else if (!isPathEnabled(path)) gate = <ModuleOffScreen />;
    }
  }
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
        {/* Deploy'dan keyin eskirgan sahifani yangilaydi — tugmalar jim qolib ketmasin */}
        <DeployWatcher build={getBuildId()} />
        {gate ?? children}
      </body>
    </html>
  );
}
