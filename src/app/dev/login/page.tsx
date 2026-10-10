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
          <h1 className="font-hand mt-4 -rotate-2 bg-gradient-to-r from-[#e3262b] via-[#ee7a24] to-[#f6b51e] bg-clip-text pb-1 text-[52px] font-bold leading-none text-transparent drop-shadow-[0_2px_12px_rgba(238,122,36,0.25)]">
            Dev panel
          </h1>
          <p className="mt-2 text-sm text-slate-400">O'quv markazlari boshqaruvi</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-500">Faqat tizim egalari uchun. Barcha kirishlar jurnalga yoziladi.</p>
      </div>
    </main>
  );
}
