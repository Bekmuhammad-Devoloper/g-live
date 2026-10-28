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

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (isDevPanel()) return { title: "Dev panel — markazlar boshqaruvi", robots: { index: false, follow: false }, icons: { icon: "/icon.png?v=gl2", shortcut: "/favicon.ico?v=gl2", apple: "/apple-icon.png?v=gl2" } };
  const brand = await getBrand();
  return {
    title: `${brand.name} — Boshqaruv tizimi`,
    description: "O'quv markazini boshqarish tizimi (CRM, LMS, to'lov, davomat)",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b3c4d",
};

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
        <NativeShell />
        <DeployWatcher build={getBuildId()} />
        {gate ?? children}
      </body>
    </html>
  );
}
