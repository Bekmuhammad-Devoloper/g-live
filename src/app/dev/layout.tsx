import { notFound } from "next/navigation";
import { isDevPanel } from "@/lib/instance";

// Dev panel faqat DEV_PANEL=1 jarayonida mavjud; o'quv markazlari nusxalarida /dev — 404.
export default function DevRootLayout({ children }: { children: React.ReactNode }) {
  if (!isDevPanel()) notFound();
  return <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">{children}</div>;
}
