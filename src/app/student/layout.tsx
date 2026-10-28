import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import BottomNav from "./BottomNav";
import { S } from "./_i18n";
import { getPortalFlags } from "@/lib/portalFeatures";
import { prisma } from "@/lib/db";
import { touchActivity } from "@/lib/skills";
import PwaSetup from "./PwaSetup";
import Screen from "./Screen";
import { getBrand } from "@/lib/brand";

export async function generateMetadata() {
  const brand = await getBrand();
  return {
    title: brand.name,
    manifest: "/student.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default" as const, title: brand.name },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport = {
  themeColor: "#0e7490",
  viewportFit: "cover" as const,
  maximumScale: 1,
  userScalable: false,
};

const AMBIENT = [
  "radial-gradient(780px 470px at 14% -14%, rgba(23,162,191,0.17), transparent 64%)",
  "radial-gradient(620px 400px at 102% 4%, rgba(96,196,224,0.19), transparent 60%)",
  "radial-gradient(700px 470px at 50% 36%, rgba(255,255,255,0.92), transparent 66%)",
  "radial-gradient(740px 540px at -8% 78%, rgba(14,116,144,0.11), transparent 62%)",
  "radial-gradient(620px 430px at 106% 96%, rgba(214,170,86,0.13), transparent 58%)",
  "linear-gradient(180deg, #eff3f6 0%, #e8edf1 48%, #f1f4f6 100%)",
].join(",");

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== ROLES.STUDENT) redirect("/dashboard");

  const flags = await getPortalFlags();

  const me = await prisma.student.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (me) await touchActivity(me.id);

  return (
    <div className="gl-native relative min-h-screen bg-[#e4edf3]" data-locale={session.locale}>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: AMBIENT }} />
      <div
        className="relative z-10 mx-auto min-h-screen max-w-md px-4 pb-[calc(112px+env(safe-area-inset-bottom))]"
        style={{ paddingTop: "calc(20px + var(--gl-safe-top, env(safe-area-inset-top)))" }}
      >
        <Screen>{children}</Screen>
      </div>
      <BottomNav t={S(session.locale)} showUben={flags.uben} />
      <PwaSetup />
    </div>
  );
}
