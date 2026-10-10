import { redirect } from "next/navigation";
import { getDevSession } from "@/lib/devpanel/auth";
import LoginForm from "./LoginForm";

export default async function DevLoginPage() {
  if (await getDevSession()) redirect("/dev");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.png" alt="Germaniya Live" className="h-16 w-auto object-contain" />
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#e3262b] to-[#f6b51e]" />
            Dev panel
          </div>
          <p className="mt-3 text-sm text-slate-400">O'quv markazlari boshqaruvi</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-500">Faqat tizim egalari uchun. Barcha kirishlar jurnalga yoziladi.</p>
      </div>
    </main>
  );
}
