import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import BottomNav from "./BottomNav";
import { S } from "./_i18n";
import { getPortalFlags } from "@/lib/portalFeatures";
import PwaSetup from "./PwaSetup";

// O'quvchining mobil ilova ko'rinishidagi portali (2026-08-28 talab).
// AppShell (sidebar) ishlatilmaydi — telefon ilovasi kabi bitta ustun + pastki menyu.
// Telefonga o'rnatiladigan ilova sifatida ko'rinishi uchun o'z manifesti
export const metadata = {
  title: "Germaniya Live",
  manifest: "/student.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default" as const, title: "Germaniya Live" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport = {
  themeColor: "#0e7490",
  viewportFit: "cover" as const,
};

// ── Ambient fon ──
// Kartalar shisha (`.gl-glass`, globals.css) — backdrop-filter esa ORQADAGI
// tasvirni bulaydi. Tekis rang ustida u umuman ko'rinmaydi, shuning uchun
// bu yerda yumshoq rangli dog'lar qo'yiladi: har qator karta ostida boshqacha
// rang bo'ladi va shisha ularni sindirib ko'rsatadi.
// Blur(filter) ISHLATILMAYDI — radial gradientning o'zi silliq, GPU'ga arzon
// va telefonda skrollni sekinlashtirmaydi. Qatlam `fixed`: fon qimirlamaydi,
// shisha uning ustidan suriladi — haqiqiy oyna hissi shundan.
const AMBIENT = [
  // Feruza ATAYLAB kam: ilgari dog'lar 0.3-0.5 shaffofsizlikda edi va butun
  // sahifa moviy bo'lib ketardi — bu "premium" emas, "rangli" taassurot
  // qoldiradi. Premium his sadaf (pearl) neytral asosdan, rang esa faqat
  // ishora bo'lib chiqadi: shisha qirrasi, soya va yorug'lik ishlaydi,
  // fon emas. Dog'lar baribir saqlanadi — shishaga sindirish uchun har
  // qator ostida boshqacha tus kerak, aks holda shisha "o'lik" ko'rinadi.
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

  // Menejer o'chirib qo'ygan bo'limlar pastki menyuda ko'rinmaydi
  const flags = await getPortalFlags();

  return (
    <div className="relative min-h-screen bg-[#e4edf3]">
      {/* O'quvchi ilovasi FAQAT och rejimda ishlaydi — maket ham, shisha ham
          och fonga qurilgan. Ildiz layout esa qurilma sozlamasiga qarab <html>
          ga `dark` sinfini qo'yadi va globals.css dagi tungi fallback qoidalari
          (`.dark :where(.bg-white)`) kartalarni qoraytirib yuborardi: telefoni
          tungi rejimda turgan o'quvchi ilovani yarim qora holda ko'rardi.
          Skript HTML o'qilayotganda ishlaydi — miltillash bo'lmaydi. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light';",
        }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0" style={{ background: AMBIENT }} />
      {/* Pastdagi bo'shliq: menyu balandligi + telefonning xavfsiz zonasi
          (jest chizig'i). `viewportFit: cover` bilan bu majburiy. */}
      <div className="relative z-10 mx-auto min-h-screen max-w-md px-4 pt-5 pb-[calc(112px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomNav t={S(session.locale)} showUben={flags.uben} />
      <PwaSetup />
    </div>
  );
}
