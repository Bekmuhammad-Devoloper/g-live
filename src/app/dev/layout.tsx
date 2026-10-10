import { notFound } from "next/navigation";
import { isDevPanel } from "@/lib/instance";

// Dev panel faqat DEV_PANEL=1 jarayonida mavjud; o'quv markazlari nusxalarida /dev — 404.
// Panel doim qorong'i mavzuda (brend: to'q fon + qizil→sariq gradient urg'u).
export default function DevRootLayout({ children }: { children: React.ReactNode }) {
  if (!isDevPanel()) notFound();
  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#070b16] text-slate-100 [color-scheme:dark]">
      <div aria-hidden className="pointer-events-none fixed -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-[#ee7a24]/10 blur-[120px]" />
      <div aria-hidden className="pointer-events-none fixed bottom-[-20%] left-[-10%] h-[480px] w-[480px] rounded-full bg-[#e3262b]/[0.07] blur-[120px]" />
      <div className="relative">{children}</div>
    </div>
  );
}
